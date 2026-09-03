const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal",
    storageBucket: "my-edumark-portal.firebasestorage.app",
    messagingSenderId: "445255012917",
    appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c",
    measurementId: "G-LLMWHDTZ1T"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspectFs1Hs1InOdd() {
    console.log('\n=== INSPECTING FS1 & HS1 IN 2025-2026-Odd ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const fs1Hs1Students = students.filter(s => {
        const oddHist = s.academicHistory ? s.academicHistory['2025-2026-Odd'] : null;
        if (!oddHist) return false;
        const cls = (oddHist.className || '').trim();
        return cls === 'FS1' || cls === 'HS1';
    });

    console.log(`Found ${fs1Hs1Students.length} students with FS1/HS1 in 2025-2026-Odd:`);

    fs1Hs1Students.forEach(s => {
        const oddHist = s.academicHistory['2025-2026-Odd'];
        const markCount = oddHist.marks ? Object.keys(oddHist.marks).length : 0;
        console.log(`- Name: "${s.name}" | CurrentClass: "${s.currentClass}" | OddClass: "${oddHist.className}" | MarksInOdd: ${markCount}`);
    });
}

inspectFs1Hs1InOdd().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
