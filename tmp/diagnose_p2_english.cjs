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

function normalizeSubjectName(name) {
    if (!name) return '';
    return name.toString().trim().toLowerCase()
        .replace(/['"’`]/g, '')
        .replace(/[^a-z0-9\u0600-\u06FF\s]/gi, ' ')
        .replace(/\s+/g, ' ');
}

async function diagnoseP2English() {
    console.log('\n=== DIAGNOSING CLASS P2 ENGLISH SUBJECT & MARKS ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    console.log('1. All Catalog Subjects with Name "ENGLISH" or containing "ENGLISH":');
    const englishCatalogSubjects = allSubjects.filter(s => (s.name || '').toLowerCase().includes('english'));
    englishCatalogSubjects.forEach(s => {
        console.log(`  - [${s.id}] "${s.name}" | type: "${s.subjectType}" | year: "${s.academicYear}" | sem: "${s.activeSemester}" | targetClasses: [${(s.targetClasses||[]).join(',')}]`);
    });

    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const p2Students = allStudents.filter(s => {
        const hist = s.academicHistory ? s.academicHistory['2025-2026-Odd'] : null;
        return hist && hist.className && (hist.className.trim().toLowerCase() === 'p2' || hist.className.trim().toLowerCase() === 'hs3');
    });

    console.log(`\n2. Found ${p2Students.length} Students in Class P2 (2025-2026-Odd):`);

    p2Students.forEach(st => {
        const hist = st.academicHistory['2025-2026-Odd'];
        console.log(`\nStudent: "${st.name}" (adNo: ${st.adNo}, class: ${hist.className})`);
        
        // Find all English marks in student's marks object
        const marksObj = hist.marks || {};
        const metaObj = hist.subjectMetadata || {};

        let foundEnglishMark = false;
        Object.entries(marksObj).forEach(([subId, mark]) => {
            const catSub = allSubjects.find(s => s.id === subId);
            const metaSub = metaObj[subId];
            const name = catSub?.name || metaSub?.name || subId;

            if (name.toLowerCase().includes('english')) {
                foundEnglishMark = true;
                console.log(`  - Mark Key [${subId}] ("${name}"): total=${mark.total} (ext:${mark.ext}, int:${mark.int}) | catSubFound: ${!!catSub} | metaFound: ${!!metaSub}`);
            }
        });

        if (!foundEnglishMark) {
            console.log(`  - NO ENGLISH MARK FOUND FOR THIS STUDENT!`);
        }
    });
}

diagnoseP2English().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
