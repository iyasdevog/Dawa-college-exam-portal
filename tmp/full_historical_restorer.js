import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BACKUP_PATH = 'public/AIC_Dawa_Portal_Master_Backup_2026-04-04T04-11-10.json';
const TARGET_TERM = '2025-2026-Odd';
const ACADEMIC_YEAR = '2025-2026';
const SEMESTER = 'Odd';

/**
 * FULL HISTORICAL RESTORER
 * Restores Subjects, Marks, Attendance, and Timetables for a specific term.
 */
async function fullRestore() {
    console.log('--- Starting FULL Historical Restoration ---');
    
    // 1. Load Backup
    const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
    
    // 1.5 CLEANUP MISALIGNED FS2 RECORDS for this term
    console.log(`\n1.5 Cleaning up misaligned FS2 records for ${TARGET_TERM}...`);
    const attendanceSnap = await getDocs(collection(db, 'attendance'));
    for (const d of attendanceSnap.docs) {
        const data = d.data();
        if (data.termKey === TARGET_TERM && data.className === 'FS2') {
            await deleteDoc(d.ref);
            console.log(`🗑️ Deleted misaligned attendance: ${d.id}`);
        }
    }
    const timetableSnap = await getDocs(collection(db, 'timetables'));
    for (const d of timetableSnap.docs) {
        const data = d.data();
        if (data.semester === SEMESTER && data.academicYear === ACADEMIC_YEAR && data.className === 'FS2') {
            await deleteDoc(d.ref);
            console.log(`🗑️ Deleted misaligned timetable: ${d.id}`);
        }
    }
    
    // 2. RESTORE SUBJECTS
    console.log(`\n1. Restoring subjects for ${TARGET_TERM}...`);
    const backupSubjects = backup.subjects || {};
    let subjectsRestored = 0;
    for (const [id, s] of Object.entries(backupSubjects)) {
        if (s.academicYear === ACADEMIC_YEAR && s.activeSemester === SEMESTER) {
            const docRef = doc(db, 'subjects', id);
            let targets = s.targetClasses || [];
            // Preserve original targets from backup
            await setDoc(docRef, { ...s, targetClasses: targets, restoredAt: new Date().toISOString() }, { merge: true });
            subjectsRestored++;
        }
    }
    console.log(`✅ Restored ${subjectsRestored} subjects.`);

    // 3. RESTORE ATTENDANCE
    console.log(`\n2. Restoring attendance for ${TARGET_TERM}...`);
    const backupAttendance = backup.attendance || {};
    let attendanceRestored = 0;
    for (const [id, a] of Object.entries(backupAttendance)) {
        if (a.termKey === TARGET_TERM) {
            // Preservation: use original IDs and class names
            const docRef = doc(db, 'attendance', id);
            await setDoc(docRef, a, { merge: true });
            attendanceRestored++;
        }
    }
    console.log(`✅ Restored ${attendanceRestored} attendance documents.`);

    // 4. RESTORE TIMETABLES
    console.log(`\n3. Restoring timetables for ${TARGET_TERM}...`);
    const backupTimetables = backup.timetables || {};
    let timetablesRestored = 0;
    for (const [id, t] of Object.entries(backupTimetables)) {
        if (t.academicYear === ACADEMIC_YEAR && t.semester === SEMESTER) {
            // Preservation: use original IDs and class names
            const docRef = doc(db, 'timetables', id);
            await setDoc(docRef, t, { merge: true });
            timetablesRestored++;
        }
    }
    console.log(`✅ Restored ${timetablesRestored} timetables.`);

    // 5. RESTORE STUDENT MARKS (Academic History)
    console.log(`\n4. Re-aligning student history snapshots...`);
    const backupStudents = backup.students || {};
    const liveStudentsSnap = await getDocs(collection(db, 'students'));
    const liveStudents = {};
    liveStudentsSnap.forEach(d => { liveStudents[d.data().adNo] = { id: d.id, ...d.data() }; });

    let studentsUpdated = 0;
    for (const [bid, bstu] of Object.entries(backupStudents)) {
        const liveStu = liveStudents[bstu.adNo];
        if (liveStu && bstu.academicHistory?.[TARGET_TERM]) {
            const docRef = doc(db, 'students', liveStu.id);
            const termData = bstu.academicHistory[TARGET_TERM];
            if (termData.className === 'S1') termData.className = 'FS2';
            
            await updateDoc(docRef, { [`academicHistory.${TARGET_TERM}`]: termData });
            studentsUpdated++;
        }
    }
    console.log(`✅ Updated marks for ${studentsUpdated} students.`);

    console.log('\n--- FULL RESTORATION COMPLETE ---');
    process.exit(0);
}

fullRestore().catch(err => {
    console.error('Restoration Failed:', err);
    process.exit(1);
});
