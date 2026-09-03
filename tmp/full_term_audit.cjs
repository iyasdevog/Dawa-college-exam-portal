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

async function fullAudit() {
    console.log('\n============================================================');
    console.log('    FULL TERM-AWARENESS DATABASE AUDIT REPORT');
    console.log('============================================================\n');

    // ── SETTINGS ──
    const settingsSnap = await getDocs(collection(db, 'settings'));
    const settings = {};
    settingsSnap.docs.forEach(d => { settings[d.id] = d.data(); });
    const global = settings['global_admin_settings'] || {};
    console.log('[ SETTINGS ]');
    console.log(`  Current System Term : ${global.currentAcademicYear}-${global.currentSemester}`);
    console.log(`  Available Years     : ${(global.availableYears || []).join(', ') || 'NOT SET'}`);
    console.log(`  Custom Classes      : ${(global.customClasses || []).join(', ') || 'none'}`);
    console.log(`  Disabled Classes    : ${(global.disabledClasses || []).join(', ') || 'none'}`);
    console.log(`  All setting doc IDs : ${settingsSnap.docs.map(d => d.id).join(', ')}`);

    // ── SUBJECTS ──
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    console.log('\n[ SUBJECTS ]');
    console.log(`  Total active: ${subjects.length}`);
    const subYearDist = {};
    subjects.forEach(s => {
        const key = s.academicYear || 'UNSET';
        subYearDist[key] = (subYearDist[key] || 0) + 1;
    });
    console.log('  academicYear distribution:', subYearDist);

    const subSemDist = {};
    subjects.forEach(s => {
        const key = s.activeSemester || 'UNSET';
        subSemDist[key] = (subSemDist[key] || 0) + 1;
    });
    console.log('  activeSemester distribution:', subSemDist);

    // Collect all unique class names across all subjects
    const allSubjectClasses = new Set();
    subjects.forEach(s => (s.targetClasses || []).forEach(c => c && c !== '-' && allSubjectClasses.add(c)));
    console.log('  All unique targetClasses across all subjects:', [...allSubjectClasses].sort());

    // Subjects with old class names (S1, S2, P1, P2)
    const oldNames = ['S1', 'S2', 'P1', 'P2'];
    const subjectsWithOldNames = subjects.filter(s => (s.targetClasses || []).some(c => oldNames.includes(c)));
    console.log(`\n  Subjects still referencing OLD class names (S1/S2/P1/P2): ${subjectsWithOldNames.length}`);
    subjectsWithOldNames.forEach(s => {
        const old = (s.targetClasses || []).filter(c => oldNames.includes(c));
        console.log(`    - "${s.name}" [sem=${s.activeSemester}] oldClasses=[${old.join(',')}] allClasses=[${(s.targetClasses||[]).join(',')}]`);
    });

    // ── STUDENTS ──
    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    console.log('\n[ STUDENTS ]');
    console.log(`  Total active: ${students.length}`);

    // Term key distribution in academicHistory
    const termKeyDist = {};
    students.forEach(s => {
        if (s.academicHistory) {
            Object.keys(s.academicHistory).forEach(tk => {
                termKeyDist[tk] = (termKeyDist[tk] || 0) + 1;
            });
        }
    });
    console.log('  academicHistory term key distribution:');
    Object.entries(termKeyDist).sort().forEach(([tk, count]) => {
        console.log(`    ${tk}: ${count} students`);
    });

    // Students WITHOUT any academicHistory
    const noHistory = students.filter(s => !s.academicHistory || Object.keys(s.academicHistory).length === 0);
    console.log(`\n  Students with NO academicHistory at all: ${noHistory.length}`);
    noHistory.forEach(s => {
        const markCount = s.marks ? Object.keys(s.marks).length : 0;
        console.log(`    - ${s.name} | termKey=${s.termKey} | class=${s.currentClass} | topLevelMarks=${markCount}`);
    });

    // Students with 2025-2026-Odd: class distribution
    const oddKey = '2025-2026-Odd';
    const oddStudents = students.filter(s => s.academicHistory?.[oddKey]);
    const oddClassDist = {};
    oddStudents.forEach(s => {
        const cls = s.academicHistory[oddKey]?.className || 'UNSET';
        oddClassDist[cls] = (oddClassDist[cls] || 0) + 1;
    });
    console.log(`\n  2025-2026-Odd students class distribution:`);
    Object.entries(oddClassDist).sort().forEach(([cls, count]) => {
        console.log(`    ${cls}: ${count}`);
    });

    // Students with 2025-2026-Odd marks count
    const oddWithMarks = oddStudents.filter(s => {
        const marks = s.academicHistory[oddKey]?.marks || {};
        return Object.keys(marks).length > 0;
    });
    console.log(`  2025-2026-Odd students WITH actual marks: ${oddWithMarks.length}/${oddStudents.length}`);
    const oddNoMarks = oddStudents.filter(s => {
        const marks = s.academicHistory[oddKey]?.marks || {};
        return Object.keys(marks).length === 0;
    });
    console.log(`  2025-2026-Odd students WITH NO marks: ${oddNoMarks.length}`);

    // Check 2025-2026-Even
    const evenKey = '2025-2026-Even';
    const evenStudents = students.filter(s => s.academicHistory?.[evenKey]);
    console.log(`\n  2025-2026-Even students: ${evenStudents.length}`);
    if (evenStudents.length > 0) {
        const evenClassDist = {};
        evenStudents.forEach(s => {
            const cls = s.academicHistory[evenKey]?.className || 'UNSET';
            evenClassDist[cls] = (evenClassDist[cls] || 0) + 1;
        });
        Object.entries(evenClassDist).sort().forEach(([cls, count]) => {
            console.log(`    ${cls}: ${count}`);
        });
    }

    // Check 2026-2027-Odd (current term)
    const currKey = '2026-2027-Odd';
    const currStudents = students.filter(s => s.academicHistory?.[currKey]);
    console.log(`\n  2026-2027-Odd students: ${currStudents.length}`);
    const currClassDist = {};
    currStudents.forEach(s => {
        const cls = s.academicHistory[currKey]?.className || s.currentClass || 'UNSET';
        currClassDist[cls] = (currClassDist[cls] || 0) + 1;
    });
    Object.entries(currClassDist).sort().forEach(([cls, count]) => {
        console.log(`    ${cls}: ${count}`);
    });

    // Students in current system term NOT in any history
    const currentSystemTerm = `${global.currentAcademicYear}-${global.currentSemester}`;
    const studentsInCurrentButNoHistory = students.filter(s =>
        s.isActive !== false &&
        (!s.academicHistory || !Object.keys(s.academicHistory).some(tk =>
            tk === currentSystemTerm ||
            tk.replace(/^2025-/, '2025-2026-') === currentSystemTerm
        ))
    );
    console.log(`\n  Active students with NO history for current system term (${currentSystemTerm}): ${studentsInCurrentButNoHistory.length}`);

    // ── SUPPLEMENTARY ──
    const suppSnap = await getDocs(collection(db, 'supplementary_exams'));
    const supps = suppSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log('\n[ SUPPLEMENTARY EXAMS ]');
    console.log(`  Total: ${supps.length}`);
    const suppTermDist = {};
    supps.forEach(s => {
        const tk = s.termKey || s.activeTerm || 'UNSET';
        suppTermDist[tk] = (suppTermDist[tk] || 0) + 1;
    });
    console.log('  Term distribution:', suppTermDist);

    // ── RELEASE SETTINGS ──
    console.log('\n[ RELEASE SETTINGS DOCS ]');
    settingsSnap.docs.filter(d => d.id.startsWith('release_settings_')).forEach(d => {
        const data = d.data();
        console.log(`  ${d.id}:`, JSON.stringify(data).substring(0, 200));
    });

    // ── SUMMARY OF PROBLEMS ──
    console.log('\n============================================================');
    console.log('    STRUCTURAL PROBLEMS SUMMARY');
    console.log('============================================================');
    console.log(`
1. SUBJECTS have academicYear='All' — no year binding
   → Cannot distinguish 2025-2026 subjects from 2026-2027 subjects by year
   → Subjects use activeSemester=Odd/Even only for semester separation

2. SUBJECTS targetClasses contain a MIX of old (S1,P1,P2) and new (FS1,HS2) names
   → Old names were used in 2025-2026-Odd but many subjects now also list new names
   → This causes getClassesByTerm to mix class names from both naming schemes

3. STUDENTS academicHistory only has: ${Object.keys(termKeyDist).sort().join(', ')}
   → Missing 2025-2026-Even entirely if no Even semester marks were entered

4. Current system getAllStudents(historicalTerm) returns ALL active students
   → 2026-2027 students leak into 2025-2026-Odd views

5. getClassesByTerm uses BOTH student history AND subject targetClasses
   → Subject targetClasses include ALL class names from ALL time
   → Results in S1,S2,P1,P2 appearing in 2025-2026-Odd class filter
`);
}

fullAudit().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
