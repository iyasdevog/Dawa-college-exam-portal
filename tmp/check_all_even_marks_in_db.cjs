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

async function checkAllEvenMarksInDb() {
    console.log('=== AUDITING ALL EVEN SEMESTER MARKS IN DATABASE (2025-2026-Even) ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const subMap = new Map(subjects.map(s => [s.id, s]));

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const classGroup = {}; // className -> Array of { student, evenMarks }

    students.forEach(st => {
        const history = st.academicHistory || {};
        const evenData = history['2025-2026-Even'];
        const evenMarks = evenData?.marks || {};

        if (Object.keys(evenMarks).length > 0) {
            const cls = st.className || st.currentClass || 'UNKNOWN';
            if (!classGroup[cls]) classGroup[cls] = [];
            classGroup[cls].push({ student: st, evenMarks, metadata: evenData?.subjectMetadata || {} });
        }
    });

    console.log(`Found ${Object.keys(classGroup).length} classes with Even semester marks stored in Firestore:\n`);

    Object.entries(classGroup).forEach(([cls, studentRecords]) => {
        console.log(`=======================================================`);
        console.log(`CLASS "${cls}" (${studentRecords.length} students have Even marks):`);
        console.log(`=======================================================`);

        // Find all distinct subject IDs present in marks for this class
        const subMarksCount = {}; // subId -> count
        studentRecords.forEach(rec => {
            Object.keys(rec.evenMarks).forEach(subId => {
                subMarksCount[subId] = (subMarksCount[subId] || 0) + 1;
            });
        });

        console.log(`Distinct subjects with Even marks in class "${cls}":`);
        Object.entries(subMarksCount).forEach(([subId, count]) => {
            const liveSub = subMap.get(subId);
            const sampleMeta = studentRecords.find(r => r.metadata[subId])?.metadata[subId];
            const name = liveSub?.name || sampleMeta?.name || subId;
            const targetClasses = liveSub?.targetClasses ? liveSub.targetClasses.join(',') : 'NO LIVE SUB';
            const matchesClass = liveSub ? matchClassAlias(liveSub.targetClasses || [], cls) : false;
            const sem = liveSub?.activeSemester || 'N/A';
            const type = liveSub?.subjectType || sampleMeta?.subjectType || 'general';

            console.log(`  - SubID: [${subId}]`);
            console.log(`    Name: "${name}" | Type: ${type} | Sem Tag: ${sem}`);
            console.log(`    Live TargetClasses: [${targetClasses}]`);
            console.log(`    Matches Class "${cls}" in Catalog? ${matchesClass ? 'YES ✅' : 'NO ❌ (May cause catalog filter issues!)'}`);
            console.log(`    Marks Count: ${count} / ${studentRecords.length} students have this mark.`);
        });

        // Detail list of students who have missing marks relative to class subjects
        console.log(`\nStudent breakdown for class "${cls}":`);
        studentRecords.forEach(rec => {
            const st = rec.student;
            const markSummary = Object.entries(rec.evenMarks).map(([subId, m]) => {
                const subName = subMap.get(subId)?.name || rec.metadata[subId]?.name || subId;
                return `${subName}=${m.total} (${m.ext}+${m.int})`;
            }).join(', ');

            console.log(`  St [${st.adNo}] ${st.name}: ${markSummary}`);
        });
        console.log('');
    });
}

checkAllEvenMarksInDb().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
