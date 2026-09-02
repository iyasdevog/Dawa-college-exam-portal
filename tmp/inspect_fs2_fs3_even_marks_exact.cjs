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

async function inspectFS2FS3EvenExact() {
    console.log('=== EXACT EVEN MARKS FOR FS2 AND FS3 ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subMap = new Map(subjectsSnap.docs.map(d => [d.id, d.data().name]));

    const fs2Students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => (s.className || s.currentClass) === 'FS2');
    const fs3Students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => (s.className || s.currentClass) === 'FS3');

    console.log(`=== FS2 EVEN SEMESTER MARKS (${fs2Students.length} students) ===`);
    fs2Students.forEach(st => {
        const evenData = st.academicHistory?.['2025-2026-Even'] || {};
        const evenMarks = evenData.marks || {};
        console.log(`[${st.adNo}] ${st.name}: ${Object.keys(evenMarks).length} marks in Even`);
        Object.entries(evenMarks).forEach(([subId, mark]) => {
            const name = subMap.get(subId) || evenData.subjectMetadata?.[subId]?.name || subId;
            const updated = mark.updatedAt ? new Date(mark.updatedAt).toISOString() : 'NO TIMESTAMP (COPIED)';
            console.log(`   - [${subId}] "${name}" = ${mark.total} (INT: ${mark.int}, EXT: ${mark.ext}) | ${updated}`);
        });
    });

    console.log(`\n=== FS3 EVEN SEMESTER MARKS (${fs3Students.length} students) ===`);
    fs3Students.forEach(st => {
        const evenData = st.academicHistory?.['2025-2026-Even'] || {};
        const evenMarks = evenData.marks || {};
        console.log(`[${st.adNo}] ${st.name}: ${Object.keys(evenMarks).length} marks in Even`);
        Object.entries(evenMarks).forEach(([subId, mark]) => {
            const name = subMap.get(subId) || evenData.subjectMetadata?.[subId]?.name || subId;
            const updated = mark.updatedAt ? new Date(mark.updatedAt).toISOString() : 'NO TIMESTAMP (COPIED)';
            console.log(`   - [${subId}] "${name}" = ${mark.total} (INT: ${mark.int}, EXT: ${mark.ext}) | ${updated}`);
        });
    });
}

inspectFS2FS3EvenExact().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
