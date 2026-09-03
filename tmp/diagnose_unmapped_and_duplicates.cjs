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

async function diagnoseUnmappedAndDuplicates() {
    console.log('\n=== DIAGNOSING UNMAPPED SUBJECT IDs AND DUPLICATE MARKS IN 2025-2026-Odd ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    const subjectMap = new Map(allSubjects.map(s => [s.id, s]));

    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

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

    console.log('--- STUDENTS CONTAINING UNMAPPED SUBJECT IDs ---');
    unmappedTargetIds.forEach(targetId => {
        console.log(`\nUnmapped Subject ID: ${targetId}`);
        let count = 0;

        allStudents.forEach(student => {
            const hist = student.academicHistory ? student.academicHistory['2025-2026-Odd'] : null;
            if (hist && hist.marks && hist.marks[targetId]) {
                count++;
                const markObj = hist.marks[targetId];
                const metaObj = hist.subjectMetadata ? hist.subjectMetadata[targetId] : null;
                console.log(`  - Student: "${student.name}" (AdNo: ${student.adNo}, Class: ${hist.className})`);
                console.log(`    Mark:`, markObj);
                console.log(`    Meta:`, metaObj || 'NO METADATA');
            }
        });

        if (count === 0) console.log('  No students found with this ID.');
    });

    console.log('\n--- CHECKING FOR DUPLICATE MARKS BY SUBJECT NAME PER STUDENT IN 2025-2026-Odd ---');
    let duplicateMarkEntriesCount = 0;

    allStudents.forEach(student => {
        const hist = student.academicHistory ? student.academicHistory['2025-2026-Odd'] : null;
        if (!hist || !hist.marks) return;

        const nameToSubIds = {};
        Object.keys(hist.marks).forEach(subId => {
            const dbSubject = subjectMap.get(subId);
            const metaSubject = hist.subjectMetadata ? hist.subjectMetadata[subId] : null;
            const subName = dbSubject?.name || metaSubject?.name || subId;
            const normName = subName.trim().toLowerCase();

            if (!nameToSubIds[normName]) nameToSubIds[normName] = [];
            nameToSubIds[normName].push({ subId, mark: hist.marks[subId], dbSubject, metaSubject });
        });

        Object.entries(nameToToSubIds = nameToSubIds).forEach(([normName, entries]) => {
            if (entries.length > 1) {
                duplicateMarkEntriesCount++;
                console.log(`\nStudent "${student.name}" (AdNo: ${student.adNo}, Class: ${hist.className}) has DUPLICATE subject "${normName}":`);
                entries.forEach((e, idx) => {
                    console.log(`  [Entry ${idx + 1}] subId: ${e.subId} | total: ${e.mark.total} (int:${e.mark.int}, ext:${e.mark.ext}) | inDB: ${!!e.dbSubject} | inMeta: ${!!e.metaSubject}`);
                });
            }
        });
    });

    if (duplicateMarkEntriesCount === 0) {
        console.log('No duplicate mark entries found per student by subject name.');
    }
}

diagnoseUnmappedAndDuplicates().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
