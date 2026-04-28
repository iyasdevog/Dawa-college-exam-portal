import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkSubjects() {
    console.log('--- Checking Subjects for 2025-2026-Odd ---');
    const snapshot = await getDocs(collection(db, 'subjects'));
    let fs2Count = 0;
    let s1Count = 0;

    snapshot.docs.forEach(d => {
        const data = d.data();
        if (data.academicYear === '2025-2026' && data.activeSemester === 'Odd') {
            const targets = data.targetClasses || [];
            if (targets.includes('FS2')) fs2Count++;
            if (targets.includes('S1')) s1Count++;
        }
    });

    console.log(`Subjects targeting FS2 in 2025-2026-Odd: ${fs2Count}`);
    console.log(`Subjects targeting S1 in 2025-2026-Odd: ${s1Count}`);
    
    process.exit(0);
}

checkSubjects();
