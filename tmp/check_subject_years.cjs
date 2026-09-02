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

async function checkSubjectAcademicYears() {
    console.log('=== CHECKING SUBJECT ACADEMIC YEARS ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    console.log(`Total subjects in catalog: ${subjectsSnap.docs.length}`);

    const yearCounts = {};
    subjectsSnap.docs.forEach(docSnap => {
        const sub = docSnap.data();
        const y = sub.academicYear || 'MISSING / EMPTY';
        yearCounts[y] = (yearCounts[y] || 0) + 1;
    });

    console.log('\nSubject count per academicYear:');
    Object.entries(yearCounts).forEach(([y, count]) => {
        console.log(`   "${y}": ${count} subjects`);
    });
}

checkSubjectAcademicYears().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
