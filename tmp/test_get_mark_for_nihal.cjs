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
    
    // 1. Direct ID lookup
    if (marksObj[subject.id] !== undefined) return marksObj[subject.id];

    // 2. Case-insensitive / trimmed ID lookup
    const sId = (subject.id || '').toLowerCase().trim();
    if (sId) {
        const idKey = Object.keys(marksObj).find(k => k.toLowerCase().trim() === sId);
        if (idKey) return marksObj[idKey];
    }

    // 3. Name or Arabic Name lookup
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

async function testGetMarkForNihal() {
    console.log('\n=== TESTING getMarkForSubject FOR NIHAL N (AdNo: 138) ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const nihal = allStudents.find(s => String(s.adNo) === '138');
    const termData = nihal.academicHistory['2025-2026-Odd'];

    console.log(`Nihal N (Class: ${termData.className}):`);
    console.log('Marks recorded keys:', Object.keys(termData.marks || {}));

    // Find all subjects targeting S2 in odd term
    const s2Subjects = allSubjects.filter(s => 
        (s.targetClasses || []).includes('S2') &&
        (s.academicYear === '2025-2026' || s.academicYear === 'All') &&
        (s.activeSemester === 'Odd' || s.activeSemester === 'Both')
    );

    console.log(`\nSubjects returned for S2 (${s2Subjects.length}):`);
    s2Subjects.forEach(s => {
        const mark = getMarkForSubject(termData.marks, s, termData.subjectMetadata);
        console.log(`  - [${s.id}] "${s.name}" (type: ${s.subjectType}) → mark: ${mark ? `TOTAL ${mark.total} (${mark.ext}+${mark.int})` : 'UNDEFINED (-)'}`);
    });
}

testGetMarkForNihal().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
