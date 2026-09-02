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

// Updated promotion map: D3 promotes directly to PG-F (giving PG-F 16 students)
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
    'PG1': 'PG-F',
    'PG-F': 'PG-F',
    'UG-F': 'UG-F',
    'Hifz': 'Hifz'
};

async function updatePromotionToPGF() {
    console.log('=== UPDATING PROMOTION (D3 -> PG-F) FOR 2026-2027-Odd ===\n');

    const TARGET_TERM = '2026-2027-Odd';
    const studentsSnap = await getDocs(collection(db, 'students'));

    let updatedCount = 0;
    const newClassCounts = {};

    for (const docSnap of studentsSnap.docs) {
        const student = docSnap.data();
        if (student.isActive === false) continue;

        const history = { ...(student.academicHistory || {}) };
        
        // Use class from 2025-2026-Odd
        const prevClass = history['2025-2026-Odd']?.className || student.currentClass || student.className || 'Unknown';
        const promotedClass = PROMOTION_MAP[prevClass] || prevClass;

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

        newClassCounts[promotedClass] = (newClassCounts[promotedClass] || 0) + 1;
        updatedCount++;
    }

    console.log(`\nNew Student Count per Class in ${TARGET_TERM}:`);
    Object.entries(newClassCounts).sort().forEach(([cls, count]) => {
        console.log(`   ${cls}: ${count} students`);
    });
}

updatePromotionToPGF().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
