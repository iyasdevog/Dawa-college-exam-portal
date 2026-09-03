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

async function inspectD1SubjectCatalog() {
    console.log('\n=== INSPECTING D1 SUBJECT CATALOG CONFIGURATION ===\n');

    const d1SubjectIds = [
        { id: 'NNXtpSXZ7koV9ThPj4JC', name: 'FIQH' },
        { id: '6cnp4HcPmDE9KRm3LAsG', name: 'NAHV' },
        { id: 'Gh5xTNdCRAYL47ZRCPgC', name: 'DOURA' },
        { id: '20hGruyLHQSAeqIcie5a', name: 'URDU' },
        { id: 'v1eqpVhe9zwBenNqz5nL', name: 'v1eqpVhe9zwBenNqz5nL' }
    ];

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    d1SubjectIds.forEach(item => {
        const catSub = allSubjects.find(s => s.id === item.id);
        if (catSub) {
            console.log(`Subject [${item.id}] ("${item.name}"):`);
            console.log(`  academicYear: "${catSub.academicYear}", activeSemester: "${catSub.activeSemester}", targetClasses: [${(catSub.targetClasses||[]).join(',')}]`);
        } else {
            console.log(`Subject [${item.id}] ("${item.name}") NOT FOUND IN CATALOG!`);
        }
    });

    console.log('\nChecking all catalog subjects that have name="FIQH", "NAHV", "DOURA", or "URDU":');
    ['FIQH', 'NAHV', 'DOURA', 'URDU'].forEach(targetName => {
        const matching = allSubjects.filter(s => (s.name || '').trim().toLowerCase() === targetName.toLowerCase());
        console.log(`\nName: "${targetName}" (${matching.length} found in catalog):`);
        matching.forEach(m => {
            console.log(`  - [${m.id}] year:"${m.academicYear}", sem:"${m.activeSemester}", targets:[${(m.targetClasses||[]).join(',')}]`);
        });
    });
}

inspectD1SubjectCatalog().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
