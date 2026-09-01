const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, writeBatch } = require('firebase/firestore');

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

async function cleanDatabase() {
    console.log('=== DEEP DATABASE CLEANUP & ELECTIVES FIX ===\n');

    // 1. Ensure Communicative Arabic targetClasses is restricted to HS3, P2, PG1, D3
    console.log('1. Restricting Communicative Arabic (Du5idoGnJfvUVsWB3Drg) targetClasses...');
    await setDoc(doc(db, 'subjects', 'Du5idoGnJfvUVsWB3Drg'), {
        name: 'Communicative Arabic',
        subjectType: 'elective',
        activeSemester: 'Both',
        targetClasses: ['HS3', 'P2', 'PG1', 'D3']
    }, { merge: true });

    // 2. Restore FS2 Electives in subjects collection
    console.log('2. Configuring FS2 Electives (ZJ10NiJMiV8nGZ4qx0g4 - Communicative English)...');
    await setDoc(doc(db, 'subjects', 'ZJ10NiJMiV8nGZ4qx0g4'), {
        name: 'Communicative English',
        subjectType: 'elective',
        activeSemester: 'Both',
        targetClasses: ['FS2', 'S1']
    }, { merge: true });

    await setDoc(doc(db, 'subjects', '6gZ0p8rH9re48nlfDaWr'), {
        name: 'Basic English',
        subjectType: 'elective',
        activeSemester: 'Both',
        targetClasses: ['FS2', 'S1']
    }, { merge: true });

    // 3. Ensure FS3 Elective (ZT9XwBTEeSP7rOe2x8ik - Basic English) targetClasses includes FS3, S2
    console.log('3. Configuring FS3 Elective (ZT9XwBTEeSP7rOe2x8ik - Basic English)...');
    await setDoc(doc(db, 'subjects', 'ZT9XwBTEeSP7rOe2x8ik'), {
        name: 'Basic English',
        subjectType: 'elective',
        activeSemester: 'Both',
        targetClasses: ['FS3', 'S2']
    }, { merge: true });

    console.log('✅ Subject configurations updated.\n');

    // 4. Scan all student documents
    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ ref: d.ref, id: d.id, ...d.data() }));

    console.log(`Scanning ${students.length} student documents for cleanup...`);

    let batch = writeBatch(db);
    let count = 0;
    let totalUpdated = 0;

    students.forEach(st => {
        const cls = st.className || st.currentClass || '';
        const history = JSON.parse(JSON.stringify(st.academicHistory || {}));
        const topMarks = JSON.parse(JSON.stringify(st.marks || {}));
        let changed = false;

        // Rule A: Remove Communicative Arabic (Du5idoGnJfvUVsWB3Drg) from FS2 (S1) and FS3 (S2) students
        if (['FS2', 'S1', 'FS3', 'S2', 'FS1', 'Hifz'].includes(cls)) {
            if (topMarks['Du5idoGnJfvUVsWB3Drg'] !== undefined) {
                delete topMarks['Du5idoGnJfvUVsWB3Drg'];
                changed = true;
            }

            Object.keys(history).forEach(termKey => {
                const marks = history[termKey]?.marks;
                if (marks && marks['Du5idoGnJfvUVsWB3Drg'] !== undefined) {
                    delete marks['Du5idoGnJfvUVsWB3Drg'];
                    changed = true;
                }
            });
        }

        // Rule B: Remap FS2 student orphan key qONeFnfq8xP7dXSUlboO -> ZJ10NiJMiV8nGZ4qx0g4 (Communicative English elective)
        if (['FS2', 'S1'].includes(cls)) {
            Object.keys(history).forEach(termKey => {
                const marks = history[termKey]?.marks;
                if (marks && marks['qONeFnfq8xP7dXSUlboO'] !== undefined) {
                    const markVal = marks['qONeFnfq8xP7dXSUlboO'];
                    delete marks['qONeFnfq8xP7dXSUlboO'];
                    marks['ZJ10NiJMiV8nGZ4qx0g4'] = markVal;
                    changed = true;
                }
            });
        }

        if (changed) {
            batch.update(st.ref, {
                academicHistory: history,
                marks: topMarks
            });
            count++;
            totalUpdated++;
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

    console.log(`\n✅ Database cleanup complete! Updated ${totalUpdated} student documents.`);
}

cleanDatabase().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
