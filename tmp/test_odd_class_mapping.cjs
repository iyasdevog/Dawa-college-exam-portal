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

const evenToOddClassMap = {
    'FS2': 'S1',
    'FS3': 'S2',
    'HS2': 'P1',
    'HS3': 'P2',
    'PG1': 'PG-F',
    'FS1': 'FS1',
    'HS1': 'HS1',
    'D1': 'D1',
    'D2': 'D2',
    'D3': 'D3',
    'Hifz': 'Hifz'
};

async function testOddClassMapping() {
    console.log('\n=== MAPPING 2025-2026-Odd CLASSES TO ORIGINAL NAMES (S1, S2, P1, P2, PG-F) ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const classStudentCounts = {};
    const classMarksCounts = {};

    students.forEach(s => {
        const oddHist = s.academicHistory ? s.academicHistory['2025-2026-Odd'] : null;
        if (oddHist) {
            const currentDbClass = oddHist.className || 'UNSET';
            const originalOddClass = evenToOddClassMap[currentDbClass] || currentDbClass;

            classStudentCounts[originalOddClass] = (classStudentCounts[originalOddClass] || 0) + 1;

            const markCount = oddHist.marks ? Object.keys(oddHist.marks).length : 0;
            classMarksCounts[originalOddClass] = (classMarksCounts[originalOddClass] || 0) + (markCount > 0 ? markCount : 0);
        }
    });

    console.log('Class Breakdown for 2025-2026-Odd after mapping to S1, S2, P1, P2:');
    Object.keys(classStudentCounts).sort().forEach(cls => {
        console.log(`  - Class "${cls}": ${classStudentCounts[cls]} students | Total Marks Recorded: ${classMarksCounts[cls]}`);
    });
}

testOddClassMapping().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
