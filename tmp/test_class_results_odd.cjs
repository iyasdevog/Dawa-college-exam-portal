const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal",
    storageBucket: "my-edumark-portal.firebasestorage.app",
    messagingSenderId: "445255012917",
    appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c",
    measurementId: "G-LLMWHDTZ1T"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const getStudentTermData = (student, targetTerm, targetClass) => {
    const historyKeys = student.academicHistory ? Object.keys(student.academicHistory) : [];
    const matchingKey = historyKeys.find(tk => 
        (tk === targetTerm || tk.replace(/^2025-/, '2025-2026-') === targetTerm.replace(/^2025-/, '2025-2026-'))
    );
    const historyEntry = matchingKey ? student.academicHistory[matchingKey] : null;
    return historyEntry || null;
};

const getMarkForSubject = (marksObj, subject, metadataObj) => {
    if (!marksObj || !subject) return undefined;
    if (marksObj[subject.id] !== undefined) return marksObj[subject.id];
    const sId = (subject.id || '').toLowerCase().trim();
    if (sId) {
        const idKey = Object.keys(marksObj).find(k => k.toLowerCase().trim() === sId);
        if (idKey) return marksObj[idKey];
    }
    const sNameNorm = (subject.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const foundKey = Object.keys(marksObj).find(k => {
        const kNorm = k.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        if (sNameNorm && kNorm === sNameNorm) return true;
        const snap = metadataObj?.[k];
        if (snap) {
            const snapNorm = (snap.name || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
            if (sNameNorm && snapNorm === sNameNorm) return true;
        }
        return false;
    });
    return foundKey ? marksObj[foundKey] : undefined;
};

async function testClassResults() {
    console.log('\n=== TESTING CLASS RESULTS & SCORECARD DATA FOR 2025-2026-Odd ===\n');

    const activeTerm = '2025-2026-Odd';
    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const oddClasses = ['S1', 'S2', 'P1', 'P2', 'D1', 'D2', 'D3', 'PG-F'];

    for (const className of oddClasses) {
        // Filter students by class
        const classStudents = allStudents.filter(s => {
            const termHist = s.academicHistory ? s.academicHistory[activeTerm] : null;
            return termHist && termHist.className === className;
        });

        console.log(`\n--------------------------------------------------`);
        console.log(`CLASS "${className}": ${classStudents.length} students found`);

        let studentsWithMarksCount = 0;
        let totalMarksRecorded = 0;

        classStudents.forEach(cs => {
            const termData = getStudentTermData(cs, activeTerm, className);
            if (termData && termData.marks && Object.keys(termData.marks).length > 0) {
                studentsWithMarksCount++;
                totalMarksRecorded += Object.keys(termData.marks).length;
            }
        });

        console.log(`- Students WITH Marks in ${activeTerm}: ${studentsWithMarksCount}/${classStudents.length}`);
        console.log(`- Total Marks Entries in ${activeTerm}: ${totalMarksRecorded}`);

        // Potential subjects for this class
        let potentialSubjects = allSubjects.filter(s => {
            if (s.activeSemester === 'Even') return false;
            if (s.targetClasses && s.targetClasses.includes(className)) return true;
            if (classStudents.some(cs => {
                const termData = getStudentTermData(cs, activeTerm, className);
                return getMarkForSubject(termData?.marks, s, termData?.subjectMetadata) !== undefined;
            })) return true;
            return false;
        });

        // Also check snapshot subjects
        classStudents.forEach(cs => {
            const termData = getStudentTermData(cs, activeTerm, className);
            if (!termData?.marks) return;
            Object.keys(termData.marks).forEach(subId => {
                const liveSub = allSubjects.find(s => s.id === subId);
                const snapshot = termData.subjectMetadata?.[subId];
                const subName = snapshot?.name || liveSub?.name;
                const alreadyIncluded = potentialSubjects.some(ps => 
                    ps.id === subId || (subName && ps.name.trim().toLowerCase() === subName.trim().toLowerCase())
                );
                if (!alreadyIncluded) {
                    potentialSubjects.push({
                        id: subId,
                        name: snapshot?.name || liveSub?.name || subId,
                        targetClasses: [className],
                        subjectType: liveSub?.subjectType || snapshot?.subjectType || 'general'
                    });
                }
            });
        });

        console.log(`- Resolved Subjects Count for ${className}: ${potentialSubjects.length}`);
        potentialSubjects.forEach(s => {
            console.log(`    Subject: "${s.name}" (ID: ${s.id})`);
        });
    }
}

testClassResults().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
