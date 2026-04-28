import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkSettings() {
    const ref = doc(db, 'settings', 'global');
    const snap = await getDoc(ref);
    if (snap.exists()) {
        console.log('Settings (global):', JSON.stringify(snap.data(), null, 2));
    }
    const ref2 = doc(db, 'settings', 'global_admin_settings');
    const snap2 = await getDoc(ref2);
    if (snap2.exists()) {
        console.log('Settings (global_admin_settings):', JSON.stringify(snap2.data(), null, 2));
    }
    process.exit(0);
}

checkSettings();
