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

async function inspectOddVsEven() {
    console.log('=== DETAILED AUDIT OF FS2 & FS3 MARKS IN ODD vs EVEN ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subMap = new Map(subjectsSnap.docs.map(d => [d.id, d.data().name]));

    const fs2Students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => (s.className || s.currentClass) === 'FS2');
    const fs3Students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => (s.className || s.currentClass) === 'FS3');

    console.log(`FS2 Students (${fs2Students.length}):`);
    fs2Students.forEach(st => {
        const history = st.academicHistory || {};
        console.log(`\nStudent [${st.adNo}] ${st.name} (FS2):`);
        console.log('  Term keys in academicHistory:', Object.keys(history));

        Object.entries(history).forEach(([termKey, termData]) => {
            const marks = termData?.marks || {};
            console.log(`  Term "${termKey}" (${Object.keys(marks).length} marks):`);
            Object.entries(marks).forEach(([subId, mark]) => {
                const subName = subMap.get(subId) || termData?.subjectMetadata?.[subId]?.name || subId;
                const dateStr = mark.updatedAt ? new Date(mark.updatedAt).toISOString() : 'NO TIMESTAMP';
                console.log(`    [${subId}] "${subName}" -> Total: ${mark.total} (INT: ${mark.int}, EXT: ${mark.ext}) | Updated: ${dateStr}`);
            });
        });
    });

    console.log(`\n\n==============================================`);
    console.log(`FS3 Students (${fs3Students.length}):`);
    fs3Students.forEach(st => {
        const history = st.academicHistory || {};
        console.log(`\nStudent [${st.adNo}] ${st.name} (FS3):`);
        console.log('  Term keys in academicHistory:', Object.keys(history));

        Object.entries(history).forEach(([termKey, termData]) => {
            const marks = termData?.marks || {};
            console.log(`  Term "${termKey}" (${Object.keys(marks).length} marks):`);
            Object.entries(marks).forEach(([subId, mark]) => {
                const subName = subMap.get(subId) || termData?.subjectMetadata?.[subId]?.name || subId;
                const dateStr = mark.updatedAt ? new Date(mark.updatedAt).toISOString() : 'NO TIMESTAMP';
                console.log(`    [${subId}] "${subName}" -> Total: ${mark.total} (INT: ${mark.int}, EXT: ${mark.ext}) | Updated: ${dateStr}`);
            });
        });
    });
}

inspectOddVsEven().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
