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

async function inspectFS2EvenFirestore() {
    console.log('=== INSPECTING FS2 STUDENTS FIRESTORE DATA FOR EVEN SEMESTER ===\n');

    const snap = await getDocs(collection(db, 'students'));
    const fs2Students = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => ['FS2', 'S1'].includes(s.className || s.currentClass) && !s.isDeleted);

    console.log(`Found ${fs2Students.length} active FS2 students in Firestore:\n`);

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    fs2Students.slice(0, 5).forEach(st => {
        console.log(`Student Adm ${st.adNo} (${st.name}):`);
        console.log(`  className: "${st.className}", currentClass: "${st.currentClass}"`);
        const history = st.academicHistory || {};
        console.log(`  academicHistory keys:`, Object.keys(history));
        Object.keys(history).forEach(tk => {
            const termObj = history[tk] || {};
            const marks = termObj.marks || {};
            console.log(`    Term [${tk}] (${Object.keys(marks).length} marks):`);
            Object.keys(marks).forEach(subId => {
                const sub = subjects.find(x => x.id === subId);
                const meta = termObj.subjectMetadata?.[subId];
                console.log(`      [${subId}] "${sub ? sub.name : meta?.name || 'UNKNOWN'}" = ${JSON.stringify(marks[subId])}`);
            });
        });
        console.log('');
    });
}

inspectFS2EvenFirestore().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
