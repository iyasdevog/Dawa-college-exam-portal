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

// Search case-insensitive (Firestore IDs are case-sensitive but the display might be uppercase)
const MYSTERY_ID_UPPER = '2NB1B7TRRK5ZZ1LJVIJZ';
const MYSTERY_ID_LOWER = '2nb1b7trrk5zz1ljvijz';

async function scanAllSubjectIds() {
    console.log('=== SCANNING ALL MARK SUBJECT IDs ACROSS ALL STUDENTS ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const liveSubIds = new Set(subjectsSnap.docs.map(d => d.id));

    // Collect all subIds that appear in any student marks
    const orphanSubIds = new Set();

    studentsSnap.docs.forEach(docSnap => {
        const student = docSnap.data();
        const history = student.academicHistory || {};

        Object.entries(history).forEach(([termKey, termData]) => {
            const marks = termData?.marks || {};
            const metadata = termData?.subjectMetadata || {};

            Object.keys(marks).forEach(subId => {
                if (!liveSubIds.has(subId)) {
                    orphanSubIds.add(subId);
                    const meta = metadata[subId];
                    const name = meta?.name || '(NO NAME)';
                    console.log(`ORPHAN SubID: "${subId}" | Name from metadata: "${name}" | Student: [${student.adNo}] ${student.name} | Term: ${termKey}`);
                }
            });
        });
    });

    if (orphanSubIds.size === 0) {
        console.log('NO orphan subject IDs found. All stored marks match live catalog!');
    } else {
        console.log(`\nTotal orphan subIds: ${orphanSubIds.size}`);
        console.log('Orphan IDs:', Array.from(orphanSubIds).join(', '));
    }
}

scanAllSubjectIds().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
