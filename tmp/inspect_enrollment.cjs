const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

async function inspectEnrollment() {
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const studentsSnap = await getDocs(collection(db, 'students'));
    const stMap = new Map(studentsSnap.docs.map(d => [d.id, d.data()]));

    subjectsSnap.docs.forEach(d => {
        const sub = d.data();
        if ((sub.name || '').toLowerCase().includes('english')) {
            console.log(`\nSubject [${d.id}] "${sub.name}" (Type: ${sub.subjectType}, Sem: ${sub.activeSemester}):`);
            console.log(`  targetClasses:`, sub.targetClasses);
            const enrolled = sub.enrolledStudents || [];
            console.log(`  enrolledStudents count: ${enrolled.length}`);
            enrolled.forEach(stId => {
                const st = stMap.get(stId);
                console.log(`    -> [${st?.adNo || stId}] ${st?.name || 'Unknown'} (${st?.className || st?.currentClass})`);
            });
        }
    });
}

inspectEnrollment().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
