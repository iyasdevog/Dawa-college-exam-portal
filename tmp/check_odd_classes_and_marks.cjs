const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal",
    storageBucket: "my-edumark-portal.firebasestorage.app",
    messagingSenderId: "445255012917",
    appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c",
    measurementId: "G-LLMWHDTZ1T"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkOddClassesAndMarks() {
    console.log('\n=== INSPECTING FIRESTORE 2025-2026-Odd CLASS NAMES & MARKS ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`Total students in Firestore: ${students.length}`);

    const oddClasses = new Set();
    const classToStudentCount = {};
    const classToMarksCount = {};

    students.forEach(s => {
        const oddHist = s.academicHistory ? s.academicHistory['2025-2026-Odd'] : null;
        if (oddHist) {
            const cls = oddHist.className || 'UNSET';
            oddClasses.add(cls);
            classToStudentCount[cls] = (classToStudentCount[cls] || 0) + 1;

            const markCount = oddHist.marks ? Object.keys(oddHist.marks).length : 0;
            classToMarksCount[cls] = (classToMarksCount[cls] || 0) + (markCount > 0 ? 1 : 0);
        }
    });

    console.log('Unique Class Names in academicHistory["2025-2026-Odd"]:', Array.from(oddClasses).sort());
    console.log('\nStudent Count per Class in 2025-2026-Odd:');
    console.dir(classToStudentCount);

    console.log('\nStudents WITH MARKS per Class in 2025-2026-Odd:');
    console.dir(classToMarksCount);
}

checkOddClassesAndMarks().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
