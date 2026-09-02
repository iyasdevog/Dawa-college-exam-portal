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

async function verifyHistoricalMarkRule() {
    console.log('=== VERIFYING HISTORICAL MARK-DRIVEN RENDERING (UNBREAKABLE RULE) ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Test for BOTH Odd and Even terms across all classes
    const termsToTest = ['2025-2026-Odd', '2025-2026-Even'];

    termsToTest.forEach(activeTerm => {
        console.log(`\n==================================================`);
        console.log(`TESTING TERM: "${activeTerm}"`);
        console.log(`==================================================`);

        const isOddTerm = activeTerm.endsWith('-Odd');
        const isEvenTerm = activeTerm.endsWith('-Even');

        let totalMarksRenderedInTerm = 0;
        let totalHiddenMarksInTerm = 0;

        // Group students by class
        const classMap = new Map();
        students.forEach(st => {
            const cls = st.className || st.currentClass || 'UNKNOWN';
            if (!classMap.has(cls)) classMap.set(cls, []);
            classMap.get(cls).push(st);
        });

        classMap.forEach((classStudents, selClass) => {
            // New Unbreakable Historical Mark Rule:
            // 1. Start with catalog subjects matching semester tag
            let potentialSubjects = subjects.filter(s => {
                const targetSem = isOddTerm ? 'Odd' : 'Even';
                if (s.activeSemester && s.activeSemester !== targetSem && s.activeSemester !== 'Both') {
                    // Do not include catalog subject for new entry if semester tag doesn't match
                    return false;
                }
                if (matchClassAlias(s.targetClasses || [], selClass)) return true;
                if (s.subjectType === 'elective' && s.enrolledStudents?.some(id => classStudents.some(cs => cs.id === id))) return true;
                return false;
            });

            // 2. UNBREAKABLE HISTORICAL RULE: Include any subject for which marks exist in student.academicHistory[activeTerm]
            classStudents.forEach(cs => {
                const termData = cs.academicHistory?.[activeTerm];
                if (!termData?.marks) return;

                Object.keys(termData.marks).forEach(subId => {
                    const liveSub = subjects.find(s => s.id === subId);
                    const snapshot = termData.subjectMetadata?.[subId];

                    const alreadyIncluded = potentialSubjects.some(ps => ps.id === subId);
                    if (!alreadyIncluded) {
                        potentialSubjects.push({
                            id: subId,
                            name: snapshot?.name || liveSub?.name || subId,
                            arabicName: snapshot?.arabicName || liveSub?.arabicName || '',
                            subjectType: snapshot?.subjectType || liveSub?.subjectType || 'general',
                            activeSemester: snapshot?.activeSemester || liveSub?.activeSemester || 'Both',
                            targetClasses: [selClass]
                        });
                    }
                });
            });

            // Count marks rendered for class
            classStudents.forEach(cs => {
                const termMarks = cs.academicHistory?.[activeTerm]?.marks || {};
                Object.keys(termMarks).forEach(subId => {
                    const isSubjectInView = potentialSubjects.some(ps => ps.id === subId);
                    if (isSubjectInView) {
                        totalMarksRenderedInTerm++;
                    } else {
                        totalHiddenMarksInTerm++;
                        console.log(`  ⚠️ HIDDEN MARK in ${activeTerm} for student [${cs.adNo}] ${cs.name} (${selClass}), subId: ${subId}`);
                    }
                });
            });
        });

        console.log(`\nRESULT FOR ${activeTerm}:`);
        console.log(`  Total marks rendered: ${totalMarksRenderedInTerm}`);
        console.log(`  Total hidden marks: ${totalHiddenMarksInTerm}`);
    });
}

verifyHistoricalMarkRule().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
