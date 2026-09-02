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

// EXPLICIT PROMOTION MAP:
// Only HS3 -> UG-F, D1 -> D2, D2 -> D3, D3 -> PG-F are promoted.
// All other classes stay in the SAME class!
const PROMOTION_MAP = {
    'FS1': 'FS1',
    'FS2': 'FS2',
    'FS3': 'FS3',
    'HS1': 'HS1',
    'HS2': 'HS2',
    'HS3': 'UG-F', // Promoted to UG Foundation
    'D1':  'D2',   // Promoted
    'D2':  'D3',   // Promoted
    'D3':  'PG-F', // Promoted
    'PG1': 'PG1',  // Remains same
    'PG-F': 'PG-F',
    'UG-F': 'UG-F',
    'Hifz': 'Hifz'
};

async function applyExactPromotionRules() {
    console.log('=== APPLYING EXPLICIT PROMOTION RULES FOR 2026-2027-Odd ===\n');

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

    console.log(`Exact Student Count per Class for ${TARGET_TERM}:`);
    Object.entries(counts).sort().forEach(([c, n]) => {
        console.log(`   ${c}: ${n} students`);
    });
}

applyExactPromotionRules().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
