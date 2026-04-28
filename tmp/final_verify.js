import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function finalVerify() {
    console.log('--- FINAL VERIFICATION for 2025-2026-Odd ---');
    const classes = new Set();
    
    // Check Subjects
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    subjectsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.academicYear === '2025-2026' && data.activeSemester === 'Odd') {
            (data.targetClasses || []).forEach(c => classes.add(c));
        }
    });

    // Check Students
    const studentsSnap = await getDocs(collection(db, 'students'));
    studentsSnap.docs.forEach(doc => {
        const data = doc.data();
        const history = data.academicHistory?.['2025-2026-Odd'];
        if (history) {
            classes.add(history.className);
        }
    });

    console.log('Discovered Classes:', Array.from(classes).sort().join(', '));
    process.exit(0);
}

finalVerify();
