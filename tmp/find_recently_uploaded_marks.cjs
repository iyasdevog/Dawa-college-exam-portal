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

async function findRecentlyUploadedMarks() {
    console.log('=== SEARCHING FOR ALL MARKS & RECENT UPDATES ACROSS ALL STUDENTS ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subMap = new Map(subjectsSnap.docs.map(d => [d.id, d.data().name]));

    let recentMarkCount = 0;
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const termSummary = {}; // termKey -> { totalMarks, recentMarks }

    studentsSnap.docs.forEach(docSnap => {
        const student = docSnap.data();
        const history = student.academicHistory || {};

        Object.entries(history).forEach(([termKey, termData]) => {
            if (!termSummary[termKey]) termSummary[termKey] = { totalMarks: 0, recentMarks: 0, sampleMarks: [] };

            const marks = termData?.marks || {};
            Object.entries(marks).forEach(([subId, mark]) => {
                termSummary[termKey].totalMarks++;
                const isRecent = mark.updatedAt && (now - mark.updatedAt < sevenDaysMs);
                if (isRecent) {
                    termSummary[termKey].recentMarks++;
                    recentMarkCount++;
                    const subName = subMap.get(subId) || termData?.subjectMetadata?.[subId]?.name || subId;
                    if (termSummary[termKey].sampleMarks.length < 5) {
                        termSummary[termKey].sampleMarks.push(`St [${student.adNo}] ${student.name} (${student.className || student.currentClass}): ${subName} = ${mark.total} (updated ${new Date(mark.updatedAt).toISOString()})`);
                    }
                }
            });
        });
    });

    console.log('Term Marks Summary:');
    Object.entries(termSummary).forEach(([tk, data]) => {
        console.log(`\nTerm "${tk}": ${data.totalMarks} total marks, ${data.recentMarks} marks updated in the last 7 days.`);
        if (data.sampleMarks.length > 0) {
            console.log('  Recent sample marks:');
            data.sampleMarks.forEach(s => console.log(`    -> ${s}`));
        }
    });

    // Also check if any top-level marks exist on student docs
    let topLevelMarksCount = 0;
    studentsSnap.docs.forEach(docSnap => {
        const student = docSnap.data();
        if (student.marks && Object.keys(student.marks).length > 0) {
            topLevelMarksCount += Object.keys(student.marks).length;
        }
    });
    console.log(`\nTop-level student.marks count across all students: ${topLevelMarksCount}`);
}

findRecentlyUploadedMarks().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
