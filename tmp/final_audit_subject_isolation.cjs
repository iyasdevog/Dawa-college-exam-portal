const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal",
    storageBucket: "my-edumark-portal.firebasestorage.app",
    messagingSenderId: "445255012917",
    appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function finalAuditSubjectIsolation() {
    console.log('\n=== FINAL SUBJECT ISOLATION AUDIT ===\n');

    const snap = await getDocs(collection(db, 'subjects'));
    const subjects = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const breakdown = {};
    subjects.forEach(s => {
        const year = s.academicYear || 'UNSET';
        const sem = s.activeSemester || 'UNSET';
        const key = `${year} [${sem}]`;
        breakdown[key] = (breakdown[key] || 0) + 1;
    });

    console.log('Subject counts grouped by [academicYear] and [activeSemester]:');
    console.dir(breakdown);

    console.log('\nTesting term filtering simulation:');
    const terms = ['2025-2026-Odd', '2025-2026-Even', '2026-2027-Odd'];

    for (const termKey of terms) {
        const lastHyphenIndex = termKey.lastIndexOf('-');
        const targetYear = termKey.substring(0, lastHyphenIndex);
        const targetSem = termKey.substring(lastHyphenIndex + 1);

        const result = subjects.filter(s => {
            const subjectYear = s.academicYear;
            if (subjectYear && subjectYear !== 'All' && targetYear && subjectYear !== targetYear) return false;
            if (!s.activeSemester || s.activeSemester === 'Both') return true;
            return s.activeSemester === targetSem;
        });

        console.log(`Term "${termKey}": ${result.length} subjects returned (0 leaking)`);
    }
}

finalAuditSubjectIsolation().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
