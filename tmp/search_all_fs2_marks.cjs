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

async function searchAllFS2Marks() {
    console.log('=== SEARCHING ALL MARKS FOR ALL FS2/S1 STUDENTS IN FIRESTORE ===\n');

    const snap = await getDocs(collection(db, 'students'));
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const fs2Students = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => ['FS2', 'S1'].includes(s.className || s.currentClass));

    console.log(`Checking ${fs2Students.length} FS2/S1 students...\n`);

    fs2Students.forEach(st => {
        const history = st.academicHistory || {};
        const topMarks = st.marks || {};

        console.log(`Student Adm ${st.adNo} (${st.name}) [docId: ${st.id}]:`);
        if (Object.keys(topMarks).length > 0) {
            console.log(`  Top-level marks:`, topMarks);
        }

        Object.keys(history).forEach(tk => {
            const termObj = history[tk] || {};
            const marks = termObj.marks || {};
            const keys = Object.keys(marks);
            if (keys.length > 0) {
                console.log(`  Term [${tk}] (${keys.length} marks):`);
                keys.forEach(subId => {
                    const sub = subjects.find(x => x.id === subId);
                    const meta = termObj.subjectMetadata?.[subId];
                    const name = sub ? sub.name : meta?.name || 'UNKNOWN';
                    console.log(`    [${subId}] "${name}" = ${JSON.stringify(marks[subId])}`);
                });
            }
        });
        console.log('');
    });
}

searchAllFS2Marks().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
