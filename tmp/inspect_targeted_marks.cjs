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

async function inspectTargetedStudents() {
    const studentsSnap = await getDocs(collection(db, 'students'));
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log('=== INSPECTING CURRENT FIRESTORE MARK KEYS FOR D1/D2/D3, P1/HS2, S1/FS2 ===\n');

    // 1. D1 / D2 / D3 English marks
    console.log('--- D1 / D2 / D3 STUDENTS ENGLISH MARKS ---');
    const dStudents = students.filter(s => ['D1','D2','D3'].includes(s.className || s.currentClass));
    dStudents.slice(0, 5).forEach(st => {
        const history = st.academicHistory?.['2025-2026-Odd']?.marks || {};
        console.log(`Student ${st.adNo} (${st.name}, class=${st.className}):`);
        Object.keys(history).forEach(k => {
            const sub = subjects.find(x => x.id === k);
            if (sub?.name.toUpperCase().includes('ENGLISH')) {
                console.log(`  English Mark Key [${k}] "${sub.name}" (type=${sub.subjectType}) = ${history[k]?.total}`);
            }
        });
    });

    // 2. P1 / HS2 Arabic marks
    console.log('\n--- P1 / HS2 STUDENTS ARABIC MARKS ---');
    const p1Students = students.filter(s => ['P1','HS2'].includes(s.className || s.currentClass));
    p1Students.slice(0, 5).forEach(st => {
        const history = st.academicHistory?.['2025-2026-Odd']?.marks || {};
        console.log(`Student ${st.adNo} (${st.name}, class=${st.className}):`);
        Object.keys(history).forEach(k => {
            const sub = subjects.find(x => x.id === k);
            if (sub?.name.toLowerCase().includes('arabic') || sub?.name.includes('عرب')) {
                console.log(`  Arabic Mark Key [${k}] "${sub.name}" (type=${sub.subjectType}) = ${history[k]?.total}`);
            }
        });
    });

    // 3. S1 / FS2 Malayalam marks
    console.log('\n--- S1 / FS2 STUDENTS MALAYALAM MARKS ---');
    const s1Students = students.filter(s => ['S1','FS2'].includes(s.className || s.currentClass));
    s1Students.slice(0, 5).forEach(st => {
        const history = st.academicHistory?.['2025-2026-Odd']?.marks || {};
        console.log(`Student ${st.adNo} (${st.name}, class=${st.className}):`);
        Object.keys(history).forEach(k => {
            const sub = subjects.find(x => x.id === k);
            if (sub?.name.toLowerCase().includes('malayalam')) {
                console.log(`  Malayalam Mark Key [${k}] "${sub.name}" (type=${sub.subjectType}) = ${history[k]?.total}`);
            }
        });
    });
}

inspectTargetedStudents().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
