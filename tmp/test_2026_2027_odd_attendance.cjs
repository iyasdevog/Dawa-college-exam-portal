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

async function test20262027OddAttendance() {
    console.log('\n=== TESTING ATTENDANCE FOR 2026-2027-Odd TERM ===\n');

    const termKey = '2026-2027-Odd';

    console.log('1. Fetching students in 2026-2027-Odd...');
    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const termStudents = allStudents.filter(s => {
        const hist = s.academicHistory ? s.academicHistory[termKey] : null;
        return !!hist;
    });

    console.log(`Found ${termStudents.length} students with ${termKey} academic history!`);

    console.log('2. Fetching subjects for 2026-2027-Odd...');
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    const termSubjects = allSubjects.filter(s => s.academicYear === '2026-2027' && s.activeSemester === 'Odd');

    console.log(`Found ${termSubjects.length} subjects for ${termKey}:`);
    termSubjects.forEach(s => console.log(`  - [${s.id}] "${s.name}" (targets: [${(s.targetClasses||[]).join(',')}])`));

    console.log('\n3. Fetching attendance records...');
    const attSnap = await getDocs(collection(db, 'attendance'));
    const allAtt = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const termAtt = allAtt.filter(a => a.academicYear === '2026-2027' && a.semester === 'Odd');
    console.log(`Found ${termAtt.length} attendance records for ${termKey}.`);

    console.log('\n4. Testing StudentAttendancePortal search logic for student sample...');
    if (termStudents.length > 0) {
        const sampleStudent = termStudents[0];
        console.log(`Sample Student: "${sampleStudent.name}" (AdNo: ${sampleStudent.adNo})`);

        const hist = sampleStudent.academicHistory[termKey];
        console.log(`Student Class in ${termKey}: "${hist?.className}"`);

        // Check getDatabaseClassName / getHistoricalClassName
        const rawClass = hist?.className || sampleStudent.currentClass;
        console.log(`rawClass: "${rawClass}"`);
    } else {
        console.log('No students have 2026-2027-Odd academic history yet. Testing searching by AdNo for student with currentClass...');
        const sampleStudent = allStudents[0];
        console.log(`Sample Student: "${sampleStudent.name}" (AdNo: ${sampleStudent.adNo}, currentClass: ${sampleStudent.currentClass})`);
        
        const hist = sampleStudent.academicHistory ? sampleStudent.academicHistory[termKey] : null;
        console.log(`hist in ${termKey}:`, hist);
    }
}

test20262027OddAttendance().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
