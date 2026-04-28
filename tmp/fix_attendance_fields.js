import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal",
    storageBucket: "my-edumark-portal.firebasestorage.app",
    messagingSenderId: "445255012917",
    appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c"
};

const OLD_NAME = 'S1';
const NEW_NAME = 'FS2';

async function fixAttendance() {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    console.log('--- Fixing Attendance Internal Fields ---');

    const snapshot = await getDocs(collection(db, 'attendance'));
    let fixCount = 0;

    for (const d of snapshot.docs) {
        const data = d.data();
        if (data.className === OLD_NAME) {
            console.log(`Fixing doc ${d.id}: className ${OLD_NAME} -> ${NEW_NAME}`);
            await setDoc(d.ref, { className: NEW_NAME }, { merge: true });
            fixCount++;
        }
    }

    console.log(`Successfully fixed internal className for ${fixCount} documents.`);
}

fixAttendance().then(() => process.exit(0)).catch(console.error);
