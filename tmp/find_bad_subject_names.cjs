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

async function findSubjectsWithBadNames() {
    console.log('=== FINDING SUBJECTS WITH MISSING/EMPTY NAMES ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));

    let badCount = 0;
    subjectsSnap.docs.forEach(doc => {
        const sub = doc.data();
        const hasEmptyName = !sub.name || sub.name.trim() === '';
        const hasLongName = sub.name && sub.name.length > 40;
        const appearsToBeId = sub.name && /^[A-Z0-9]{15,}$/.test(sub.name.trim());

        if (hasEmptyName || appearsToBeId) {
            badCount++;
            console.log(`❌ [${doc.id}]:`);
            console.log(`   name: "${sub.name}"`);
            console.log(`   subjectType: "${sub.subjectType}"`);
            console.log(`   targetClasses: [${(sub.targetClasses || []).join(', ')}]`);
            console.log(`   activeSemester: "${sub.activeSemester}"`);
            console.log('');
        }
    });

    if (badCount === 0) {
        console.log('All subjects have valid names!');
    } else {
        console.log(`Total subjects with bad names: ${badCount}`);
    }

    // Also print ALL subject entries sorted by name for visibility
    console.log('\n=== ALL SUBJECTS IN CATALOG (sorted by name) ===');
    const sorted = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    sorted.forEach(s => {
        console.log(`[${s.id}] "${s.name}" | Type: ${s.subjectType} | Sem: ${s.activeSemester} | Classes: [${(s.targetClasses || []).join(',')}]`);
    });
}

findSubjectsWithBadNames().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
