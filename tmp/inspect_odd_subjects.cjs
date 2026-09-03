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

async function inspectOddSubjects() {
    console.log('\n=== INSPECTING ALL SUBJECTS FOR 2025-2026-Odd ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const oddSemSubjects = subjects.filter(s => {
        const isYearMatch = !s.academicYear || s.academicYear === 'All' || s.academicYear === '2025-2026';
        const isSemMatch = !s.activeSemester || s.activeSemester === 'Both' || s.activeSemester === 'Odd';
        return isYearMatch && isSemMatch;
    });

    console.log(`Found ${oddSemSubjects.length} subjects matching 2025-2026-Odd:`);

    oddSemSubjects.forEach(s => {
        console.log(`- Subject ID: "${s.id}" | Name: "${s.name}" | activeSemester: "${s.activeSemester}" | targetClasses:`, s.targetClasses);
    });
}

inspectOddSubjects().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
