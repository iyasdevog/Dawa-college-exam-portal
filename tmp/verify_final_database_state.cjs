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

async function verifyFinalDatabaseState() {
    console.log('=== VERIFYING FINAL DATABASE STATE ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const basicEng = subjects.find(s => s.id === 'ZT9XwBTEeSP7rOe2x8ik');
    const commEng = subjects.find(s => s.id === 't34laHHb8z8OsOGje6fl');

    console.log('1. Basic English Catalog Document:');
    console.log('   ID:', basicEng.id);
    console.log('   Name:', basicEng.name);
    console.log('   subjectType:', basicEng.subjectType);
    console.log('   activeSemester:', basicEng.activeSemester);
    console.log('   targetClasses:', basicEng.targetClasses);

    console.log('\n2. Communicative English Catalog Document:');
    console.log('   ID:', commEng.id);
    console.log('   Name:', commEng.name);
    console.log('   subjectType:', commEng.subjectType);
    console.log('   activeSemester:', commEng.activeSemester);
    console.log('   targetClasses:', commEng.targetClasses);

    const studentsSnap = await getDocs(collection(db, 'students'));
    const fs2Students = studentsSnap.docs.map(d => d.data()).filter(s => (s.className || s.currentClass) === 'FS2');

    console.log(`\n3. Checking FS2 Students Even Marks (${fs2Students.length} students):`);
    let basicCount = 0;
    let commCount = 0;

    fs2Students.forEach(st => {
        const evenMarks = st.academicHistory?.['2025-2026-Even']?.marks || {};
        if (evenMarks['ZT9XwBTEeSP7rOe2x8ik']) {
            basicCount++;
            console.log(`   - [${st.adNo}] ${st.name} HAS Basic English mark (Total: ${evenMarks['ZT9XwBTEeSP7rOe2x8ik'].total})`);
        }
        if (evenMarks['t34laHHb8z8OsOGje6fl']) {
            commCount++;
            console.log(`   - [${st.adNo}] ${st.name} HAS Communicative English mark (Total: ${evenMarks['t34laHHb8z8OsOGje6fl'].total})`);
        }
    });

    console.log(`\nFS2 Summary: ${basicCount} students have Basic English marks in Even, ${commCount} students have Communicative English marks in Even.`);
}

verifyFinalDatabaseState().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
