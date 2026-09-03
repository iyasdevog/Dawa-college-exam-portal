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

async function diagnoseClassResultsMarks() {
    console.log('\n=== DIAGNOSING CLASS RESULTS MARKS DISPLAY FOR 2025-2026-Odd ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const oddSubjects = allSubjects.filter(s => 
        (s.academicYear === '2025-2026' || s.academicYear === 'All' || !s.academicYear) &&
        (s.activeSemester === 'Odd' || s.activeSemester === 'Both' || !s.activeSemester)
    );

    console.log(`Total Odd Subjects in catalog: ${oddSubjects.length}`);

    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const classes = ['S1', 'S2', 'P1', 'P2', 'D1', 'D2', 'D3', 'PG-F'];

    for (const className of classes) {
        console.log(`\n==================================================`);
        console.log(`CLASS: ${className}`);
        console.log(`==================================================`);

        // Filter students belonging to this class in 2025-2026-Odd
        const classStudents = allStudents.filter(s => {
            const hist = s.academicHistory ? s.academicHistory['2025-2026-Odd'] : null;
            return hist && hist.className && hist.className.trim().toLowerCase() === className.toLowerCase();
        });

        console.log(`Students count in ${className}: ${classStudents.length}`);

        // Class subjects targeting this class
        const targetSubjects = oddSubjects.filter(s => (s.targetClasses || []).includes(className));
        console.log(`Subjects targeting ${className} (${targetSubjects.length}):`);
        targetSubjects.forEach(ts => {
            console.log(`  - [${ts.id}] "${ts.name}" (arabic: "${ts.arabicName}") | type: ${ts.subjectType}`);
        });

        // Audit mark matching per subject for this class
        console.log(`\n  --- MARK MATCHING REPORT FOR ${className} ---`);
        targetSubjects.forEach(ts => {
            let matchedCount = 0;
            let missingCount = 0;

            classStudents.forEach(student => {
                const hist = student.academicHistory['2025-2026-Odd'];
                const marksObj = hist.marks || {};
                const metaObj = hist.subjectMetadata || {};

                // Matching logic
                let foundMark = marksObj[ts.id];
                if (!foundMark) {
                    const sNameNorm = normalizeSubjectName(ts.name);
                    const sArabicNorm = normalizeSubjectName(ts.arabicName);

                    const foundKey = Object.keys(marksObj).find(k => {
                        const kNorm = normalizeSubjectName(k);
                        if (sNameNorm && kNorm === sNameNorm) return true;
                        if (sArabicNorm && kNorm === sArabicNorm) return true;
                        const snap = metaObj[k];
                        if (snap) {
                            const snapName = normalizeSubjectName(snap.name);
                            const snapArabic = normalizeSubjectName(snap.arabicName);
                            if (sNameNorm && snapName === sNameNorm) return true;
                            if (sArabicNorm && snapArabic === sArabicNorm) return true;
                        }
                        return false;
                    });
                    if (foundKey) foundMark = marksObj[foundKey];
                }

                if (foundMark && (foundMark.total > 0 || foundMark.int !== undefined || foundMark.ext !== undefined)) {
                    matchedCount++;
                } else {
                    missingCount++;
                }
            });

            console.log(`  Subject "${ts.name}" [${ts.id}]: Matched=${matchedCount}/${classStudents.length} | Missing=${missingCount}/${classStudents.length}`);
        });
    }
}

diagnoseClassResultsMarks().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
