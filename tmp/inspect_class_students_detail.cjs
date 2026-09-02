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

async function inspectStudentClassesDetail() {
    console.log('=== DETAILED STUDENT CLASS BREAKDOWN (2026-2027-Odd) ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const termKey = '2026-2027-Odd';

    const classStudentsMap = {};

    studentsSnap.docs.forEach(docSnap => {
        const student = docSnap.data();
        const termData = student.academicHistory?.[termKey];
        const cls = termData?.className || student.currentClass || 'NO_CLASS';

        if (!classStudentsMap[cls]) classStudentsMap[cls] = [];
        classStudentsMap[cls].push({
            adNo: student.adNo,
            name: student.name,
            currentClass: student.currentClass,
            prev2025OddClass: student.academicHistory?.['2025-2026-Odd']?.className
        });
    });

    Object.keys(classStudentsMap).sort().forEach(cls => {
        const list = classStudentsMap[cls];
        console.log(`Class "${cls}" (${list.length} students):`);
        list.forEach(st => {
            console.log(`   [${st.adNo}] ${st.name} | prev 2025-Odd: ${st.prev2025OddClass || 'none'}`);
        });
        console.log('');
    });
}

inspectStudentClassesDetail().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
