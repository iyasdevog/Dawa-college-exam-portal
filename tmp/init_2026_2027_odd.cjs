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

const PROMOTION_MAP = {
    'FS1': 'FS2',
    'FS2': 'FS3',
    'FS3': 'HS1',
    'HS1': 'HS2',
    'HS2': 'HS3',
    'HS3': 'D1',
    'D1':  'D2',
    'D2':  'D3',
    'D3':  'PG1',
    'PG1': 'PG-F',
    'PG-F': 'PG-F',
    'UG-F': 'UG-F',
    'Hifz': 'Hifz'
};

async function initialize2026_2027_Odd() {
    console.log('=== INITIALIZING 2026-2027-Odd FOR ALL STUDENTS ===\n');

    const TARGET_TERM = '2026-2027-Odd';
    const studentsSnap = await getDocs(collection(db, 'students'));
    console.log(`Total students: ${studentsSnap.docs.length}`);

    let updatedCount = 0;

    for (const docSnap of studentsSnap.docs) {
        const student = docSnap.data();
        if (student.isActive === false) continue;

        const history = { ...(student.academicHistory || {}) };
        
        // Find their class from 2025-2026-Odd or currentClass
        const previousClass = history['2025-2026-Odd']?.className || student.currentClass || student.className || 'Unknown';
        // Auto-promote if moving to a new academic year
        const promotedClass = PROMOTION_MAP[previousClass] || previousClass;

        history[TARGET_TERM] = {
            className: promotedClass,
            semester: 'Odd',
            marks: {},
            grandTotal: 0,
            average: 0,
            rank: 0,
            performanceLevel: 'Needs Improvement'
        };

        await updateDoc(docSnap.ref, {
            currentClass: promotedClass,
            academicHistory: history
        });

        updatedCount++;
        console.log(`[${student.adNo}] ${student.name}: ${previousClass} → promoted to "${promotedClass}" in ${TARGET_TERM}`);
    }

    console.log(`\n✅ Done: Initialized ${TARGET_TERM} for ${updatedCount} students.`);
}

initialize2026_2027_Odd().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
