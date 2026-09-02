const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc } = require('firebase/firestore');

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

// PROMOTION MAP matching user request:
// FS1 -> FS2 (27)
// FS2 -> FS3 (22)
// FS3 -> HS1 (20)
// HS1 -> HS2 (16)
// HS2 -> HS3 (21)
// HS3 -> D1  (14)
// D1  -> D2  (16)
// D2  -> D3  (20)
// D3  -> PG-F (16 students promoted from D3)
// PG1 -> PG1  (9 students promoted from PG1)
const PROMOTION_MAP = {
    'FS1': 'FS2',
    'FS2': 'FS3',
    'FS3': 'HS1',
    'HS1': 'HS2',
    'HS2': 'HS3',
    'HS3': 'D1',
    'D1':  'D2',
    'D2':  'D3',
    'D3':  'PG-F',
    'PG1': 'PG1',
    'PG-F': 'PG1',
    'UG-F': 'UG-F',
    'Hifz': 'Hifz'
};

async function executeClassSwapAndVerify() {
    console.log('=== EXECUTING EXACT CLASS SWAP & PROMOTION ===\n');

    const TARGET_TERM = '2026-2027-Odd';
    const studentsSnap = await getDocs(collection(db, 'students'));

    const counts = {};

    for (const docSnap of studentsSnap.docs) {
        const student = docSnap.data();
        const history = { ...(student.academicHistory || {}) };
        
        const prevClass = history['2025-2026-Odd']?.className || student.currentClass || student.className || 'Unknown';
        const targetClass = PROMOTION_MAP[prevClass] || prevClass;

        history[TARGET_TERM] = {
            className: targetClass,
            semester: 'Odd',
            marks: {},
            grandTotal: 0,
            average: 0,
            rank: 0,
            performanceLevel: 'Needs Improvement'
        };

        await updateDoc(docSnap.ref, {
            isActive: true,
            currentClass: targetClass,
            academicHistory: history
        });

        counts[targetClass] = (counts[targetClass] || 0) + 1;
    }

    console.log(`Student Counts per Class for ${TARGET_TERM}:`);
    Object.entries(counts).sort().forEach(([c, n]) => {
        console.log(`   ${c}: ${n} students`);
    });
}

executeClassSwapAndVerify().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
