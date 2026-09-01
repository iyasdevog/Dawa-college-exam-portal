const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, updateDoc, getDocs, collection, writeBatch } = require('firebase/firestore');
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

async function executeRefinedFix() {
    console.log('=== EXECUTING REFINED SUBJECT & ELECTIVE RESTORATION ===\n');

    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const bkSubjects = backup.subjects || [];
    const bkStudents = backup.students || [];

    // 1. Restore/Update Subject Documents in Firestore

    // A. English Elective for D1, D2, D3
    console.log('1. Setting up English Elective (xd6INM4khNcQM4PHVehF)...');
    await setDoc(doc(db, 'subjects', 'xd6INM4khNcQM4PHVehF'), {
        name: 'ENGLISH',
        subjectType: 'elective',
        activeSemester: 'Odd',
        targetClasses: ['D1', 'D2', 'D3'],
        createdAt: Date.now()
    }, { merge: true });

    // B. Communicative Arabic Elective
    console.log('2. Setting up Communicative Arabic as Elective (Du5idoGnJfvUVsWB3Drg)...');
    await setDoc(doc(db, 'subjects', 'Du5idoGnJfvUVsWB3Drg'), {
        name: 'Communicative Arabic',
        subjectType: 'elective',
        activeSemester: 'Both',
        targetClasses: ['HS3', 'P2', 'PG1', 'D3'],
        createdAt: Date.now()
    }, { merge: true });

    // C. Malayalam for S1/FS2 (D5ZEMWpBGGhGvESByu4l)
    console.log('3. Restoring Malayalam for S1/FS2 (D5ZEMWpBGGhGvESByu4l)...');
    await setDoc(doc(db, 'subjects', 'D5ZEMWpBGGhGvESByu4l'), {
        name: 'Malayalam',
        subjectType: 'school_subject',
        activeSemester: 'Both',
        targetClasses: ['FS2', 'S1', 'FS1'],
        createdAt: Date.now()
    }, { merge: true });

    // D. Update Malayalam for S2/FS3 (Kogdr0NtmlAEQR6WiUCw)
    console.log('4. Updating Malayalam for S2/FS3 (Kogdr0NtmlAEQR6WiUCw)...');
    await setDoc(doc(db, 'subjects', 'Kogdr0NtmlAEQR6WiUCw'), {
        name: 'Malayalam',
        subjectType: 'school_subject',
        activeSemester: 'Both',
        targetClasses: ['FS3', 'S2', 'Hifz'],
        createdAt: Date.now()
    }, { merge: true });

    // E. Remove D1, D2, D3 from General English (wfsl5eUpE4E6nn0G1oqb)
    console.log('5. Updating General English targetClasses (wfsl5eUpE4E6nn0G1oqb)...');
    await setDoc(doc(db, 'subjects', 'wfsl5eUpE4E6nn0G1oqb'), {
        name: 'English',
        subjectType: 'general',
        activeSemester: 'Both',
        targetClasses: ['HS1', 'HS2', 'P1', 'HS3', 'P2', 'FS2', 'S1', 'FS3', 'S2', 'Hifz', 'FS1'],
        createdAt: Date.now()
    }, { merge: true });

    // F. Ensure Arabic for P1/HS2 (c36I4lMYbFsEbfnXggbB & 9p3liMeHUuuMMxoCRG60)
    console.log('6. Ensuring Arabic and Optional Arabic for P1/HS2...');
    await setDoc(doc(db, 'subjects', 'c36I4lMYbFsEbfnXggbB'), {
        name: 'Arabic',
        subjectType: 'school_subject',
        activeSemester: 'Both',
        targetClasses: ['HS2', 'P1', 'HS1'],
        createdAt: Date.now()
    }, { merge: true });

    await setDoc(doc(db, 'subjects', '9p3liMeHUuuMMxoCRG60'), {
        name: 'Optional Arabic',
        subjectType: 'school_subject',
        activeSemester: 'Both',
        targetClasses: ['HS2', 'P1', 'HS1'],
        createdAt: Date.now()
    }, { merge: true });

    console.log('\nSubject configurations updated successfully!\n');

    // 2. Remap Student Marks in Firestore

    const studentsSnap = await getDocs(collection(db, 'students'));
    console.log(`Scanning ${studentsSnap.docs.length} student documents for mark remapping...`);

    let studentUpdatesCount = 0;
    let batch = writeBatch(db);
    let count = 0;

    studentsSnap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const cls = data.className || data.currentClass || '';
        const history = JSON.parse(JSON.stringify(data.academicHistory || {}));
        let changed = false;

        Object.keys(history).forEach(termKey => {
            const termData = history[termKey];
            if (!termData || !termData.marks) return;

            const marks = termData.marks;
            const newMarks = {};

            Object.keys(marks).forEach(subId => {
                let targetId = subId;

                // Rule A: D1, D2, D3 students -> English general (wfsl5eUpE4E6nn0G1oqb) becomes English Elective (xd6INM4khNcQM4PHVehF)
                if (['D1', 'D2', 'D3'].includes(cls) && subId === 'wfsl5eUpE4E6nn0G1oqb') {
                    targetId = 'xd6INM4khNcQM4PHVehF';
                    changed = true;
                }

                // Rule B: FS2, S1 students -> Malayalam (Kogdr0NtmlAEQR6WiUCw) becomes S1 Malayalam (D5ZEMWpBGGhGvESByu4l)
                if (['FS2', 'S1', 'FS1'].includes(cls) && subId === 'Kogdr0NtmlAEQR6WiUCw') {
                    targetId = 'D5ZEMWpBGGhGvESByu4l';
                    changed = true;
                }

                if (!newMarks[targetId] || (marks[subId]?.total || 0) > (newMarks[targetId]?.total || 0)) {
                    newMarks[targetId] = marks[subId];
                }
            });

            history[termKey].marks = newMarks;
        });

        if (changed) {
            batch.update(docSnap.ref, { academicHistory: history });
            count++;
            studentUpdatesCount++;
            if (count >= 400) {
                batch.commit();
                batch = writeBatch(db);
                count = 0;
            }
        }
    });

    if (count > 0) {
        await batch.commit();
    }

    console.log(`✅ Remapped marks for ${studentUpdatesCount} student records.`);
    console.log('REFINED SUBJECT & ELECTIVE RESTORATION COMPLETED!');
}

executeRefinedFix().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
