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

async function verify() {
    console.log('=== VERIFYING FINAL DATABASE STATE ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const subjectsSnap = await getDocs(collection(db, 'subjects'));

    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const oddSubCount = subjects.filter(s => s.activeSemester === 'Odd').length;
    const evenSubCount = subjects.filter(s => s.activeSemester === 'Even').length;
    const bothSubCount = subjects.filter(s => s.activeSemester === 'Both').length;

    console.log(`Subjects Catalog:`);
    console.log(`  Odd semester subjects:  ${oddSubCount}`);
    console.log(`  Even semester subjects: ${evenSubCount}`);
    console.log(`  Both semester subjects: ${bothSubCount} (should be 0)`);

    let oddMarksStudents = 0;
    let evenMarksStudents = 0;
    let legacyStudents = 0;

    students.forEach(st => {
        const hist = st.academicHistory || {};
        if (hist['2025-2026-Odd']?.marks && Object.keys(hist['2025-2026-Odd'].marks).length > 0) {
            oddMarksStudents++;
        }
        if (hist['2025-2026-Even']?.marks && Object.keys(hist['2025-2026-Even'].marks).length > 0) {
            evenMarksStudents++;
        }
        if (st.marks && Object.keys(st.marks).length > 0) {
            legacyStudents++;
        }
    });

    console.log(`\nStudents Marks State across ${students.length} students:`);
    console.log(`  Students with 2025-2026-Odd marks:  ${oddMarksStudents}`);
    console.log(`  Students with 2025-2026-Even marks: ${evenMarksStudents} (should be 0 for fresh start)`);
    console.log(`  Students with legacy top-level marks: ${legacyStudents} (should be 0)`);
}

verify().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
