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

async function inspectD1StudentsInFirestore() {
    console.log('\n=== INSPECTING CLASS D1 STUDENTS & MARKS IN FIRESTORE ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    const subjectMap = new Map(allSubjects.map(s => [s.id, s]));

    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const d1Students = allStudents.filter(s => {
        const hist = s.academicHistory ? s.academicHistory['2025-2026-Odd'] : null;
        return hist && hist.className && hist.className.trim().toLowerCase() === 'd1';
    });

    console.log(`Found ${d1Students.length} students in Class D1 for 2025-2026-Odd:`);

    d1Students.slice(0, 5).forEach(st => {
        const hist = st.academicHistory['2025-2026-Odd'];
        console.log(`\nStudent: "${st.name}" (adNo: ${st.adNo}, class: ${hist.className})`);
        console.log(`  Marks keys count: ${Object.keys(hist.marks || {}).length}`);
        
        Object.entries(hist.marks || {}).forEach(([subId, m]) => {
            const catalogSub = subjectMap.get(subId);
            const metaSub = hist.subjectMetadata ? hist.subjectMetadata[subId] : null;
            console.log(`    - [${subId}] name:"${catalogSub?.name || metaSub?.name || subId}" | isSupp:${m.isSupplementary} | total:${m.total} (${m.ext}+${m.int})`);
        });
    });
}

inspectD1StudentsInFirestore().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
