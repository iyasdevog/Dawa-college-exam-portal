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

async function diagnoseUnmatchedMarks() {
    console.log('\n=== DIAGNOSING UNMATCHED MARKS RECORDED IN STUDENT ACADEMIC HISTORY ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    const subjectMap = new Map(allSubjects.map(s => [s.id, s]));

    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    let totalUnmatchedStudentMarks = 0;

    allStudents.forEach(student => {
        const hist = student.academicHistory ? student.academicHistory['2025-2026-Odd'] : null;
        if (!hist || !hist.marks) return;

        const className = hist.className || student.currentClass;
        const targetSubjects = allSubjects.filter(s => 
            (s.targetClasses || []).includes(className) &&
            (s.academicYear === '2025-2026' || s.academicYear === 'All' || !s.academicYear) &&
            (s.activeSemester === 'Odd' || s.activeSemester === 'Both' || !s.activeSemester)
        );

        Object.entries(hist.marks).forEach(([subId, mark]) => {
            if (mark.isSupplementary) return; // Skip supplementary

            // Check if this subId or mark is matched by any targetSubject for this class
            const dbSubject = subjectMap.get(subId);
            const metaSubject = hist.subjectMetadata ? hist.subjectMetadata[subId] : null;
            const markName = dbSubject?.name || metaSubject?.name || subId;
            const markNormName = normalizeSubjectName(markName);

            const isMatchedByCatalog = targetSubjects.some(ts => {
                if (ts.id === subId) return true;
                const tsNormName = normalizeSubjectName(ts.name);
                const tsArabicNorm = normalizeSubjectName(ts.arabicName);
                if (markNormName && (tsNormName === markNormName || tsArabicNorm === markNormName)) return true;
                return false;
            });

            if (!isMatchedByCatalog && (mark.total > 0 || mark.int !== undefined || mark.ext !== undefined)) {
                totalUnmatchedStudentMarks++;
                console.log(`  Unmatched Mark for "${student.name}" (adNo: ${student.adNo}, class: ${className}) | subId: "${subId}" | subjectName: "${markName}" | total: ${mark.total}`);
                
                // Show candidate subjects for this class
                const candidateSameName = allSubjects.filter(s => normalizeSubjectName(s.name) === markNormName);
                if (candidateSameName.length > 0) {
                    console.log(`    Catalog subjects with same name:`, candidateSameName.map(cs => `[${cs.id}] "${cs.name}" targets:[${(cs.targetClasses||[]).join(',')}]`));
                }
            }
        });
    });

    console.log(`\nTotal unmatched student mark entries across all classes: ${totalUnmatchedStudentMarks}`);
}

diagnoseUnmatchedMarks().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
