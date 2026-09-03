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

async function simulatePopulate() {
    console.log('\n=== SIMULATING SUBJECT CLONING FOR 2026-2027-Odd ===\n');

    const snap = await getDocs(collection(db, 'subjects'));
    const allSubjects = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    // 1. Identify 'All' year subjects to be fixed
    const allYearSubs = allSubjects.filter(s => s.academicYear === 'All');
    console.log(`Found ${allYearSubs.length} subjects with academicYear === 'All' to fix -> '2025-2026'.`);

    // 2. Identify subjects to clone for 2026-2027-Odd (subjects from 2025-2026 Even)
    const sourceEvenSubs = allSubjects.filter(s => 
        (s.academicYear === '2025-2026' || s.academicYear === 'All') && 
        (s.activeSemester === 'Even' || s.activeSemester === 'Both')
    );

    console.log(`Found ${sourceEvenSubs.length} Even-semester subjects to clone for 2026-2027-Odd.`);

    // Check target classes breakdown of cloned subjects
    const classCounts = {};
    sourceEvenSubs.forEach(s => {
        const classes = s.targetClasses || ['Unassigned'];
        classes.forEach(c => {
            classCounts[c] = (classCounts[c] || 0) + 1;
        });
    });

    console.log('\nProjected 2026-2027-Odd Subjects Count by Class:');
    console.table(classCounts);

    // Check if 2026-2027-Odd subjects already exist
    const existing2026Subs = allSubjects.filter(s => s.academicYear === '2026-2027' && s.activeSemester === 'Odd');
    console.log(`Currently existing 2026-2027-Odd subjects: ${existing2026Subs.length}`);
}

simulatePopulate().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
