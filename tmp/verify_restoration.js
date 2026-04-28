import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verifyData() {
    console.log('--- Verification for 2025-2026-Odd ---');
    const q1 = query(collection(db, 'attendance'), where('termKey', '==', '2025-2026-Odd'), where('className', '==', 'FS2'));
    const s1 = await getDocs(q1);
    console.log(`FS2 Attendance for 2025-2026-Odd: ${s1.size}`);

    const q2 = query(collection(db, 'attendance'), where('termKey', '==', '2025-2026-Odd'), where('className', '==', 'S1'));
    const s2 = await getDocs(q2);
    console.log(`S1 Attendance for 2025-2026-Odd: ${s2.size}`);

    const q3 = query(collection(db, 'subjects'), where('academicYear', '==', '2025-2026'), where('activeSemester', '==', 'Odd'));
    const s3 = await getDocs(q3);
    console.log(`Subjects for 2025-2026-Odd: ${s3.size}`);
    
    process.exit(0);
}

verifyData();
