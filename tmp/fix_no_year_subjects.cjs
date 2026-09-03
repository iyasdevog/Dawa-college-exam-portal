const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch, doc } = require('firebase/firestore');

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

async function fixNoYearSubjects() {
    console.log('\n=== FIXING SUBJECTS WITH NO academicYear ===\n');

    const snap = await getDocs(collection(db, 'subjects'));
    const subjects = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    // Subjects with no academicYear (or empty) 
    const noYear = subjects.filter(s => !s.academicYear || s.academicYear === '');

    console.log(`Found ${noYear.length} subjects with no academicYear:`);
    noYear.forEach(s => {
        console.log(`  id=${s.id} | sem=${s.activeSemester} | "${s.name}" → [${(s.targetClasses||[]).join(', ')}]`);
    });

    if (noYear.length === 0) {
        console.log('All subjects already have an academicYear set. Nothing to fix.');
        return;
    }

    // Fix: assign academicYear=2025-2026 based on their activeSemester
    const batch = writeBatch(db);
    noYear.forEach(s => {
        const ref = doc(db, 'subjects', s.id);
        batch.update(ref, { academicYear: '2025-2026' });
    });
    await batch.commit();
    console.log(`\n✅ Assigned academicYear=2025-2026 to ${noYear.length} subjects.`);
}

fixNoYearSubjects().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
