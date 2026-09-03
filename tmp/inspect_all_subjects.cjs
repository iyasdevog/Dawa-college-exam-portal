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

async function inspectSubjects() {
    console.log('\n=== INSPECTING ALL SUBJECTS IN FIRESTORE ===\n');

    const snap = await getDocs(collection(db, 'subjects'));
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`Total subjects in collection: ${docs.length}`);

    const activeDocs = docs.filter(s => !s.isDeleted);
    console.log(`Active (non-deleted) subjects: ${activeDocs.length}`);

    const byYearSem = {};
    activeDocs.forEach(s => {
        const yr = s.academicYear || 'MISSING';
        const sem = s.activeSemester || 'MISSING';
        const key = `${yr} | ${sem}`;
        byYearSem[key] = (byYearSem[key] || 0) + 1;
    });

    console.log('\nBreakdown of active subjects by (academicYear | activeSemester):');
    console.table(byYearSem);

    console.log('\nSample subjects for each category:');
    const categories = Object.keys(byYearSem);
    categories.forEach(cat => {
        const [yr, sem] = cat.split(' | ');
        const sample = activeDocs.find(s => (s.academicYear || 'MISSING') === yr && (s.activeSemester || 'MISSING') === sem);
        if (sample) {
            console.log(`\nCategory: [${cat}]`);
            console.log(`  ID: ${sample.id}`);
            console.log(`  Name: ${sample.name}`);
            console.log(`  Faculty: ${sample.facultyName}`);
            console.log(`  Classes: ${(sample.targetClasses || []).join(', ')}`);
            console.log(`  Type: ${sample.subjectType}`);
        }
    });
}

inspectSubjects().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
