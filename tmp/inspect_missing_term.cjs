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

async function inspectAllStudentsHistory() {
    console.log('=== INSPECTING ALL 200 STUDENTS ACADEMIC HISTORY ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    console.log(`Total students in DB: ${studentsSnap.docs.length}`);

    let countWith2026_2027_Odd = 0;
    let countWithout2026_2027_Odd = 0;

    studentsSnap.docs.forEach(docSnap => {
        const student = docSnap.data();
        const history = student.academicHistory || {};
        const terms = Object.keys(history);

        if (history['2026-2027-Odd']) {
            countWith2026_2027_Odd++;
        } else {
            countWithout2026_2027_Odd++;
            console.log(`Student [${student.adNo}] ${student.name} | currentClass: ${student.currentClass || student.className} | terms: [${terms.join(', ')}]`);
        }
    });

    console.log(`\nSummary:`);
    console.log(`   Students WITH 2026-2027-Odd: ${countWith2026_2027_Odd}`);
    console.log(`   Students WITHOUT 2026-2027-Odd: ${countWithout2026_2027_Odd}`);
}

inspectAllStudentsHistory().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
