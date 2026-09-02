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

async function checkHS1() {
    const studentsSnap = await getDocs(collection(db, 'students'));
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subMap = new Map(subjectsSnap.docs.map(d => [d.id, d.data().name]));

    const hs1Students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => (s.className || s.currentClass) === 'HS1');

    console.log(`=== HS1 STUDENTS EVEN MARKS (${hs1Students.length} students) ===`);
    hs1Students.forEach(st => {
        const evenData = st.academicHistory?.['2025-2026-Even'] || {};
        const evenMarks = evenData.marks || {};
        console.log(`[${st.adNo}] ${st.name}: ${Object.keys(evenMarks).length} marks in Even`);
        Object.entries(evenMarks).forEach(([subId, mark]) => {
            const name = subMap.get(subId) || evenData.subjectMetadata?.[subId]?.name || subId;
            console.log(`   - [${subId}] "${name}" = ${mark.total} (${mark.ext}+${mark.int})`);
        });
    });
}

checkHS1().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
