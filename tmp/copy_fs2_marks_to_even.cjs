const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch } = require('firebase/firestore');

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

async function copyFS2MarksToEven() {
    console.log('=== POPULATING 2025-2026-EVEN FOR FS2 STUDENTS ===\n');

    const snap = await getDocs(collection(db, 'students'));
    const fs2Students = snap.docs
        .map(d => ({ ref: d.ref, id: d.id, ...d.data() }))
        .filter(s => ['FS2', 'S1'].includes(s.className || s.currentClass) && !s.isDeleted);

    console.log(`Processing ${fs2Students.length} active FS2 students...`);

    let batch = writeBatch(db);
    let count = 0;

    fs2Students.forEach(st => {
        const history = JSON.parse(JSON.stringify(st.academicHistory || {}));
        const oddMarks = history['2025-2026-Odd']?.marks || {};
        const oddMeta = history['2025-2026-Odd']?.subjectMetadata || {};

        if (Object.keys(oddMarks).length > 0) {
            if (!history['2025-2026-Even']) history['2025-2026-Even'] = { marks: {}, subjectMetadata: {} };
            if (!history['2025-2026-Even'].marks) history['2025-2026-Even'].marks = {};
            if (!history['2025-2026-Even'].subjectMetadata) history['2025-2026-Even'].subjectMetadata = {};

            let updated = false;
            Object.keys(oddMarks).forEach(subId => {
                if (!history['2025-2026-Even'].marks[subId]) {
                    history['2025-2026-Even'].marks[subId] = oddMarks[subId];
                    if (oddMeta[subId]) {
                        history['2025-2026-Even'].subjectMetadata[subId] = oddMeta[subId];
                    }
                    updated = true;
                }
            });

            if (updated) {
                batch.update(st.ref, { academicHistory: history });
                count++;
                console.log(`  Populated Even semester marks for Student Adm ${st.adNo} (${st.name})`);
            }
        }
    });

    if (count > 0) {
        await batch.commit();
        console.log(`\n✅ Successfully populated 2025-2026-Even marks for ${count} FS2 students!`);
    } else {
        console.log('\nNo updates needed.');
    }
}

copyFS2MarksToEven().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
