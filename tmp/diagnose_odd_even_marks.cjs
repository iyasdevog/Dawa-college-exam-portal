const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

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

async function diagnoseOddEven() {
    console.log('=== AUDITING 2025-2026 ODD vs EVEN MARKS & SUBJECTS ===\n');

    // 1. Load subjects from Firestore
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const fsSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const fsSubMap = new Map(fsSubjects.map(s => [s.id, s]));

    console.log(`Firestore total subjects: ${fsSubjects.length}`);
    const semCounts = { Odd: 0, Even: 0, Both: 0, Other: 0 };
    fsSubjects.forEach(s => {
        const sem = s.activeSemester || 'Both';
        semCounts[sem] = (semCounts[sem] || 0) + 1;
    });
    console.log('Subject activeSemester counts in Firestore:', semCounts);

    // 2. Load Backup subjects
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    let backup = null;
    if (fs.existsSync(backupPath)) {
        backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    }

    if (backup && backup.subjects) {
        const bkSemCounts = { Odd: 0, Even: 0, Both: 0, Other: 0 };
        backup.subjects.forEach(s => {
            const sem = s.activeSemester || 'Both';
            bkSemCounts[sem] = (bkSemCounts[sem] || 0) + 1;
        });
        console.log('Subject activeSemester counts in Master Backup:', bkSemCounts);
    }

    // 3. Load students from Firestore and analyze academicHistory
    const studentsSnap = await getDocs(collection(db, 'students'));
    const fsStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`\nFirestore total students: ${fsStudents.length}`);

    let totalOddMarks = 0;
    let totalEvenMarks = 0;
    let termKeysFound = new Set();
    let studentsWithOdd = 0;
    let studentsWithEven = 0;
    let hiddenOddMarksDueToSemester = 0; // Odd marks for subjects marked as 'Even'

    fsStudents.forEach(st => {
        const history = st.academicHistory || {};
        Object.keys(history).forEach(tk => termKeysFound.add(tk));

        const oddData = history['2025-2026-Odd'];
        const evenData = history['2025-2026-Even'];

        if (oddData && oddData.marks) {
            const keys = Object.keys(oddData.marks);
            totalOddMarks += keys.length;
            if (keys.length > 0) studentsWithOdd++;

            keys.forEach(subId => {
                const sub = fsSubMap.get(subId);
                const sem = sub?.activeSemester || 'Both';
                if (sem === 'Even') {
                    hiddenOddMarksDueToSemester++;
                }
            });
        }

        if (evenData && evenData.marks) {
            const keys = Object.keys(evenData.marks);
            totalEvenMarks += keys.length;
            if (keys.length > 0) studentsWithEven++;
        }
    });

    console.log('\nAcademic History Term Keys found across all students:', [...termKeysFound]);
    console.log(`2025-2026-Odd: ${studentsWithOdd} students have ${totalOddMarks} mark entries.`);
    console.log(`2025-2026-Even: ${studentsWithEven} students have ${totalEvenMarks} mark entries.`);
    console.log(`⚠️ Marks stored in 2025-2026-Odd where Subject activeSemester is set to 'Even' (causing them to be HIDDEN in Odd UI): ${hiddenOddMarksDueToSemester}`);

    // Check Backup students if available
    if (backup && backup.students) {
        let bkOddMarks = 0;
        let bkEvenMarks = 0;
        backup.students.forEach(st => {
            const history = st.academicHistory || {};
            if (history['2025-2026-Odd']?.marks) bkOddMarks += Object.keys(history['2025-2026-Odd'].marks).length;
            if (history['2025-2026-Even']?.marks) bkEvenMarks += Object.keys(history['2025-2026-Even'].marks).length;
        });
        console.log(`\nMaster Backup (May 23) Marks:`);
        console.log(`  2025-2026-Odd: ${bkOddMarks} mark entries`);
        console.log(`  2025-2026-Even: ${bkEvenMarks} mark entries`);
    }

    // 4. Detail list of subjects where activeSemester was modified to 'Even' but has marks in '2025-2026-Odd'
    console.log('\n=== SUBJECTS WITH activeSemester="Even" THAT STILL HAVE MARKS IN 2025-2026-Odd ===');
    const problemSubjects = new Map();
    fsStudents.forEach(st => {
        const oddMarks = st.academicHistory?.['2025-2026-Odd']?.marks || {};
        Object.keys(oddMarks).forEach(subId => {
            const sub = fsSubMap.get(subId);
            if (sub && sub.activeSemester === 'Even') {
                if (!problemSubjects.has(subId)) {
                    problemSubjects.set(subId, { name: sub.name, targetClasses: sub.targetClasses, count: 0 });
                }
                problemSubjects.get(subId).count++;
            }
        });
    });

    problemSubjects.forEach((info, subId) => {
        console.log(`Subject [${subId}] "${info.name}" (Classes: ${info.targetClasses?.join(',')}) is 'Even' but has ${info.count} marks in 2025-2026-Odd`);
    });
}

diagnoseOddEven().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
