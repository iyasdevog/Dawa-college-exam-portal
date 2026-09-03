const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

async function testGetClassesByTerm() {
    console.log('\n=== TESTING CLASS DISCOVERY FOR ALL THREE SEMESTERS ===\n');

    const terms = ['2025-2026-Odd', '2025-2026-Even', '2026-2027-Odd'];

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    for (const termKey of terms) {
        const classesSet = new Set();
        students.forEach(s => {
            if (s.academicHistory && s.academicHistory[termKey]) {
                const cls = s.academicHistory[termKey].className;
                if (cls && cls !== 'UNSET') classesSet.add(cls.trim());
            }
        });
        console.log(`Discovered Classes for "${termKey}":`, Array.from(classesSet).sort());
    }
}

testGetClassesByTerm().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
