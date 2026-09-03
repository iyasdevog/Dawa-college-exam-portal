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

function getMarkForSubject(marksObj, subject, metadataObj) {
    if (!marksObj || !subject) return undefined;
    if (marksObj[subject.id] !== undefined) return marksObj[subject.id];

    const sId = (subject.id || '').toLowerCase().trim();
    if (sId) {
        const idKey = Object.keys(marksObj).find(k => k.toLowerCase().trim() === sId);
        if (idKey) return marksObj[idKey];
    }

    const sNameNorm = normalizeSubjectName(subject.name || '');
    const sArabicNorm = normalizeSubjectName(subject.arabicName || '');

    const foundKey = Object.keys(marksObj).find(k => {
        const kNorm = normalizeSubjectName(k);
        if (sNameNorm && kNorm === sNameNorm) return true;
        if (sArabicNorm && kNorm === sArabicNorm) return true;

        const snap = metadataObj?.[k];
        if (snap) {
            const snapNameNorm = normalizeSubjectName(snap.name || '');
            const snapArabicNorm = normalizeSubjectName(snap.arabicName || '');
            if (sNameNorm && snapNameNorm === sNameNorm) return true;
            if (sArabicNorm && snapArabicNorm === sArabicNorm) return true;
        }

        return false;
    });

    if (foundKey) return marksObj[foundKey];
    return undefined;
}

async function testAllClassesMarkCoverage() {
    console.log('\n=== TESTING MARK COVERAGE ACROSS ALL CLASSES IN 2025-2026-Odd ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const oddSubjects = allSubjects.filter(s => 
        (s.academicYear === '2025-2026' || s.academicYear === 'All' || !s.academicYear) &&
        (s.activeSemester === 'Odd' || s.activeSemester === 'Both' || !s.activeSemester)
    );

    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const classes = ['S1', 'S2', 'P1', 'P2', 'D1', 'D2', 'D3', 'PG-F'];

    for (const className of classes) {
        const classStudents = allStudents.filter(s => {
            const hist = s.academicHistory ? s.academicHistory['2025-2026-Odd'] : null;
            return hist && hist.className && hist.className.trim().toLowerCase() === className.toLowerCase();
        });

        const targetSubjects = oddSubjects.filter(s => (s.targetClasses || []).includes(className));

        let totalCellCount = classStudents.length * targetSubjects.length;
        let filledCellCount = 0;

        classStudents.forEach(st => {
            const termData = st.academicHistory['2025-2026-Odd'];
            targetSubjects.forEach(sub => {
                const mark = getMarkForSubject(termData.marks, sub, termData.subjectMetadata);
                if (mark && (mark.total > 0 || mark.int !== undefined || mark.ext !== undefined)) {
                    filledCellCount++;
                }
            });
        });

        const percentage = totalCellCount > 0 ? ((filledCellCount / totalCellCount) * 100).toFixed(1) : '100.0';
        console.log(`Class "${className}": ${classStudents.length} students | ${targetSubjects.length} subjects | Marks Coverage: ${filledCellCount}/${totalCellCount} (${percentage}%)`);
    }
}

testAllClassesMarkCoverage().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
