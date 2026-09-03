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

async function detailSubjects() {
    const snap = await getDocs(collection(db, 'subjects'));
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    console.log('\n--- ALL 6 SUBJECTS WITH academicYear === "All" ---');
    const allYearSubs = docs.filter(s => s.academicYear === 'All');
    allYearSubs.forEach(s => {
        console.log(`ID: ${s.id} | Name: "${s.name}" | Class: [${(s.targetClasses||[]).join(', ')}] | Sem: ${s.activeSemester} | Faculty: ${s.facultyName}`);
    });

    console.log('\n--- 2025-2026 Odd Subjects Count by Class ---');
    const oddSubs = docs.filter(s => (s.academicYear === '2025-2026' || s.academicYear === 'All') && s.activeSemester === 'Odd');
    const oddByClass = {};
    oddSubs.forEach(s => {
        (s.targetClasses || ['NoClass']).forEach(c => {
            oddByClass[c] = (oddByClass[c] || 0) + 1;
        });
    });
    console.table(oddByClass);

    console.log('\n--- 2025-2026 Even Subjects Count by Class ---');
    const evenSubs = docs.filter(s => (s.academicYear === '2025-2026' || s.academicYear === 'All') && s.activeSemester === 'Even');
    const evenByClass = {};
    evenSubs.forEach(s => {
        (s.targetClasses || ['NoClass']).forEach(c => {
            evenByClass[c] = (evenByClass[c] || 0) + 1;
        });
    });
    console.table(evenByClass);
}

detailSubjects().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
