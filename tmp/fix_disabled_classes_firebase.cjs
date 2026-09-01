const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal",
    storageBucket: "my-edumark-portal.firebasestorage.app",
    messagingSenderId: "445255012917",
    appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c",
    measurementId: "G-LLMWHDTZ1T"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixDisabledClasses() {
    console.log('Clearing invalid disabledClasses in Firestore global_admin_settings...');
    const ref = doc(db, 'settings', 'global_admin_settings');
    const snap = await getDoc(ref);

    if (snap.exists()) {
        const data = snap.data();
        console.log('Current disabledClasses:', data.disabledClasses);
        await updateDoc(ref, {
            disabledClasses: [] // Reset disabled classes so D1, P1, P2, etc. are all enabled
        });
        console.log('Successfully cleared disabledClasses! D1 and all classes are now ENABLED.');
    } else {
        console.log('global_admin_settings doc not found');
    }
}

fixDisabledClasses().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
