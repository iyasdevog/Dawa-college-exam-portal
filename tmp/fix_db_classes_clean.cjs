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

// PERFECT 1-to-1 MAPPING FROM 2025-2026-Odd TO 2026-2027-Odd:
// FS1 (27)  -> FS1  (27)
// FS2 (22)  -> FS2  (22)
// FS3 (19)  -> FS3  (19)
// HS1 (15)  -> HS1  (15)
// HS2 (22)  -> HS2  (22)
// HS3 (15)  -> UG-F (15)
// D1  (16)  -> D2   (16)
// D2  (20)  -> D3   (20)
// D3  (16)  -> PG-F (16)
// PG1 (9)   -> PG1  (9)
// Hifz (19) -> Hifz (19)
const PROMOTION_MAP = {
    'FS1': 'FS1',
    'FS2': 'FS2',
    'FS3': 'FS3',
    'HS1': 'HS1',
    'HS2': 'HS2',
    'HS3': 'UG-F',
    'D1':  'D2',
    'D2':  'D3',
    'D3':  'PG-F',
    'PG1': 'PG1',
    'PG-F': 'PG-F',
    'UG-F': 'UG-F',
    'Hifz': 'Hifz'
};

async function fixDatabaseClassesClean() {
    console.log('=== FIXING DATABASE STUDENT CLASSES FOR 2026-2027-Odd ===\n');

    const TARGET_TERM = '2026-2027-Odd';
    const studentsSnap = await getDocs(collection(db, 'students'));

    const counts = {};

    for (const docSnap of studentsSnap.docs) {
        const student = docSnap.data();
        const history = { ...(student.academicHistory || {}) };
        
        // Base class from 2025-2026-Odd
        const prevClass = history['2025-2026-Odd']?.className || student.currentClass || student.className || 'Unknown';
        const targetClass = PROMOTION_MAP[prevClass] || prevClass;

        history[TARGET_TERM] = {
            className: targetClass,
            semester: 'Odd',
            marks: history[TARGET_TERM]?.marks || {},
            grandTotal: history[TARGET_TERM]?.grandTotal || 0,
            average: history[TARGET_TERM]?.average || 0,
            rank: history[TARGET_TERM]?.rank || 0,
            performanceLevel: history[TARGET_TERM]?.performanceLevel || 'Needs Improvement'
        };

        await updateDoc(docSnap.ref, {
            isActive: true,
            currentClass: targetClass,
            academicHistory: history
        });

        counts[targetClass] = (counts[targetClass] || 0) + 1;
    }

    console.log(`Final Perfect Student Counts for ${TARGET_TERM}:`);
    Object.entries(counts).sort().forEach(([c, n]) => {
        console.log(`   ${c}: ${n} students`);
    });
}

fixDatabaseClassesClean().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
