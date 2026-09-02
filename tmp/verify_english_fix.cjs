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

async function verifyEnglishFixSimulation() {
    console.log('=== VERIFYING ENGLISH FIX SIMULATION ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    let subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Apply proposed fix to subjects in memory:
    // 1. Set targetClasses for Basic English (ZT9XwBTEeSP7rOe2x8ik) to include FS2, S1, FS3, S2, HS2, P1
    // 2. Set targetClasses for Communicative English (t34laHHb8z8OsOGje6fl) to include FS2, S1, FS3, S2, HS2, P1
    // 3. Set activeSemester to 'Both' for subjects that exist in both terms
    subjects = subjects.map(s => {
        if (s.id === 'ZT9XwBTEeSP7rOe2x8ik') { // Basic English
            return {
                ...s,
                targetClasses: ['FS2', 'S1', 'FS3', 'S2', 'HS2', 'P1'],
                activeSemester: 'Both'
            };
        }
        if (s.id === 't34laHHb8z8OsOGje6fl') { // Communicative English
            return {
                ...s,
                targetClasses: ['FS2', 'S1', 'FS3', 'S2', 'HS2', 'P1'],
                activeSemester: 'Both'
            };
        }
        if (s.id === 'wfsl5eUpE4E6nn0G1oqb') { // General English
            return { ...s, activeSemester: 'Both' };
        }
        return s;
    });

    const testClasses = ['FS2', 'S1', 'FS3', 'S2', 'HS2', 'P1'];

    for (const selClass of testClasses) {
        console.log(`\n--- CLASS: "${selClass}" in 2025-2026-Even ---`);

        const classStudents = students.filter(s => {
            const c = s.className || s.currentClass;
            return c === selClass || (aliases[selClass] && aliases[selClass].includes(c));
        });

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

        // English subjects listed
        const engSubs = potentialSubjects.filter(s => (s.name || '').toLowerCase().includes('english'));
        console.log(`English subjects visible for "${selClass}":`);
        engSubs.forEach(s => {
            let count = 0;
            classStudents.forEach(cs => {
                const mark = cs.academicHistory?.[activeTerm]?.marks?.[s.id];
                if (mark && (mark.total > 0 || mark.int !== undefined || mark.ext !== undefined)) count++;
            });
            const enrolledCount = (s.enrolledStudents || []).filter(id => classStudents.some(cs => cs.id === id)).length;
            console.log(`  - [${s.id}] "${s.name}" (${s.subjectType}): ${enrolledCount} enrolled, ${count} have Even marks.`);
        });
    }
}

verifyEnglishFixSimulation().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
