import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';

async function checkSubjects() {
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

    console.log('Checking Subjects targetClasses...');
    const snapshot = await getDocs(collection(db, 'subjects'));
    
    snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const targetClasses = data.targetClasses || [];
        if (targetClasses.some(c => c.includes('FS2') || c.includes('FS1') || c.trim() !== c)) {
            console.log(`Subject ${data.name} (${docSnap.id}) has odd targetClasses:`, targetClasses);
        }
    });

    process.exit(0);
}

checkSubjects().catch(console.error);
