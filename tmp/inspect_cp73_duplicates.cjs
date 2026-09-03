const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

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

async function inspectSubjectCP73AndDuplicates() {
    console.log('\n=== INSPECTING SUBJECT CP73DIkL4tGuX8pgH6JU AND ALL DUPLICATES ===\n');

    // 1. Fetch target subject CP73DIkL4tGuX8pgH6JU
    const targetDoc = await getDoc(doc(db, 'subjects', 'CP73DIkL4tGuX8pgH6JU'));
    if (targetDoc.exists()) {
        console.log('Target Subject CP73DIkL4tGuX8pgH6JU:');
        console.dir(targetDoc.data(), { depth: null });
    } else {
        console.log('Subject CP73DIkL4tGuX8pgH6JU not found directly in subjects collection.');
    }

    // 2. Fetch all subjects
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    console.log(`\nTotal Active Subjects in DB: ${allSubjects.length}`);

    // Group subjects by normalized Name + Target Classes + activeSemester + academicYear to find exact duplicates
    const grouped = {};
    allSubjects.forEach(s => {
        const nameNorm = (s.name || '').trim().toLowerCase();
        const classesKey = (s.targetClasses || []).map(c => c.trim()).sort().join(',');
        const key = `${nameNorm} | classes:[${classesKey}] | sem:${s.activeSemester} | year:${s.academicYear}`;
        
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(s);
    });

    console.log('\n--- DUPLICATE / REPEATED SUBJECTS IN DB ---');
    let duplicateGroupCount = 0;
    Object.entries(grouped).forEach(([key, items]) => {
        if (items.length > 1) {
            duplicateGroupCount++;
            console.log(`\nDuplicate Group ${duplicateGroupCount}: ${key}`);
            items.forEach(it => {
                console.log(`  - id: ${it.id} | name: "${it.name}" | arabic: "${it.arabicName}" | faculty: "${it.facultyName}" | maxINT: ${it.maxINT} | maxEXT: ${it.maxEXT}`);
            });
        }
    });

    if (duplicateGroupCount === 0) {
        console.log('No exact duplicate subjects found in subjects collection.');
    }

    // 3. Inspect student marks in 2025-2026-Odd to see which subject IDs (including CP73DIkL4tGuX8pgH6JU or unmapped IDs) are recorded
    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const oddMarkSubjectIds = new Set();
    const subjectIdUsageCount = {};
    const unmappedSubjectIds = new Set();

    allStudents.forEach(s => {
        const oddHist = s.academicHistory ? s.academicHistory['2025-2026-Odd'] : null;
        if (oddHist && oddHist.marks) {
            Object.keys(oddHist.marks).forEach(subId => {
                oddMarkSubjectIds.add(subId);
                subjectIdUsageCount[subId] = (subjectIdUsageCount[subId] || 0) + 1;
                
                const foundInSubjects = allSubjects.find(sub => sub.id === subId);
                const foundInMeta = oddHist.subjectMetadata ? oddHist.subjectMetadata[subId] : null;
                
                if (!foundInSubjects && !foundInMeta) {
                    unmappedSubjectIds.add(subId);
                }
            });
        }
    });

    console.log(`\nUnique Subject IDs present in 2025-2026-Odd student marks: ${oddMarkSubjectIds.size}`);
    
    if (oddMarkSubjectIds.has('CP73DIkL4tGuX8pgH6JU')) {
        console.log(`\nSubject CP73DIkL4tGuX8pgH6JU IS present in student marks! Usage count: ${subjectIdUsageCount['CP73DIkL4tGuX8pgH6JU']}`);
    } else {
        console.log('\nSubject CP73DIkL4tGuX8pgH6JU is NOT present in student marks for 2025-2026-Odd.');
    }

    console.log('\nUnmapped Subject IDs in 2025-2026-Odd student marks (neither in DB nor in metadata):');
    console.log(Array.from(unmappedSubjectIds));
}

inspectSubjectCP73AndDuplicates().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
