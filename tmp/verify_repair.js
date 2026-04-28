import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, query, where } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal",
    storageBucket: "my-edumark-portal.firebasestorage.app",
    messagingSenderId: "445255012917",
    appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c"
};

async function verify() {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    console.log('--- Verification: Historical Data Visibility ---');

    const TERM = '2025-2026-Odd';
    const CLASS = 'FS2';

    // 1. Check students in this term
    const studentSnaps = await getDocs(collection(db, 'students'));
    const studentsInTerm = [];
    studentSnaps.forEach(d => {
        const data = d.data();
        if (data.academicHistory && data.academicHistory[TERM]) {
            const history = data.academicHistory[TERM];
            if (history.className === CLASS) {
                studentsInTerm.push({ name: data.name, class: history.className });
            }
        }
    });
    console.log(`Students in ${CLASS} for ${TERM}: ${studentsInTerm.length}`);

    // 2. Check subjects for this term/class
    const subjectSnaps = await getDocs(collection(db, 'subjects'));
    const classSubjects = [];
    subjectSnaps.forEach(d => {
        const data = d.data();
        if (data.targetClasses && data.targetClasses.includes(CLASS)) {
            // Check if it exists for the term? Subjects are usually global but marked for term in some cases
            classSubjects.push(data.name);
        }
    });
    console.log(`Subjects for ${CLASS}: ${classSubjects.length}`);

    // 3. Check attendance for this term/class
    const attQuery = query(
        collection(db, 'attendance'),
        where('className', '==', CLASS),
        where('termKey', '==', TERM)
    );
    const attSnaps = await getDocs(attQuery);
    console.log(`Attendance Records for ${CLASS} in ${TERM}: ${attSnaps.size}`);

    console.log('\n--- Verification Complete ---');
}

verify().then(() => process.exit(0)).catch(console.error);
