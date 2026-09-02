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

const aliases = {
    'S1': ['FS2'], 'FS2': ['S1'],
    'S2': ['FS3'], 'FS3': ['S2'],
    'P1': ['HS2'], 'HS2': ['P1'],
    'P2': ['HS3'], 'HS3': ['P2']
};

function matchClassAlias(clsList, cls) {
    if (!clsList || !cls) return false;
    if (clsList.includes(cls)) return true;
    const equivalent = aliases[cls] || [];
    return equivalent.some(alias => clsList.includes(alias));
}

function getMarkForSubject(marks, subject, metadata) {
    if (!marks || !subject) return undefined;
    if (marks[subject.id] !== undefined) return marks[subject.id];
    if (metadata) {
        for (const [subId, meta] of Object.entries(metadata)) {
            if (meta && meta.name && subject.name && meta.name.trim().toLowerCase() === subject.name.trim().toLowerCase()) {
                if (marks[subId] !== undefined) return marks[subId];
            }
        }
    }
    return undefined;
}

async function verifyAllClassesParity() {
    console.log('=== AUDITING FULL PARITY BETWEEN FIRESTORE EVEN MARKS & DISPLAY LOGIC ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const activeTerm = '2025-2026-Even';

    // Group students by currentClass / className
    const classMap = {};
    students.forEach(st => {
        const cls = st.className || st.currentClass;
        if (cls) {
            if (!classMap[cls]) classMap[cls] = [];
            classMap[cls].push(st);
        }
    });

    let totalHiddenMarks = 0;
    let totalVerifiedMarks = 0;

    Object.entries(classMap).forEach(([className, classStudents]) => {
        let potentialSubjects = subjects.filter(s => {
            if (s.activeSemester === 'Odd') return false;
            if (matchClassAlias(s.targetClasses || [], className)) return true;
            if (s.subjectType === 'elective' && s.enrolledStudents?.some(id => classStudents.some(cs => cs.id === id))) return true;
            return false;
        });

        // Add snapshot subjects for any student in class
        classStudents.forEach(cs => {
            const termData = cs.academicHistory?.[activeTerm];
            if (!termData?.marks) return;
            Object.keys(termData.marks).forEach(subId => {
                const liveSub = subjects.find(s => s.id === subId);
                const snapshot = termData.subjectMetadata?.[subId];
                const subName = snapshot?.name || liveSub?.name;
                const alreadyIncluded = potentialSubjects.some(ps => ps.id === subId || (subName && ps.name.trim().toLowerCase() === subName.trim().toLowerCase()));

                if (!alreadyIncluded) {
                    potentialSubjects.push({
                        id: subId,
                        name: snapshot?.name || liveSub?.name || subId,
                        subjectType: snapshot?.subjectType || liveSub?.subjectType || 'general',
                        targetClasses: [className]
                    });
                }
            });
        });

        // Audit each student in class
        classStudents.forEach(st => {
            const termData = st.academicHistory?.[activeTerm];
            const storedMarks = termData?.marks || {};

            Object.entries(storedMarks).forEach(([subId, markVal]) => {
                totalVerifiedMarks++;
                const liveSub = subjects.find(s => s.id === subId);
                const meta = termData.subjectMetadata?.[subId];
                const subName = meta?.name || liveSub?.name || subId;

                // Test if this subject is resolved by ClassResults display logic
                const foundSubject = potentialSubjects.find(s => s.id === subId || (subName && s.name.trim().toLowerCase() === subName.trim().toLowerCase()));
                const resolvedMark = foundSubject ? getMarkForSubject(storedMarks, foundSubject, termData.subjectMetadata) : undefined;

                if (!resolvedMark) {
                    totalHiddenMarks++;
                    console.log(`❌ HIDDEN MARK DISCOVERED! Class "${className}", Student [${st.adNo}] ${st.name}: Sub [${subId}] "${subName}" = ${markVal.total}`);
                }
            });
        });
    });

    console.log(`\n=======================================================`);
    console.log(`AUDIT COMPLETE: Verified ${totalVerifiedMarks} stored Even semester marks.`);
    console.log(`Hidden Marks Count: ${totalHiddenMarks}`);
    console.log(`=======================================================`);
}

verifyAllClassesParity().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
