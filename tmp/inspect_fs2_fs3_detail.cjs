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

async function inspectFS2FS3Detail() {
    const studentsSnap = await getDocs(collection(db, 'students'));
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subMap = new Map(subjectsSnap.docs.map(d => [d.id, d.data().name]));

    const fs2Students = studentsSnap.docs.map(d => d.data()).filter(s => (s.className || s.currentClass) === 'FS2');
    const fs3Students = studentsSnap.docs.map(d => d.data()).filter(s => (s.className || s.currentClass) === 'FS3');

    console.log('=== FS2 STUDENTS (Total: ' + fs2Students.length + ') ===');
    fs2Students.forEach(st => {
        const odd = st.academicHistory?.['2025-2026-Odd']?.marks || {};
        const even = st.academicHistory?.['2025-2026-Even']?.marks || {};

        console.log(`[${st.adNo}] ${st.name}:`);
        console.log(`   Odd Marks (${Object.keys(odd).length}): ` + Object.entries(odd).map(([k, m]) => `${subMap.get(k) || k}=${m.total}`).join(', '));
        console.log(`   Even Marks (${Object.keys(even).length}): ` + Object.entries(even).map(([k, m]) => `${subMap.get(k) || k}=${m.total}`).join(', '));
    });

    console.log('\n=== FS3 STUDENTS (Total: ' + fs3Students.length + ') ===');
    fs3Students.forEach(st => {
        const odd = st.academicHistory?.['2025-2026-Odd']?.marks || {};
        const even = st.academicHistory?.['2025-2026-Even']?.marks || {};

        console.log(`[${st.adNo}] ${st.name}:`);
        console.log(`   Odd Marks (${Object.keys(odd).length}): ` + Object.entries(odd).map(([k, m]) => `${subMap.get(k) || k}=${m.total}`).join(', '));
        console.log(`   Even Marks (${Object.keys(even).length}): ` + Object.entries(even).map(([k, m]) => `${subMap.get(k) || k}=${m.total}`).join(', '));
    });
}

inspectFS2FS3Detail().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
