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

async function checkFinalRoster() {
    const studentsSnap = await getDocs(collection(db, 'students'));
    const termKey = '2026-2027-Odd';
    const counts = {};
    studentsSnap.docs.forEach(d => {
        const st = d.data();
        const cls = st.academicHistory?.[termKey]?.className || st.currentClass;
        counts[cls] = (counts[cls] || 0) + 1;
    });

    console.log('Final Student Count per Class for 2026-2027-Odd:');
    Object.entries(counts).sort().forEach(([c, n]) => {
        console.log(`   ${c}: ${n} students`);
    });
}

checkFinalRoster().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
