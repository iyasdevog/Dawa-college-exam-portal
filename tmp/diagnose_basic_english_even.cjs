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

async function diagnoseBasicEnglishEven() {
    console.log('=== DIAGNOSING BASIC ENGLISH MARKS IN 2025-2026-EVEN ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const subjectsSnap = await getDocs(collection(db, 'subjects'));

    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log('--- ALL BASIC ENGLISH / ENGLISH SUBJECTS IN FIRESTORE ---');
    subjects.filter(s => (s.name || '').toLowerCase().includes('english')).forEach(s => {
        console.log(`Sub [${s.id}] "${s.name}"`);
        console.log(`  activeSemester: ${s.activeSemester}`);
        console.log(`  targetClasses:`, s.targetClasses);
        console.log(`  subjectType: ${s.subjectType}`);
    });

    console.log('\n--- STUDENTS WITH MARKS IN EVEN FOR ANY ENGLISH/BASIC ENGLISH SUBJECT ---');
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    students.forEach(st => {
        const evenMarks = st.academicHistory?.['2025-2026-Even']?.marks || {};
        const oddMarks = st.academicHistory?.['2025-2026-Odd']?.marks || {};

        Object.entries(evenMarks).forEach(([subId, mark]) => {
            const sub = subjects.find(s => s.id === subId);
            const subName = sub?.name || subId;
            if (subName.toLowerCase().includes('english')) {
                console.log(`Student [${st.adNo}] ${st.name} | Class: "${st.className || st.currentClass}" | Sub: "${subName}" (${subId}) | Even Total: ${mark.total}`);
            }
        });
    });

    console.log('\n--- CHECKING ALL FS2 / FS3 / S1 / S2 STUDENTS IN EVEN ---');
    const targetClasses = ['FS1', 'FS2', 'FS3', 'S1', 'S2', 'HS1', 'HS2', 'HS3', 'P1', 'P2'];
    targetClasses.forEach(cls => {
        const classStudents = students.filter(s => (s.className || s.currentClass) === cls);
        if (classStudents.length === 0) return;

        let studentsWithBasicEngEven = 0;
        let studentsWithAnyEngEven = 0;

        classStudents.forEach(st => {
            const evenMarks = st.academicHistory?.['2025-2026-Even']?.marks || {};
            Object.keys(evenMarks).forEach(subId => {
                const sub = subjects.find(s => s.id === subId);
                const subName = (sub?.name || '').toLowerCase();
                if (subName.includes('basic english')) studentsWithBasicEngEven++;
                if (subName.includes('english')) studentsWithAnyEngEven++;
            });
        });

        console.log(`Class "${cls}" (${classStudents.length} students): ${studentsWithBasicEngEven} have Basic English marks in Even, ${studentsWithAnyEngEven} have any English marks in Even.`);
    });
}

diagnoseBasicEnglishEven().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
