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

const SYSTEM_CLASSES = ['FS1', 'FS2', 'FS3', 'HS1', 'HS2', 'HS3', 'D1', 'D2', 'D3', 'PG-F', 'UG-F', 'Hifz'];

async function testFinalClassDiscovery() {
    console.log('=== TEST FINAL CLASS DISCOVERY FOR 2026-2027-Odd ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const termKey = '2026-2027-Odd';

    const activeClassesSet = new Set(SYSTEM_CLASSES);

    studentsSnap.docs.forEach(docSnap => {
        const st = docSnap.data();
        if (st.isActive !== false) {
            const cls = st.academicHistory?.[termKey]?.className || st.currentClass;
            if (cls && cls !== 'Graduated') {
                activeClassesSet.add(cls);
            }
        }
    });

    const finalClasses = Array.from(activeClassesSet).sort();
    console.log('Discovered Active Classes:', finalClasses);
    console.log(`Contains PG1? ${finalClasses.includes('PG1') ? 'YES ❌' : 'NO ✅'}`);
    console.log(`Contains PG-F? ${finalClasses.includes('PG-F') ? 'YES ✅' : 'NO ❌'}`);
}

testFinalClassDiscovery().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
