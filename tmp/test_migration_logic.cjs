const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

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

async function testMigrationLogic() {
    console.log('=== TESTING PERMANENT TERM FIX & ELECTIVE MIGRATION LOGIC ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    console.log(`Total subjects in catalog: ${subjects.length}`);

    // 1. Identify subjects requiring activeSemester: 'Both'
    const bothSubjects = [];
    subjects.forEach(s => {
        const sem = s.activeSemester || 'Both';
        // Subjects set to 'Even' or 'Odd' that are general multi-term subjects or have marks in both terms
        const multiTermNames = [
            'manthiq', 'doura', 'fiqh', 'arabic', 'nahv', 'it', 'english',
            'communicative arabic', 'hadeeth', 'balaga', "ma'ani", 'النحو الواضح',
            'basic english', 'communicative english', 'life skills', 'thajweed', 'sarf'
        ];
        const lowerName = (s.name || '').toLowerCase();
        if (multiTermNames.some(m => lowerName.includes(m)) && sem !== 'Both') {
            bothSubjects.push({ id: s.id, name: s.name, currentSem: sem });
        }
    });

    console.log(`Subjects to restore to activeSemester: 'Both' (${bothSubjects.length}):`);
    bothSubjects.forEach(s => console.log(`  - [${s.id}] "${s.name}" (was: ${s.currentSem})`));

    // 2. Identify Elective Subjects needing subjectType: 'elective' & updated targetClasses
    const basicEng = subjects.find(s => s.id === 'ZT9XwBTEeSP7rOe2x8ik');
    const commEng = subjects.find(s => s.id === 't34laHHb8z8OsOGje6fl');

    console.log('\nElective Subject updates:');
    if (basicEng) {
        console.log(`  - Basic English [${basicEng.id}]: set subjectType='elective', targetClasses=['FS2','S1','FS3','S2','HS2','P1'], activeSemester='Both'`);
    }
    if (commEng) {
        console.log(`  - Communicative English [${commEng.id}]: set subjectType='elective', targetClasses=['FS2','S1','FS3','S2','HS2','P1'], activeSemester='Both'`);
    }

    // 3. Check FS2 students Even English marks re-mapping
    const studentsSnap = await getDocs(collection(db, 'students'));
    const fs2Students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => (s.className || s.currentClass) === 'FS2');

    console.log(`\nFS2 Students Even Marks Re-mapping check (${fs2Students.length} students):`);
    let remappedToBasic = 0;
    let remappedToComm = 0;
    let unmappedCount = 0;

    const basicEngEnrolled = new Set(basicEng?.enrolledStudents || []);
    const commEngEnrolled = new Set(commEng?.enrolledStudents || []);

    fs2Students.forEach(st => {
        const evenMarks = st.academicHistory?.['2025-2026-Even']?.marks || {};
        const genEngMark = evenMarks['wfsl5eUpE4E6nn0G1oqb'];

        if (genEngMark) {
            if (basicEngEnrolled.has(st.id)) {
                remappedToBasic++;
                console.log(`  - Student [${st.adNo}] ${st.name} -> Basic English (${genEngMark.total})`);
            } else if (commEngEnrolled.has(st.id)) {
                remappedToComm++;
                console.log(`  - Student [${st.adNo}] ${st.name} -> Communicative English (${genEngMark.total})`);
            } else {
                unmappedCount++;
                console.log(`  - Student [${st.adNo}] ${st.name} -> UNMAPPED (not in either elective enrollment list)`);
            }
        }
    });

    console.log(`\nRe-mapping summary: ${remappedToBasic} to Basic English, ${remappedToComm} to Communicative English, ${unmappedCount} unmapped.`);
}

testMigrationLogic().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
