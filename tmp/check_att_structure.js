import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, limit, query } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal",
    storageBucket: "my-edumark-portal.firebasestorage.app",
    messagingSenderId: "445255012917",
    appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c"
};

async function check() {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    const attSnaps = await getDocs(query(collection(db, 'attendance'), limit(10)));
    attSnaps.forEach(d => {
        console.log(`Doc ID: ${d.id}`);
        console.log(`Data:`, JSON.stringify(d.data()));
    });
}

check().then(() => process.exit(0)).catch(console.error);
