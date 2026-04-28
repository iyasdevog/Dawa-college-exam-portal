import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';

async function checkVisibility() {
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

    const settingsRef = doc(db, 'settings', 'global_admin_settings');
    const snap = await getDoc(settingsRef);

    if (snap.exists()) {
        const data = snap.data();
        console.log('Disabled Classes:', data.disabledClasses || []);
        console.log('Custom Classes:', data.customClasses || []);
        
        if (data.disabledClasses && data.disabledClasses.includes('S1')) {
            console.log('S1 is DISABLED. Enabling it now...');
            const updated = data.disabledClasses.filter(c => c !== 'S1');
            await updateDoc(settingsRef, { disabledClasses: updated });
            console.log('S1 has been ENABLED.');
        } else {
            console.log('S1 is NOT in disabledClasses.');
        }
    } else {
        console.log('Settings document not found.');
    }
    process.exit(0);
}

checkVisibility().catch(console.error);
