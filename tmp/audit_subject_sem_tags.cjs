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

async function auditSubjectSemesterTags() {
    console.log('\n=== SUBJECT SEMESTER TAG AUDIT ===\n');

    const snap = await getDocs(collection(db, 'subjects'));
    const subjects = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const byYear = {};
    const bySem = { Odd: [], Even: [], Both: [], unset: [] };

    subjects.forEach(s => {
        const year = s.academicYear || 'UNSET';
        const sem = s.activeSemester || 'UNSET';
        if (!byYear[year]) byYear[year] = { Odd: 0, Even: 0, Both: 0, unset: 0 };
        
        if (sem === 'Odd') { byYear[year].Odd++; bySem.Odd.push(s); }
        else if (sem === 'Even') { byYear[year].Even++; bySem.Even.push(s); }
        else if (sem === 'Both') { byYear[year].Both++; bySem.Both.push(s); }
        else { byYear[year].unset++; bySem.unset.push(s); }
    });

    console.log('TOTAL subjects:', subjects.length);
    console.log('\nBreakdown by academicYear + activeSemester:');
    console.dir(byYear, { depth: null });

    console.log('\n--- SUBJECTS TAGGED "BOTH SEM" (will leak into EVERY semester) ---');
    bySem.Both.forEach(s => {
        console.log(`  [${s.academicYear || 'NO-YEAR'}] ${s.activeSemester} | "${s.name}" → classes: [${(s.targetClasses||[]).join(', ')}]`);
    });

    console.log('\n--- SUBJECTS WITH NO activeSemester (treated as Both — also leak) ---');
    bySem.unset.forEach(s => {
        console.log(`  [${s.academicYear || 'NO-YEAR'}] ${s.activeSemester} | "${s.name}" → classes: [${(s.targetClasses||[]).join(', ')}]`);
    });

    // Simulate what getAllSubjects returns for each term
    const terms = ['2025-2026-Odd', '2025-2026-Even', '2026-2027-Odd'];
    console.log('\n--- SIMULATED getAllSubjects() COUNT PER TERM ---');
    for (const termKey of terms) {
        const lastHyphenIndex = termKey.lastIndexOf('-');
        const targetYear = termKey.substring(0, lastHyphenIndex);
        const targetSem = termKey.substring(lastHyphenIndex + 1);

        const result = subjects.filter(s => {
            const subjectYear = s.academicYear;
            if (subjectYear && subjectYear !== 'All' && targetYear && subjectYear !== targetYear) return false;
            if (!s.activeSemester || s.activeSemester === 'Both') return true;
            return s.activeSemester === targetSem;
        });

        console.log(`  "${termKey}": ${result.length} subjects returned`);
        const bothCount = result.filter(s => s.activeSemester === 'Both' || !s.activeSemester).length;
        const correctCount = result.filter(s => s.activeSemester === targetSem).length;
        console.log(`    → ${correctCount} correct semester | ${bothCount} "Both"/unset leaking in`);
    }
}

auditSubjectSemesterTags().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
