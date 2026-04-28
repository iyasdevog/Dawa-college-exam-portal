import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal",
    storageBucket: "my-edumark-portal.firebasestorage.app",
    messagingSenderId: "445255012917",
    appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c"
};

async function diagnose() {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    console.log('--- Key Discovery ---');

    const snapshot = await getDocs(collection(db, 'students'));
    const allHistoryKeys = new Set();
    
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.academicHistory) {
            Object.keys(data.academicHistory).forEach(k => allHistoryKeys.add(k));
        }
    });

    console.log('History Keys in Database:', Array.from(allHistoryKeys));

    const settingsRef = doc(db, 'settings', 'global_admin_settings');
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
        const settings = settingsSnap.data();
        console.log('Global Active Term:', `${settings.currentAcademicYear}-${settings.currentSemester}`);
    }
}

diagnose().then(() => process.exit(0)).catch(console.error);
