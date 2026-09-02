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
    if (marks[subject.id]) return marks[subject.id];
    if (metadata) {
        for (const [subId, meta] of Object.entries(metadata)) {
            if (meta && meta.name && subject.name && meta.name.trim().toLowerCase() === subject.name.trim().toLowerCase()) {
                if (marks[subId]) return marks[subId];
            }
        }
    }
    return undefined;
}

async function testClassResultsFinal() {
    console.log('=== VERIFYING FINAL CLASS RESULTS OUTPUT FOR FS2 AND FS3 ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const activeTerm = '2025-2026-Even';

    ['FS2', 'FS3'].forEach(selectedClass => {
        console.log(`\n==================================================`);
        console.log(`CLASS RESULTS FOR "${selectedClass}" in ${activeTerm}`);
        console.log(`==================================================`);

        const classStudents = students.filter(s => (s.className || s.currentClass) === selectedClass);
        console.log(`Found ${classStudents.length} students.`);

        let potentialSubjects = subjects.filter(s => {
            if (matchClassAlias(s.targetClasses || [], selectedClass)) return true;
            if (s.subjectType === 'elective' && s.enrolledStudents?.some(id => classStudents.some(cs => cs.id === id))) return true;
            return false;
        });

        // Add snapshot recovery subjects
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
                        targetClasses: [selectedClass]
                    });
                }
            });
        });

        // Filter subjects with marks
        const filteredSubjects = potentialSubjects.filter(s => {
            return classStudents.some(cs => {
                const termData = cs.academicHistory?.[activeTerm];
                const m = getMarkForSubject(termData?.marks, s, termData?.subjectMetadata);
                if (!m) return false;
                return (typeof m.total === 'number' && m.total > 0) || m.int !== undefined || m.ext !== undefined;
            });
        });

        console.log(`Filtered subjects visible for class (${filteredSubjects.length}):`);
        filteredSubjects.forEach(s => console.log(`  - [${s.id}] "${s.name}" (Type: ${s.subjectType})`));

        const electiveSubjects = filteredSubjects.filter(s => s.subjectType === 'elective');
        console.log(`Elective Subjects found: ${electiveSubjects.length}`);

        console.log('\n  Student Elective Column Output:');
        classStudents.forEach(st => {
            const termData = st.academicHistory?.[activeTerm] || {};
            const studentElective = electiveSubjects.find(s => {
                const m = getMarkForSubject(termData.marks, s, termData.subjectMetadata);
                return m !== undefined && m !== null;
            });
            const electiveMark = studentElective ? getMarkForSubject(termData.marks, studentElective, termData.subjectMetadata) : null;

            const nameStr = studentElective?.name || 'NONE';
            const markStr = electiveMark ? `Total: ${electiveMark.total} (${electiveMark.ext}+${electiveMark.int})` : 'NO MARK';

            console.log(`    Student [${st.adNo}] ${st.name.padEnd(25)} | Elective: ${nameStr.padEnd(22)} | ${markStr}`);
        });
    });
}

testClassResultsFinal().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
