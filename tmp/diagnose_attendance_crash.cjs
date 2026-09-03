const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

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

async function diagnose() {
    console.log('\n=== FULL ATTENDANCE PORTAL CRASH DIAGNOSIS ===\n');

    // 1. Check what academic years exist in subjects
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    console.log('--- SUBJECTS BY ACADEMIC YEAR & SEMESTER ---');
    const subjectMap = {};
    allSubjects.forEach(s => {
        const key = `${s.academicYear || 'NONE'}-${s.activeSemester || 'NONE'}`;
        subjectMap[key] = (subjectMap[key] || 0) + 1;
    });
    Object.entries(subjectMap).sort().forEach(([k, v]) => console.log(`  [${k}]: ${v} subjects`));

    // 2. Check timetable entries
    const ttSnap = await getDocs(collection(db, 'timetable'));
    const allTT = ttSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log('\n--- TIMETABLE ENTRIES BY ACADEMIC YEAR ---');
    const ttMap = {};
    allTT.forEach(t => {
        const key = t.academicYear || 'NONE';
        ttMap[key] = (ttMap[key] || 0) + 1;
    });
    Object.entries(ttMap).sort().forEach(([k, v]) => console.log(`  [${k}]: ${v} entries`));

    // 3. Check attendance collection structure
    const attSnap = await getDocs(collection(db, 'attendance'));
    const allAtt = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log('\n--- ATTENDANCE RECORDS BY ACADEMICYEAR-SEMESTER ---');
    const attMap = {};
    allAtt.forEach(a => {
        const key = `${a.academicYear || 'NONE'}-${a.semester || 'NONE'}`;
        attMap[key] = (attMap[key] || 0) + 1;
    });
    Object.entries(attMap).sort().forEach(([k, v]) => console.log(`  [${k}]: ${v} records`));

    // 4. Check the single 2026-2027-Odd attendance record
    const oddAtt = allAtt.filter(a => a.academicYear === '2026-2027' && a.semester === 'Odd');
    if (oddAtt.length > 0) {
        console.log('\n--- 2026-2027-Odd ATTENDANCE RECORD SAMPLE ---');
        console.log(JSON.stringify(oddAtt[0], null, 2));
    }

    // 5. Check global settings to see activeTerm
    const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
    if (settingsDoc.exists()) {
        const s = settingsDoc.data();
        console.log('\n--- GLOBAL SETTINGS ---');
        console.log(`  activeTerm: ${s.activeTerm}`);
        console.log(`  activeYear: ${s.activeYear}`);
        console.log(`  activeSemester: ${s.activeSemester}`);
        console.log(`  minAttendancePercentage: ${s.minAttendancePercentage}`);
    }

    // 6. Check student academic histories for 2026-2027-Odd
    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const termKey = '2026-2027-Odd';
    const termStudents = allStudents.filter(s => s.academicHistory?.[termKey]);
    console.log(`\n--- STUDENTS IN ${termKey}: ${termStudents.length} ---`);
    
    // Check how the academicHistory[termKey] is structured
    if (termStudents.length > 0) {
        const sample = termStudents[0];
        const hist = sample.academicHistory[termKey];
        console.log(`Sample: "${sample.name}" -> className: "${hist.className}", marks keys: [${Object.keys(hist.marks || {}).join(', ')}]`);
    }

    // 7. Check how getStudentByAdNo works for 2026-2027-Odd term
    console.log('\n--- STUDENT CLASS NAMES IN 2026-2027-Odd ---');
    const classCount = {};
    termStudents.forEach(s => {
        const cls = s.academicHistory[termKey]?.className || 'NONE';
        classCount[cls] = (classCount[cls] || 0) + 1;
    });
    Object.entries(classCount).sort().forEach(([k, v]) => console.log(`  ${k}: ${v} students`));

    // 8. Check SYSTEM_CLASSES vs what classes exist in timetable for 2026-2027
    const tt2026 = allTT.filter(t => t.academicYear === '2026-2027');
    console.log('\n--- TIMETABLE CLASSES FOR 2026-2027 ---');
    const ttClasses = new Set(tt2026.map(t => t.className));
    console.log(`  Classes: [${Array.from(ttClasses).sort().join(', ')}]`);

    // 9. Check getClassesByTerm - how does it work?
    // getClassesByTerm queries subjects for targetClasses - but if 0 subjects exist for 2026-2027-Odd, this returns nothing
    const classes20262027Odd = [];
    allSubjects.filter(s => s.academicYear === '2026-2027' && s.activeSemester === 'Odd').forEach(s => {
        (s.targetClasses || []).forEach(c => classes20262027Odd.push(c));
    });
    const uniqueClasses = Array.from(new Set(classes20262027Odd)).sort();
    console.log(`\n--- CLASSES FROM 2026-2027-Odd SUBJECTS: [${uniqueClasses.join(', ')}] ---`);
    if (uniqueClasses.length === 0) {
        console.log('  ⚠️  No subjects for 2026-2027-Odd -> getClassesByTerm returns [] -> PublicAttendance falls back to SYSTEM_CLASSES constant');
        console.log('  ⚠️  But getTimetableByDay for 2026-2027-Odd returns nothing because timetable has 0 entries for this term');
        console.log('  ⚠️  And getSubjectsByClass for 2026-2027-Odd returns [] for any class');
        console.log('\n  ROOT CAUSE: 2026-2027-Odd has NO subjects and NO timetable set up yet.');
        console.log('  The portal doesnt crash in theory - it shows empty. Check if the crash is a different error.');
    }

    // 10. Check getAttendanceByClassAndDate for 2026-2027-Odd - does it filter by term?
    console.log('\n--- ATTENDANCE QUERY ANALYSIS ---');
    console.log('  getAttendanceByClassAndDate() - check if it filters by activeTerm or just class+date...');
}

diagnose().then(() => process.exit(0)).catch(err => { console.error('CRASH:', err); process.exit(1); });
