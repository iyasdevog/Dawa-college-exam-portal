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

// Class mapping in portal:
// Active term: "2025-2026-Even"
// Selected Class: "S1" (maps to FS2 in db) or "S2" (maps to FS3 in db) or "FS2" or "FS3"

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

async function simulateClassResults() {
    console.log('=== SIMULATING CLASS RESULTS FOR EVEN SEMESTER (2025-2026-Even) ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const testClasses = ['S1', 'FS2', 'S2', 'FS3'];

    for (const selClass of testClasses) {
        console.log(`\n========================================`);
        console.log(`TESTING SELECTED CLASS: "${selClass}" in 2025-2026-Even`);
        console.log(`========================================`);

        // Find students in this class
        const classStudents = students.filter(s => {
            const c = s.className || s.currentClass;
            return c === selClass || (aliases[selClass] && aliases[selClass].includes(c));
        });

        console.log(`Found ${classStudents.length} students matching class "${selClass}".`);

        // Filter potential subjects
        const activeTerm = '2025-2026-Even';
        const isOddTerm = false;
        const isEvenTerm = true;

        let potentialSubjects = subjects.filter(s => {
            if (isOddTerm && s.activeSemester === 'Even') return false;
            if (isEvenTerm && s.activeSemester === 'Odd') return false;

            if (matchClassAlias(s.targetClasses || [], selClass)) return true;
            if (s.subjectType === 'elective' && s.enrolledStudents?.some(id => classStudents.some(cs => cs.id === id))) return true;
            if (s.subjectType === 'elective' && classStudents.some(cs => {
                const termData = cs.academicHistory?.[activeTerm];
                const mark = termData?.marks?.[s.id];
                return mark && ((typeof mark.total === 'number' && mark.total > 0) || mark.int !== undefined || mark.ext !== undefined);
            })) return true;
            return false;
        });

        console.log(`Potential subjects (${potentialSubjects.length}):`);
        potentialSubjects.forEach(s => {
            console.log(`  - [${s.id}] "${s.name}" (Type: ${s.subjectType}, Sem: ${s.activeSemester}, TargetClasses: [${s.targetClasses?.join(',')}])`);
        });

        // Snapshot subjects recovery simulation
        classStudents.forEach(cs => {
            const termData = cs.academicHistory?.[activeTerm];
            if (!termData?.marks) return;
            Object.keys(termData.marks).forEach(subId => {
                const liveSub = subjects.find(s => s.id === subId);
                const snapshot = termData.subjectMetadata?.[subId];
                const subSem = liveSub?.activeSemester || snapshot?.activeSemester || 'Both';

                if (isOddTerm && subSem === 'Even') return;
                if (isEvenTerm && subSem === 'Odd') return;

                const subName = snapshot?.name || liveSub?.name;
                const alreadyIncluded = potentialSubjects.some(ps => 
                    ps.id === subId || (subName && ps.name.trim().toLowerCase() === subName.trim().toLowerCase())
                );

                if (!alreadyIncluded) {
                    potentialSubjects.push({
                        id: subId,
                        name: snapshot?.name || liveSub?.name || subId,
                        activeSemester: 'Even'
                    });
                    console.log(`  + Snapshot restored [${subId}] "${snapshot?.name || liveSub?.name}"`);
                }
            });
        });

        // Check marks for each potential subject across students
        console.log(`\n  Marks presence per subject for class "${selClass}":`);
        potentialSubjects.forEach(ps => {
            let count = 0;
            classStudents.forEach(cs => {
                const mark = cs.academicHistory?.[activeTerm]?.marks?.[ps.id];
                if (mark && (mark.total > 0 || mark.int !== undefined || mark.ext !== undefined)) {
                    count++;
                }
            });
            console.log(`    Subject [${ps.id}] "${ps.name}": ${count} students have marks.`);
        });
    }
}

simulateClassResults().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
