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

async function printUnmappedSubjectDetails() {
    console.log('\n=== UNMAPPED SUBJECT IDs DETAILS IN 2025-2026-Odd ===\n');

    const unmappedTargetIds = [
        'CP73DIkL4tGuX8pgH6JU',
        'v1eqpVhe9zwBenNqz5nL',
        'zjfIw4gLzhZUwNgljmsa',
        'qONeFnfq8xP7dXSUlboO',
        'hXwj90u3pLUzQh5pkhcS',
        'kbGr9LuXzpvE3Ws0PiE5',
        'qPqFCSR8H6Gvx9nQbacG',
        'XZ8Sl65cKfzW03J4YhPg'
    ];

    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    unmappedTargetIds.forEach(targetId => {
        console.log(`\nUnmapped ID: ${targetId}`);
        allStudents.forEach(student => {
            const hist = student.academicHistory ? student.academicHistory['2025-2026-Odd'] : null;
            if (hist && hist.marks && hist.marks[targetId]) {
                const mark = hist.marks[targetId];
                const meta = hist.subjectMetadata ? hist.subjectMetadata[targetId] : null;
                console.log(`  Student: "${student.name}" (AdNo: ${student.adNo}, Class: ${hist.className})`);
                console.log(`    Mark:`, mark);
                console.log(`    Meta:`, meta);
            }
        });
    });
}

printUnmappedSubjectDetails().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
