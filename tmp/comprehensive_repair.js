import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TARGET_TERM = '2025-2026-Odd';
const YEAR = '2025-2026';
const SEM = 'Odd';

// Mapping based on user feedback
const RENAMES_TO_RESTORE = {
    'FS2': 'S1',
    'FS3': 'S2',
    'FS4': 'S3' // Assuming pattern holds
};

async function globalRepair() {
    console.log(`--- GLOBAL REPAIR FOR ${TARGET_TERM} ---`);

    // 1. Repair Students
    console.log('\n1. Repairing Student History...');
    const studentsSnap = await getDocs(collection(db, 'students'));
    let studentsFixed = 0;
    for (const d of studentsSnap.docs) {
        const data = d.data();
        const history = data.academicHistory?.[TARGET_TERM];
        if (history && RENAMES_TO_RESTORE[history.className]) {
            const oldName = RENAMES_TO_RESTORE[history.className];
            console.log(`Repairing student ${data.adNo}: ${history.className} -> ${oldName}`);
            await updateDoc(d.ref, {
                [`academicHistory.${TARGET_TERM}.className`]: oldName
            });
            studentsFixed++;
        }
    }
    console.log(`✅ Fixed ${studentsFixed} student records.`);

    // 2. Repair Subjects
    console.log('\n2. Repairing Subjects...');
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    let subjectsFixed = 0;
    for (const d of subjectsSnap.docs) {
        const data = d.data();
        if (data.academicYear === YEAR && data.activeSemester === SEM) {
            const targets = data.targetClasses || [];
            let needsUpdate = false;
            const newTargets = targets.map(cls => {
                if (RENAMES_TO_RESTORE[cls]) {
                    needsUpdate = true;
                    return RENAMES_TO_RESTORE[cls];
                }
                return cls;
            });
            
            // Deduplicate
            const uniqueTargets = [...new Set(newTargets)];
            if (uniqueTargets.length !== targets.length) needsUpdate = true;

            if (needsUpdate) {
                console.log(`Repairing subject ${data.name}: ${targets.join(',')} -> ${uniqueTargets.join(',')}`);
                await updateDoc(d.ref, { targetClasses: uniqueTargets });
                subjectsFixed++;
            }
        }
    }
    console.log(`✅ Fixed ${subjectsFixed} subject records.`);

    // 3. Purge Misaligned Attendance
    console.log('\n3. Purging misaligned Attendance documents...');
    const attendanceSnap = await getDocs(collection(db, 'attendance'));
    let attDeleted = 0;
    for (const d of attendanceSnap.docs) {
        const data = d.data();
        if (data.termKey === TARGET_TERM && RENAMES_TO_RESTORE[data.className]) {
            console.log(`🗑️ Deleting misaligned attendance for ${data.className}: ${d.id}`);
            await deleteDoc(d.ref);
            attDeleted++;
        }
    }
    console.log(`✅ Deleted ${attDeleted} attendance documents.`);

    // 4. Purge Misaligned Timetables
    console.log('\n4. Purging misaligned Timetables...');
    const ttSnap = await getDocs(collection(db, 'timetables'));
    let ttDeleted = 0;
    for (const d of ttSnap.docs) {
        const data = d.data();
        if (data.academicYear === YEAR && data.semester === SEM && RENAMES_TO_RESTORE[data.className]) {
             console.log(`🗑️ Deleting misaligned timetable for ${data.className}: ${d.id}`);
             await deleteDoc(d.ref);
             ttDeleted++;
        }
    }
    console.log(`✅ Deleted ${ttDeleted} timetables.`);

    process.exit(0);
}

globalRepair();
