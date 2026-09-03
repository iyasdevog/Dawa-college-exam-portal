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

async function testElectiveColumnVisibility() {
    console.log('\n=== TESTING ELECTIVE COLUMN VISIBILITY PER CLASS (2025-2026-Odd) ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const liveSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    const studentsSnap = await getDocs(collection(db, 'students'));
    const liveStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const classes = ['S1', 'S2', 'P1', 'P2', 'D1', 'D2', 'D3', 'PG-F'];

    classes.forEach(className => {
        const classStudents = liveStudents.filter(s => {
            const hist = s.academicHistory ? s.academicHistory['2025-2026-Odd'] : null;
            return hist && hist.className && hist.className.trim().toLowerCase() === className.toLowerCase();
        });

        const hasAnyElectivesInClass = classStudents.some(st => {
            const hist = st.academicHistory['2025-2026-Odd'];
            const marksObj = hist.marks || {};
            const metaObj = hist.subjectMetadata || {};

            return Object.keys(marksObj).some(k => {
                const liveSub = liveSubjects.find(s => s.id === k);
                const snapshot = metaObj[k];
                const type = liveSub?.subjectType || snapshot?.subjectType;
                const m = marksObj[k];
                return type === 'elective' && !m?.isSupplementary && (m?.total > 0 || m?.int !== undefined || m?.ext !== undefined);
            });
        });

        console.log(`Class ${className.padEnd(5)} (${classStudents.length} students) -> Elective Column Visible? : ${hasAnyElectivesInClass ? 'YES' : 'NO (REMOVED)'}`);
    });
}

testElectiveColumnVisibility().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
