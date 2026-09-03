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

async function fixSupplementaryFlagsOnAllStudents() {
    console.log('\n=== ENFORCING isSupplementary: true ON ALL SUPPLEMENTARY MARKS ===\n');

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
        if (!student.academicHistory) return;

        let modified = false;
        const updatedHistory = { ...student.academicHistory };

        Object.keys(updatedHistory).forEach(termKey => {
            const hist = updatedHistory[termKey];
            if (!hist || !hist.marks) return;

            const marks = { ...hist.marks };
            const meta = { ...(hist.subjectMetadata || {}) };

            unmappedTargetIds.forEach(targetId => {
                if (marks[targetId]) {
                    // Force isSupplementary: true
                    marks[targetId] = {
                        ...marks[targetId],
                        isSupplementary: true
                    };

                    meta[targetId] = {
                        name: "Supplementary Exam",
                        arabicName: "",
                        maxEXT: 70,
                        maxINT: 30,
                        passingTotal: 35,
                        subjectType: "supplementary"
                    };

                    modified = true;
                }
            });

            if (modified) {
                hist.marks = marks;
                hist.subjectMetadata = meta;
            }
        });

        if (modified) {
            const docRef = doc(db, 'students', student.id);
            batch.update(docRef, { academicHistory: updatedHistory });
            updatedStudentsCount++;
        }
    });

    if (updatedStudentsCount > 0) {
        await batch.commit();
        console.log(`✅ Successfully set isSupplementary: true for ${updatedStudentsCount} students!`);
    } else {
        console.log('All supplementary marks already have isSupplementary: true.');
    }
}

fixSupplementaryFlagsOnAllStudents().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
