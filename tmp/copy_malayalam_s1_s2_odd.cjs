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

async function copyMalayalamS1S2ToOdd() {
    console.log('=== COPYING MALAYALAM MARKS FOR S1 & S2 TO 2025-2026-ODD ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ ref: d.ref, id: d.id, ...d.data() }));

    let batch = writeBatch(db);
    let count = 0;
    let totalUpdated = 0;

    // 1. S1 (FS2) Students -> Malayalam D5ZEMWpBGGhGvESByu4l
    const s1Students = students.filter(s => ['FS2','S1','FS1'].includes(s.className || s.currentClass));
    console.log(`Processing ${s1Students.length} S1 (FS2) students...`);

    s1Students.forEach(st => {
        const history = JSON.parse(JSON.stringify(st.academicHistory || {}));
        const evenMalMark = history['2025-2026-Even']?.marks?.['D5ZEMWpBGGhGvESByu4l'] || history['2025-2026-Even']?.marks?.['Kogdr0NtmlAEQR6WiUCw'];
        
        if (evenMalMark) {
            if (!history['2025-2026-Odd']) history['2025-2026-Odd'] = { marks: {} };
            if (!history['2025-2026-Odd'].marks) history['2025-2026-Odd'].marks = {};

            if (!history['2025-2026-Odd'].marks['D5ZEMWpBGGhGvESByu4l']) {
                history['2025-2026-Odd'].marks['D5ZEMWpBGGhGvESByu4l'] = evenMalMark;
                batch.update(st.ref, { academicHistory: history });
                count++;
                totalUpdated++;
                console.log(`  S1 Student ${st.adNo} (${st.name}): Malayalam = ${evenMalMark.total}`);
            }
        }
    });

    // 2. S2 (FS3) Students -> Malayalam Kogdr0NtmlAEQR6WiUCw
    const s2Students = students.filter(s => ['FS3','S2','Hifz'].includes(s.className || s.currentClass));
    console.log(`\nProcessing ${s2Students.length} S2 (FS3) students...`);

    s2Students.forEach(st => {
        const history = JSON.parse(JSON.stringify(st.academicHistory || {}));
        const evenMalMark = history['2025-2026-Even']?.marks?.['Kogdr0NtmlAEQR6WiUCw'] || history['2025-2026-Even']?.marks?.['D5ZEMWpBGGhGvESByu4l'];

        if (evenMalMark) {
            if (!history['2025-2026-Odd']) history['2025-2026-Odd'] = { marks: {} };
            if (!history['2025-2026-Odd'].marks) history['2025-2026-Odd'].marks = {};

            if (!history['2025-2026-Odd'].marks['Kogdr0NtmlAEQR6WiUCw']) {
                history['2025-2026-Odd'].marks['Kogdr0NtmlAEQR6WiUCw'] = evenMalMark;
                batch.update(st.ref, { academicHistory: history });
                count++;
                totalUpdated++;
                console.log(`  S2 Student ${st.adNo} (${st.name}): Malayalam = ${evenMalMark.total}`);
            }
        }
    });

    if (count > 0) {
        await batch.commit();
        console.log(`\n✅ Successfully committed ${totalUpdated} Malayalam mark updates to Firestore!`);
    } else {
        console.log('\nNo updates needed.');
    }
}

copyMalayalamS1S2ToOdd().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
