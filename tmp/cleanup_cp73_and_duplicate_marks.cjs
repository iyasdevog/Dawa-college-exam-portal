const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch, doc } = require('firebase/firestore');

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

async function cleanupCP73AndDuplicateMarks() {
    console.log('\n=== CLEANING UP UNMAPPED ID CP73... AND DEDUPLICATING MARKS IN 2025-2026-Odd ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    const subjectMap = new Map(allSubjects.map(s => [s.id, s]));

    const unmappedTargetIds = [
        'CP73DIkL4tGuX8pgH6JU',
        'v1eqpVhe9zwBenNqz5nL',
        'zjfIw4gLzhZUwNgljmsa',
        'qONeFnfq8xP7dXSUlboO',
        'hXwj90u3pLUzQh5pkhcS',
        'kbGr9LuXzpvE3Ws0PiE5',
        'qPqFCSR8H6Gvx9nQbacG',
        'XZ8Sl65cKfzW03J4YhPg'
    ];

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    let updatedStudentsCount = 0;
    const batch = writeBatch(db);

    students.forEach(student => {
        if (!student.academicHistory || !student.academicHistory['2025-2026-Odd']) return;

        const hist = { ...student.academicHistory['2025-2026-Odd'] };
        let marks = { ...(hist.marks || {}) };
        let meta = { ...(hist.subjectMetadata || {}) };
        let modified = false;

        // 1. Ensure metadata exists for supplementary exam entries (like CP73DIkL4tGuX8pgH6JU)
        unmappedTargetIds.forEach(targetId => {
            if (marks[targetId] && !meta[targetId]) {
                meta[targetId] = {
                    name: "Supplementary Exam",
                    arabicName: "",
                    maxEXT: 70,
                    maxINT: 30,
                    passingTotal: 35,
                    facultyName: "",
                    subjectType: "supplementary"
                };
                modified = true;
            }
        });

        // 2. Deduplicate duplicate mark entries by subject name
        const nameToEntries = {};
        Object.keys(marks).forEach(subId => {
            const dbSub = subjectMap.get(subId);
            const metaSub = meta[subId];
            const name = (dbSub?.name || metaSub?.name || subId).trim().toLowerCase();
            if (!nameToEntries[name]) nameToEntries[name] = [];
            nameToEntries[name].push({ subId, mark: marks[subId], dbSub, metaSub });
        });

        Object.entries(nameToEntries).forEach(([name, entries]) => {
            if (entries.length > 1) {
                // Pick the best entry: prefer one with dbSub or metaSub, or higher score
                entries.sort((a, b) => {
                    const scoreA = (a.dbSub ? 2 : 0) + (a.metaSub ? 1 : 0);
                    const scoreB = (b.dbSub ? 2 : 0) + (b.metaSub ? 1 : 0);
                    return scoreB - scoreA;
                });

                // Keep entries[0], remove the rest
                const bestEntry = entries[0];
                for (let i = 1; i < entries.length; i++) {
                    const duplicateSubId = entries[i].subId;
                    delete marks[duplicateSubId];
                    if (meta[duplicateSubId]) delete meta[duplicateSubId];
                    modified = true;
                }
            }
        });

        if (modified) {
            hist.marks = marks;
            hist.subjectMetadata = meta;
            const updatedHistory = {
                ...student.academicHistory,
                '2025-2026-Odd': hist
            };

            const docRef = doc(db, 'students', student.id);
            batch.update(docRef, { academicHistory: updatedHistory });
            updatedStudentsCount++;
        }
    });

    if (updatedStudentsCount > 0) {
        await batch.commit();
        console.log(`✅ Successfully optimized student marks! Updated ${updatedStudentsCount} students.`);
    } else {
        console.log('No student mark cleanups were needed.');
    }
}

cleanupCP73AndDuplicateMarks().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
