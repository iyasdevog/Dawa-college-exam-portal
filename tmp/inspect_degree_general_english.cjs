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

async function inspectDegreeGeneralEnglish() {
    console.log('\n=== CHECKING WHY GENERAL ENGLISH APPEARS IN D1, D2, D3 ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const engSubjects = allSubjects.filter(s => (s.name || '').toLowerCase().includes('english'));

    console.log('All Catalog Subjects containing "English":');
    engSubjects.forEach(s => {
        console.log(`  - [${s.id}] "${s.name}" | type: "${s.subjectType}" | activeSem: "${s.activeSemester}" | academicYear: "${s.academicYear}" | targets: [${(s.targetClasses||[]).join(',')}]`);
    });

    const degreeClasses = ['D1', 'D2', 'D3'];
    degreeClasses.forEach(dCls => {
        const matching = engSubjects.filter(s => (s.targetClasses || []).includes(dCls));
        console.log(`\nCatalog English subjects targeting ${dCls}:`);
        matching.forEach(m => {
            console.log(`  - [${m.id}] "${m.name}" | type: "${m.subjectType}" | sem: "${m.activeSemester}"`);
        });
    });
}

inspectDegreeGeneralEnglish().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
