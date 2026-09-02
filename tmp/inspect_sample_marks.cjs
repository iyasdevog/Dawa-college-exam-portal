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

async function inspectStudentMarks() {
    console.log('=== INSPECTING SAMPLE STUDENT MARKS IN ODD VS EVEN ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subMap = new Map(subjectsSnap.docs.map(d => [d.id, d.data().name]));

    let sampleCount = 0;
    studentsSnap.docs.forEach(doc => {
        const s = doc.data();
        const oddMarks = s.academicHistory?.['2025-2026-Odd']?.marks || {};
        const evenMarks = s.academicHistory?.['2025-2026-Even']?.marks || {};

        if (Object.keys(oddMarks).length > 0 && Object.keys(evenMarks).length > 0 && sampleCount < 5) {
            sampleCount++;
            console.log(`Student: ${s.name} (AdNo: ${s.adNo}, Class: ${s.className || s.currentClass})`);
            console.log('  --- 2025-2026-Odd Marks ---');
            Object.entries(oddMarks).forEach(([subId, mark]) => {
                console.log(`    ${subMap.get(subId) || subId}: Total=${mark.total}, INT=${mark.int}, EXT=${mark.ext}`);
            });
            console.log('  --- 2025-2026-Even Marks ---');
            Object.entries(evenMarks).forEach(([subId, mark]) => {
                console.log(`    ${subMap.get(subId) || subId}: Total=${mark.total}, INT=${mark.int}, EXT=${mark.ext}`);
            });
            console.log('');
        }
    });
}

inspectStudentMarks().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
