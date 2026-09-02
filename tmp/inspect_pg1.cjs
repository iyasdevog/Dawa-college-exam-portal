const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc, updateDoc } = require('firebase/firestore');

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

async function inspectPG1() {
    console.log('=== INSPECTING PG1 CLASS IN FIRESTORE ===\n');

    // 1. Settings
    const settingsSnap = await getDoc(doc(db, 'settings', 'global_admin_settings'));
    if (settingsSnap.exists()) {
        const s = settingsSnap.data();
        console.log(`Settings: disabledClasses = [${(s.disabledClasses || []).join(', ')}]`);
        console.log(`Settings: customClasses   = [${(s.customClasses || []).join(', ')}]`);
    }

    // 2. Active Students with PG1 in 2026-2027-Odd or currentClass
    const studentsSnap = await getDocs(collection(db, 'students'));
    let pg1Count = 0;

    studentsSnap.docs.forEach(docSnap => {
        const st = docSnap.data();
        if (st.isActive !== false) {
            const termCls = st.academicHistory?.['2026-2027-Odd']?.className;
            if (st.currentClass === 'PG1' || termCls === 'PG1') {
                pg1Count++;
                console.log(`Active PG1 Student [${st.adNo}] ${st.name} | currentClass: ${st.currentClass} | 2026-2027-Odd class: ${termCls}`);
            }
        }
    });

    console.log(`\nActive students with PG1: ${pg1Count}`);
}

inspectPG1().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
