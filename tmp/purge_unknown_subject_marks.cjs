const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, deleteField } = require('firebase/firestore');

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

const UNKNOWN_IDS = new Set([
    'CP73DIkL4tGuX8pgH6JU',
    'v1eqpVhe9zwBenNqz5nL',
    'zjfIw4gLzhZUwNgljmsa',
    'qONeFnfq8xP7dXSUlboO',
    'hXwj90u3pLUzQh5pkhcS',
    'kbGr9LuXzpvE3Ws0PiE5',
    'qPqFCSR8H6Gvx9nQbacG',
    'XZ8Sl65cKfzW03J4YhPg'
]);

async function cleanupUnknowns() {
    console.log('=== CHECKING AND CLEANING UNKNOWN/ORPHAN MARKS FROM FIRESTORE ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const liveSubjectIds = new Set(subjectsSnap.docs.map(d => d.id));

    const studentsSnap = await getDocs(collection(db, 'students'));
    let cleanedMarksCount = 0;
    let studentsUpdatedCount = 0;

    for (const docSnap of studentsSnap.docs) {
        const student = docSnap.data();
        const history = student.academicHistory || {};
        let studentNeedsUpdate = false;
        const payload = {};

        Object.entries(history).forEach(([termKey, termData]) => {
            const marks = termData?.marks || {};
            Object.keys(marks).forEach(subId => {
                // If it is in the UNKNOWN_IDS list or not in live catalog
                if (UNKNOWN_IDS.has(subId) || !liveSubjectIds.has(subId)) {
                    console.log(`Removing unknown/orphan subject mark [${subId}] for Student [${student.adNo}] ${student.name} in term "${termKey}"`);
                    payload[`academicHistory.${termKey}.marks.${subId}`] = deleteField();
                    cleanedMarksCount++;
                    studentNeedsUpdate = true;
                }
            });
        });

        if (studentNeedsUpdate) {
            await updateDoc(docSnap.ref, payload);
            studentsUpdatedCount++;
        }
    }

    console.log(`\nCleanup complete:`);
    console.log(`  Removed ${cleanedMarksCount} orphan/unknown mark entries across ${studentsUpdatedCount} students.`);
}

cleanupUnknowns().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
