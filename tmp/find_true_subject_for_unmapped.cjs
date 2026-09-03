const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

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

async function findTrueSubjectForUnmappedIds() {
    console.log('\n=== FINDING TRUE SUBJECT IDs FOR THE 8 UNMAPPED MARKS ===\n');

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

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    unmappedTargetIds.forEach(targetId => {
        console.log(`\n--------------------------------------------------`);
        console.log(`Unmapped ID: ${targetId}`);

        allStudents.forEach(student => {
            const hist = student.academicHistory ? student.academicHistory['2025-2026-Odd'] : null;
            if (hist && hist.marks && hist.marks[targetId]) {
                const mark = hist.marks[targetId];
                console.log(`Student: "${student.name}" (adNo:${student.adNo}, class:${hist.className}) | mark: total=${mark.total}, int=${mark.int}, ext=${mark.ext}`);
                
                // Print all subject names & IDs for this student's class
                const classSubjects = allSubjects.filter(s => 
                    (s.targetClasses || []).includes(hist.className) && 
                    s.academicYear === '2025-2026' && 
                    s.activeSemester === 'Odd'
                );

                console.log(`  Candidate Class Subjects for ${hist.className} (2025-2026-Odd):`);
                classSubjects.forEach(cs => {
                    const studentHasMarkForThis = hist.marks[cs.id];
                    console.log(`    - "${cs.name}" (id: ${cs.id}) → student already has mark? ${!!studentHasMarkForThis}`);
                });
            }
        });
    });
}

findTrueSubjectForUnmappedIds().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
