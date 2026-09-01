const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, writeBatch } = require('firebase/firestore');

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

async function removeMalayalamFromOdd() {
    console.log('=== REMOVING MALAYALAM FROM 2025-2026-ODD SEMESTER ===\n');

    // 1. Update activeSemester for Malayalam subjects in subjects collection to 'Even'
    console.log('1. Setting Malayalam subjects activeSemester to "Even"...');
    await setDoc(doc(db, 'subjects', 'D5ZEMWpBGGhGvESByu4l'), {
        activeSemester: 'Even'
    }, { merge: true });

    await setDoc(doc(db, 'subjects', 'Kogdr0NtmlAEQR6WiUCw'), {
        activeSemester: 'Even'
    }, { merge: true });

    console.log('✅ Subject activeSemester updated to Even.\n');

    // 2. Remove Malayalam marks from 2025-2026-Odd for all students
    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ ref: d.ref, id: d.id, ...d.data() }));

    let batch = writeBatch(db);
    let count = 0;

    students.forEach(st => {
        const history = JSON.parse(JSON.stringify(st.academicHistory || {}));
        const oddMarks = history['2025-2026-Odd']?.marks;

        if (oddMarks) {
            let changed = false;
            if (oddMarks['D5ZEMWpBGGhGvESByu4l']) {
                delete oddMarks['D5ZEMWpBGGhGvESByu4l'];
                changed = true;
            }
            if (oddMarks['Kogdr0NtmlAEQR6WiUCw']) {
                delete oddMarks['Kogdr0NtmlAEQR6WiUCw'];
                changed = true;
            }

            if (changed) {
                batch.update(st.ref, { academicHistory: history });
                count++;
                console.log(`  Removed Malayalam from 2025-2026-Odd for Student ${st.adNo} (${st.name})`);
            }
        }
    });

    if (count > 0) {
        await batch.commit();
        console.log(`\n✅ Successfully removed Malayalam marks from 2025-2026-Odd for ${count} students!`);
    } else {
        console.log('\nNo student records contained Malayalam in 2025-2026-Odd.');
    }
}

removeMalayalamFromOdd().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
