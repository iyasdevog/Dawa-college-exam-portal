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

async function inspectP2Arabic() {
    console.log('=== INSPECTING P2 ARABIC MARKS IN FIRESTORE ===\n');

    const snap = await getDocs(collection(db, 'students'));
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const p2Students = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => ['HS3', 'P2'].includes(s.className || s.currentClass));

    console.log(`Found ${p2Students.length} P2 students:\n`);

    p2Students.forEach(st => {
        console.log(`Student ${st.adNo} - ${st.name}:`);
        const history = st.academicHistory || {};
        Object.keys(history).forEach(tk => {
            const marks = history[tk]?.marks || {};
            console.log(`  Term ${tk}:`);
            Object.keys(marks).forEach(subId => {
                const sub = subjects.find(x => x.id === subId);
                const meta = history[tk]?.subjectMetadata?.[subId];
                const name = (sub?.name || meta?.name || '').toLowerCase();
                if (name.includes('arabic') || name.includes('عرب') || subId === '0sqxyIEy00893p01q14D' || subId === '9p3liMeHUuuMMxoCRG60' || subId === 'c36I4lMYbFsEbfnXggbB') {
                    console.log(`    [${subId}] "${sub ? sub.name : meta?.name || 'UNKNOWN'}" (type=${sub ? sub.subjectType : '?'}) = ${marks[subId]?.total}`);
                }
            });
        });
        console.log('');
    });
}

inspectP2Arabic().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
