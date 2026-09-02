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

const MYSTERY_ID = '2NB1B7TRRK5ZZ1LJVIJZ';

async function findMysterySubject() {
    console.log(`=== SEARCHING FOR MARKS WITH SubID "${MYSTERY_ID}" ===\n`);

    // Check if it exists in subjects catalog
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const liveSub = subjectsSnap.docs.find(d => d.id === MYSTERY_ID);
    if (liveSub) {
        console.log('FOUND IN LIVE CATALOG:', liveSub.data());
    } else {
        console.log('NOT FOUND in live subject catalog (was likely deleted).\n');
    }

    // Search all students for marks stored under this ID + recover name from metadata
    const studentsSnap = await getDocs(collection(db, 'students'));
    let foundCount = 0;

    studentsSnap.docs.forEach(docSnap => {
        const student = docSnap.data();
        const history = student.academicHistory || {};

        Object.entries(history).forEach(([termKey, termData]) => {
            const marks = termData?.marks || {};
            const metadata = termData?.subjectMetadata || {};

            if (marks[MYSTERY_ID] !== undefined) {
                foundCount++;
                const mark = marks[MYSTERY_ID];
                const meta = metadata[MYSTERY_ID];
                console.log(`Student [${student.adNo}] ${student.name} (${student.className || student.currentClass}) in term "${termKey}":`);
                console.log(`  Mark: total=${mark.total}, int=${mark.int}, ext=${mark.ext}`);
                console.log(`  Snapshot Metadata:`, meta ? JSON.stringify(meta) : 'NONE (no name stored)');
                console.log('');
            }
        });
    });

    if (foundCount === 0) {
        console.log('No student marks found with this subject ID.');
    } else {
        console.log(`Total: ${foundCount} student marks found with subject ID "${MYSTERY_ID}".`);
    }
}

findMysterySubject().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
