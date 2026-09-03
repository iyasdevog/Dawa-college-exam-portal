const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, getDocs, updateDoc, deleteField } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal",
    storageBucket: "my-edumark-portal.firebasestorage.app",
    messagingSenderId: "445255012917",
    appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c",
    measurementId: "G-LLMWHDTZ1T"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function purgeFs1Hs1FromOdd() {
    console.log('=== PURGING UNWANTED FS1 & HS1 FROM 2025-2026-Odd ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let count = 0;

    for (const student of students) {
        if (!student.academicHistory || !student.academicHistory['2025-2026-Odd']) continue;

        const oddHist = student.academicHistory['2025-2026-Odd'];
        const cls = (oddHist.className || '').trim();
        const markCount = oddHist.marks ? Object.keys(oddHist.marks).length : 0;

        // If class is FS1 or HS1 and has no marks in 2025-2026-Odd, remove this invalid history entry
        if ((cls === 'FS1' || cls === 'HS1' || cls === 'UNSET') && markCount === 0) {
            const studentRef = doc(db, 'students', student.id);
            await updateDoc(studentRef, {
                [`academicHistory.2025-2026-Odd`]: deleteField()
            });
            console.log(`Purged 2025-2026-Odd history entry for student: "${student.name}" (${cls})`);
            count++;
        }
    }

    console.log(`\nSuccessfully purged ${count} invalid 2025-2026-Odd history entries!`);
}

purgeFs1Hs1FromOdd().then(() => process.exit(0)).catch(err => {
    console.error('Error purging FS1/HS1 from 2025-2026-Odd:', err);
    process.exit(1);
});
