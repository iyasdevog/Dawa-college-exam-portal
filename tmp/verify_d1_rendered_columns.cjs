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

async function verifyD1RenderedColumns() {
    console.log('\n=== SIMULATING ClassResults.tsx FOR CLASS D1 (2025-2026-Odd) ===\n');

    const activeTerm = '2025-2026-Odd';
    const selectedClass = 'D1';

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const studentsSnap = await getDocs(collection(db, 'students'));
    const rawStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const classStudents = rawStudents.filter(s => {
        const hist = s.academicHistory ? s.academicHistory[activeTerm] : null;
        return hist && hist.className && hist.className.trim().toLowerCase() === selectedClass.toLowerCase();
    });

    console.log(`Class D1 Students Count: ${classStudents.length}`);

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

    classStudents.forEach(cs => {
        const termData = cs.academicHistory[activeTerm];
        if (!termData?.marks) return;
        Object.keys(termData.marks).forEach(subId => {
            const liveSub = subjects.find(s => s.id === subId);
            const snapshot = termData.subjectMetadata?.[subId];
            const m = termData.marks[subId];

            if (m?.isSupplementary || snapshot?.subjectType === 'supplementary' || liveSub?.subjectType === 'supplementary' || snapshot?.name === 'Supplementary Exam') {
                return;
            }

            const subName = snapshot?.name || liveSub?.name;
            const isRawId = /^[a-z0-9]{15,}$/i.test(subId);
            if (!liveSub && (!subName || isRawId || subName === subId)) {
                return;
            }

            const alreadyIncluded = potentialSubjects.some(ps => 
                ps.id === subId || (subName && ps.name.trim().toLowerCase() === subName.trim().toLowerCase())
            );

            if (!alreadyIncluded) {
                const resolvedSubjectType = liveSub?.subjectType || snapshot?.subjectType || 'general';
                potentialSubjects.push({
                    id: subId,
                    name: snapshot?.name || liveSub?.name || subId,
                    arabicName: snapshot?.arabicName || liveSub?.arabicName || '',
                    maxINT: snapshot?.maxINT ?? liveSub?.maxINT ?? 30,
                    maxEXT: snapshot?.maxEXT ?? liveSub?.maxEXT ?? 70,
                    passingTotal: snapshot?.passingTotal ?? liveSub?.passingTotal ?? 40,
                    facultyName: snapshot?.facultyName || liveSub?.facultyName || '',
                    subjectType: resolvedSubjectType,
                    targetClasses: [selectedClass],
                    activeSemester: activeTerm.endsWith('-Even') ? 'Even' : 'Odd',
                    enrolledStudents: [],
                    academicYear: ''
                });
            }
        });
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
        const key = normalizedName;

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

            const candidateTargetsClass = (s.targetClasses || []).includes(selectedClass);
            const existingTargetsClass = (existing.targetClasses || []).includes(selectedClass);

            if (candidateMarkCount > existingMarkCount || (candidateMarkCount === existingMarkCount && candidateTargetsClass && !existingTargetsClass)) {
                uniqueSubjectsByName.set(key, s);
            }
        }
    });

    const classSubjects = Array.from(uniqueSubjectsByName.values());
    console.log(`\nRendered Table Subject Columns for Class D1 (${classSubjects.length} subjects):`);
    classSubjects.forEach(s => {
        console.log(`  - [${s.id}] "${s.name}" (type: ${s.subjectType})`);
    });

    // Test students in screenshot: M. Shafin (AdNo: 86), M. Shabeeb P (AdNo: 88), M. Shabeel (AdNo: 79), M. Unais (AdNo: 81)
    const testAdNos = ['86', '88', '79', '81'];

    testAdNos.forEach(adNo => {
        const st = classStudents.find(s => String(s.adNo) === adNo);
        if (!st) return;
        const stTermData = st.academicHistory[activeTerm];
        console.log(`\n--- STUDENT: ${st.name} (AdNo: ${st.adNo}) ---`);
        classSubjects.forEach(s => {
            const mark = getMarkForSubject(stTermData.marks, s, stTermData.subjectMetadata);
            console.log(`  Subject "${s.name}": ${mark ? `${mark.total} (${mark.ext}+${mark.int})` : '-'}`);
        });
    });
}

verifyD1RenderedColumns().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
