const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc } = require('firebase/firestore');

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

// The 9 PG1 students who graduated
const GRADUATED_ADM_NUMBERS = new Set(['12', '10', '13', '9', '4', '15', '2', '6', '5']);

async function markGraduatedStudents() {
    console.log('=== MARKING GRADUATED PG1 STUDENTS AS INACTIVE / GRADUATED ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    let countGraduated = 0;

    for (const docSnap of studentsSnap.docs) {
        const student = docSnap.data();
        if (GRADUATED_ADM_NUMBERS.has(String(student.adNo))) {
            await updateDoc(docSnap.ref, {
                isActive: false,
                currentClass: 'Graduated'
            });
            console.log(`✅ Marked Student [${student.adNo}] ${student.name} as Graduated / Inactive.`);
            countGraduated++;
        }
    }

    console.log(`\nSummary: ${countGraduated} students marked as Graduated.`);

    // Verify remaining PG-F students
    const updatedSnap = await getDocs(collection(db, 'students'));
    const pgfActive = updatedSnap.docs
        .map(d => d.data())
        .filter(s => s.isActive !== false && (s.currentClass === 'PG-F' || s.academicHistory?.['2026-2027-Odd']?.className === 'PG-F'));

    console.log(`\nActive PG-F Students Count: ${pgfActive.length} (Expected: 16)`);
    pgfActive.forEach(st => {
        console.log(`   [${st.adNo}] ${st.name}`);
    });
}

markGraduatedStudents().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
