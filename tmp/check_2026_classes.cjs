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

async function check2026Classes() {
    console.log('=== CHECKING STUDENTS IN 2026-2027-Odd ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));

    const classCounts = {};
    studentsSnap.docs.forEach(docSnap => {
        const student = docSnap.data();
        const termData = student.academicHistory?.['2026-2027-Odd'];
        if (termData) {
            const cls = termData.className || 'NO_CLASS';
            classCounts[cls] = (classCounts[cls] || 0) + 1;
        }
    });

    console.log('Students count per class in 2026-2027-Odd:');
    Object.entries(classCounts).sort().forEach(([cls, count]) => {
        console.log(`   ${cls}: ${count} students`);
    });
}

check2026Classes().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
