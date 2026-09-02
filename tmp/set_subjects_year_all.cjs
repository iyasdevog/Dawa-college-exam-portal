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

async function setSubjectsAcademicYearAll() {
    console.log('=== SETTING SUBJECTS ACADEMIC YEAR TO "All" ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    let updated = 0;

    for (const docSnap of subjectsSnap.docs) {
        await updateDoc(docSnap.ref, { academicYear: 'All' });
        updated++;
    }

    console.log(`✅ Set academicYear="All" on ${updated} subjects in Firestore.`);
}

setSubjectsAcademicYearAll().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
