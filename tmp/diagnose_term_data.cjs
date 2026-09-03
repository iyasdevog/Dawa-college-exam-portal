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

async function diagnose() {
    console.log('\n=== SUBJECTS DIAGNOSIS ===');
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    
    console.log(`Total active subjects: ${subjects.length}`);
    
    // Group by academicYear + activeSemester
    const byYearSem = {};
    subjects.forEach(s => {
        const key = `${s.academicYear || 'NO_YEAR'} | sem=${s.activeSemester || 'NO_SEM'}`;
        byYearSem[key] = byYearSem[key] || [];
        byYearSem[key].push(`${s.name} -> [${(s.targetClasses||[]).join(', ')}]`);
    });
    
    console.log('\nSubjects by academicYear + activeSemester:');
    Object.entries(byYearSem).sort().forEach(([key, subs]) => {
        console.log(`\n  [${key}] (${subs.length} subjects):`);
        subs.forEach(s => console.log(`    - ${s}`));
    });

    console.log('\n=== STUDENTS DIAGNOSIS (2025-2026-Odd history) ===');
    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    console.log(`Total active students: ${students.length}`);

    const oddTermKey = '2025-2026-Odd';
    const studentsWithOddHistory = students.filter(s => s.academicHistory?.[oddTermKey]);
    console.log(`Students with ${oddTermKey} history entry: ${studentsWithOddHistory.length}`);
    
    // Show first 5 with class and marks count
    studentsWithOddHistory.slice(0, 5).forEach(s => {
        const hist = s.academicHistory[oddTermKey];
        const markCount = hist?.marks ? Object.keys(hist.marks).length : 0;
        console.log(`  - ${s.name} | class=${hist?.className} | marks=${markCount}`);
    });

    // Check what other term keys exist in history
    const allTermKeys = new Set();
    students.forEach(s => {
        if (s.academicHistory) Object.keys(s.academicHistory).forEach(k => allTermKeys.add(k));
        if (s.termKey) allTermKeys.add(s.termKey);
    });
    console.log('\nAll term keys found in student academicHistory:', [...allTermKeys].sort());

    // Check top-level marks (legacy students)
    const legacyStudents = students.filter(s => s.marks && Object.keys(s.marks).length > 0 && (!s.academicHistory || Object.keys(s.academicHistory).length === 0));
    console.log(`\nLegacy students with top-level marks only: ${legacyStudents.length}`);
    legacyStudents.slice(0, 3).forEach(s => {
        console.log(`  - ${s.name} | termKey=${s.termKey} | class=${s.currentClass} | marks=${Object.keys(s.marks).length}`);
    });

    console.log('\n=== getClassesByTerm(2025-2026-Odd) SIMULATION ===');
    // What classes would be discovered for 2025-2026-Odd from students?
    const oddClasses = new Set();
    students.forEach(s => {
        const termClass = s.academicHistory?.[oddTermKey]?.className;
        if (termClass) oddClasses.add(termClass.trim());
    });
    console.log('Classes from student history for 2025-2026-Odd:', [...oddClasses].sort());
    
    // What classes from subjects (no year filter)?
    const oddSubjectClasses = new Set();
    subjects.forEach(s => {
        const sYear = s.academicYear || '';
        const isYearMatch = !sYear || sYear === 'All' || sYear === '2025-2026';
        const isSemMatch = !s.activeSemester || s.activeSemester === 'Both' || s.activeSemester === 'Odd';
        if (isYearMatch && isSemMatch && s.targetClasses) {
            s.targetClasses.forEach(c => { if (c && c !== '-') oddSubjectClasses.add(c.trim()); });
        }
    });
    console.log('Classes from subjects for 2025-2026-Odd (current logic):', [...oddSubjectClasses].sort());
}

diagnose().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
