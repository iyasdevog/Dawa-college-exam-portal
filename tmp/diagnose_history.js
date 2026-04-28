import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function diagnose() {
    const term = '2025-2026-Odd';
    const snapshot = await getDocs(collection(db, 'students'));
    console.log(`Total students: ${snapshot.size}`);

    const s1Users = [];
    const fs2Users = [];
    
    snapshot.docs.forEach(d => {
        const data = d.data();
        const history = data.academicHistory?.[term];
        if (history) {
            if (history.className === 'S1') s1Users.push(data.adNo);
            if (history.className === 'FS2') fs2Users.push(data.adNo);
        }
    });

    console.log(`Students with S1 history in ${term}: ${s1Users.length}`);
    console.log(`Students with FS2 history in ${term}: ${fs2Users.length}`);
    if (fs2Users.length > 0) console.log(`Example FS2 adNos: ${fs2Users.slice(0, 5)}`);
    
    process.exit(0);
}

diagnose();
