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

async function verifyClassResultsRenderedColumns() {
    console.log('\n=== SIMULATING ClassResults.tsx FOR CLASS S2 (2025-2026-Odd) ===\n');

    const activeTerm = '2025-2026-Odd';
    const selectedClass = 'S2';

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const studentsSnap = await getDocs(collection(db, 'students'));
    const rawStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const classStudents = rawStudents.filter(s => {
        const hist = s.academicHistory ? s.academicHistory[activeTerm] : null;
        return hist && hist.className && hist.className.trim().toLowerCase() === selectedClass.toLowerCase();
    });

    console.log(`Class S2 Students Count: ${classStudents.length}`);

    // Simulation of ClassResults.tsx loadClassData logic:
    const isOddTerm = activeTerm.endsWith('-Odd');
    const isEvenTerm = activeTerm.endsWith('-Even');

    let potentialSubjects = subjects.filter(s => {
        if (s.subjectType === 'supplementary') return false;
        if (isOddTerm && s.activeSemester === 'Even') return false;
        if (isEvenTerm && s.activeSemester === 'Odd') return false;

        if ((s.targetClasses || []).includes(selectedClass)) return true;
        if (s.subjectType === 'elective' && s.enrolledStudents?.some(id => classStudents.some(cs => cs.id === id))) return true;
        if (classStudents.some(cs => {
            const termData = cs.academicHistory[activeTerm];
            const mark = getMarkForSubject(termData?.marks, s, termData?.subjectMetadata);
            return mark !== undefined && !mark.isSupplementary && ((typeof mark.total === 'number' && mark.total > 0) || mark.int !== undefined || mark.ext !== undefined);
        })) return true;
        return false;
    });

    const filteredSubjects = potentialSubjects.filter(s => {
        if (s.subjectType === 'supplementary') return false;
        return classStudents.some(cs => {
            const termData = cs.academicHistory[activeTerm];
            const m = getMarkForSubject(termData?.marks, s, termData?.subjectMetadata);
            if (!m || m.isSupplementary) return false;
            return (typeof m.total === 'number' && m.total > 0) || m.int !== undefined || m.ext !== undefined;
        });
    });

    const uniqueSubjectsById = new Map();
    const uniqueSubjectsByName = new Map();

    filteredSubjects.forEach(s => {
        const isLiveCatalogEntry = subjects.some(ls => ls.id === s.id);
        if (!uniqueSubjectsById.has(s.id)) {
            uniqueSubjectsById.set(s.id, s);
        } else if (isLiveCatalogEntry) {
            uniqueSubjectsById.set(s.id, s);
        }
    });

    uniqueSubjectsById.forEach(s => {
        const normalizedName = s.name.trim().toLowerCase();
        const key = `${s.subjectType || 'general'}_${normalizedName}`;

        if (!uniqueSubjectsByName.has(key)) {
            uniqueSubjectsByName.set(key, s);
        } else {
            const existing = uniqueSubjectsByName.get(key);
            let existingMarkCount = 0;
            let candidateMarkCount = 0;

            classStudents.forEach(cs => {
                const termData = cs.academicHistory[activeTerm];
                const mExist = getMarkForSubject(termData?.marks, existing, termData?.subjectMetadata);
                const mCand = getMarkForSubject(termData?.marks, s, termData?.subjectMetadata);
                if (mExist && !mExist.isSupplementary && (mExist.total > 0 || mExist.int !== undefined || mExist.ext !== undefined)) existingMarkCount++;
                if (mCand && !mCand.isSupplementary && (mCand.total > 0 || mCand.int !== undefined || mCand.ext !== undefined)) candidateMarkCount++;
            });

            if (candidateMarkCount > existingMarkCount) {
                uniqueSubjectsByName.set(key, s);
            }
        }
    });

    const classSubjects = Array.from(uniqueSubjectsByName.values());
    console.log(`\nRendered Table Subject Columns for Class S2 (${classSubjects.length} subjects):`);
    classSubjects.forEach(s => {
        console.log(`  - [${s.id}] "${s.name}" (type: ${s.subjectType})`);
    });

    console.log('\n--- SAMPLE STUDENT ROW: Nihal N (AdNo: 138) ---');
    const nihal = classStudents.find(s => String(s.adNo) === '138');
    const nihalTermData = nihal.academicHistory[activeTerm];

    classSubjects.forEach(s => {
        const mark = getMarkForSubject(nihalTermData.marks, s, nihalTermData.subjectMetadata);
        console.log(`  Subject "${s.name}": ${mark ? `${mark.total} (${mark.ext}+${mark.int})` : '-'}`);
    });
}

verifyClassResultsRenderedColumns().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
