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

async function testProcessedStudents2026() {
    console.log('=== TESTING PROCESSED STUDENTS FOR 2026-2027-Odd ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const termKey = '2026-2027-Odd';

    const counts = {};
    studentsSnap.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.isDeleted) return;

        const termData = data.academicHistory?.[termKey];
        const cls = termData?.className || data.currentClass || data.className || 'Unknown';
        counts[cls] = (counts[cls] || 0) + 1;
    });

    console.log(`Processed Student Counts per Class for ${termKey}:`);
    Object.entries(counts).sort().forEach(([c, n]) => {
        console.log(`   ${c}: ${n} students`);
    });
}

testProcessedStudents2026().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
