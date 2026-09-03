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

async function testStrictSemesterIsolation() {
    console.log('\n=== TESTING STRICT SEMESTER ISOLATION FOR STUDENTS ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const terms = ['2025-2026-Odd', '2025-2026-Even', '2026-2027-Odd'];

    for (const termKey of terms) {
        const strictTermStudents = allStudents.filter(student => {
            if (!student.academicHistory) return false;
            return Object.keys(student.academicHistory).some(tk =>
                tk === termKey ||
                tk.replace(/^2025-/, '2025-2026-') === termKey.replace(/^2025-/, '2025-2026-')
            );
        });

        console.log(`Term "${termKey}": STRICT Student Count = ${strictTermStudents.length}`);

        const classDist = {};
        strictTermStudents.forEach(s => {
            const hist = s.academicHistory[termKey] || Object.values(s.academicHistory).find(h => h.termKey === termKey);
            const cls = hist?.className || 'UNSET';
            classDist[cls] = (classDist[cls] || 0) + 1;
        });

        console.log(`  Classes present in "${termKey}":`, classDist);
    }
}

testStrictSemesterIsolation().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
