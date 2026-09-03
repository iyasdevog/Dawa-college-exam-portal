const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, writeBatch } = require('firebase/firestore');

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

function normalizeSubjectName(name) {
    if (!name) return '';
    return name.toString().trim().toLowerCase()
        .replace(/['"’`]/g, '')
        .replace(/[^a-z0-9\u0600-\u06FF\s]/gi, ' ')
        .replace(/\s+/g, ' ');
}

async function cleanTargetClassesForDuplicateSubjects() {
    console.log('\n=== CLEANING TARGET CLASSES FOR DUPLICATE SUBJECT CATALOG ENTRIES ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const classes = ['S1', 'S2', 'P1', 'P2', 'D1', 'D2', 'D3', 'PG-F'];
    let updatedSubjectsCount = 0;
    const batch = writeBatch(db);

    allSubjects.forEach(subject => {
        if (!subject.targetClasses || subject.targetClasses.length === 0) return;

        let targetClassesChanged = false;
        const newTargetClasses = [];

        subject.targetClasses.forEach(cls => {
            const className = cls.trim();
            const classStudents = allStudents.filter(s => {
                const hist = s.academicHistory ? s.academicHistory['2025-2026-Odd'] : null;
                return hist && hist.className && hist.className.trim().toLowerCase() === className.toLowerCase();
            });

            if (classStudents.length === 0) {
                newTargetClasses.push(className);
                return;
            }

            // Check how many students in this class have marks under THIS subject ID
            let marksCountThisSubject = 0;
            classStudents.forEach(s => {
                const hist = s.academicHistory['2025-2026-Odd'];
                const marksObj = hist.marks || {};
                if (marksObj[subject.id] && (marksObj[subject.id].total > 0 || marksObj[subject.id].int !== undefined || marksObj[subject.id].ext !== undefined)) {
                    marksCountThisSubject++;
                }
            });

            // Check if there is ANOTHER subject with the same name targeting this class that has marks
            const sNormName = normalizeSubjectName(subject.name);
            const otherSubjectsSameName = allSubjects.filter(other => 
                other.id !== subject.id &&
                normalizeSubjectName(other.name) === sNormName &&
                (other.targetClasses || []).includes(className)
            );

            let otherHasMoreMarks = false;
            otherSubjectsSameName.forEach(other => {
                let otherMarksCount = 0;
                classStudents.forEach(s => {
                    const hist = s.academicHistory['2025-2026-Odd'];
                    const marksObj = hist.marks || {};
                    if (marksObj[other.id] && (marksObj[other.id].total > 0 || marksObj[other.id].int !== undefined || marksObj[other.id].ext !== undefined)) {
                        otherMarksCount++;
                    }
                });

                if (otherMarksCount > marksCountThisSubject) {
                    otherHasMoreMarks = true;
                }
            });

            if (otherHasMoreMarks && marksCountThisSubject === 0) {
                console.log(`  - Removing class "${className}" from subject "${subject.name}" [${subject.id}] (0 marks, while another subject has marks)`);
                targetClassesChanged = true;
            } else {
                newTargetClasses.push(className);
            }
        });

        if (targetClassesChanged) {
            const docRef = doc(db, 'subjects', subject.id);
            batch.update(docRef, { targetClasses: newTargetClasses });
            updatedSubjectsCount++;
        }
    });

    if (updatedSubjectsCount > 0) {
        await batch.commit();
        console.log(`\n✅ Cleaned targetClasses for ${updatedSubjectsCount} subject catalog entries!`);
    } else {
        console.log('No targetClasses cleanups needed.');
    }
}

cleanTargetClassesForDuplicateSubjects().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
