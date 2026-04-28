import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
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

async function restore() {
    console.log('--- Starting Historical Data Restoration ---');
    
    // 1. Load Backup
    const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
    const backupSubjects = backup.subjects || {};
    const backupStudents = backup.students || {};
    
    console.log(`Loaded ${Object.keys(backupSubjects).length} subjects and ${Object.keys(backupStudents).length} students from backup.`);

    // 2. Restore Subjects for the target term
    console.log(`\nRestoring subjects for ${TARGET_TERM}...`);
    let subjectsRestored = 0;
    
    for (const [id, s] of Object.entries(backupSubjects)) {
        if (s.academicYear === ACADEMIC_YEAR && s.activeSemester === SEMESTER) {
            const docRef = doc(db, 'subjects', id);
            
            // Align targetClasses to include modern names (S1 -> FS2)
            let targets = s.targetClasses || [];
            if (targets.includes('S1') && !targets.includes('FS2')) {
                targets.push('FS2');
            }
            
            await setDoc(docRef, {
                ...s,
                targetClasses: targets,
                restoredAt: new Date().toISOString()
            }, { merge: true });
            
            subjectsRestored++;
        }
    }
    console.log(`✅ Restored/Updated ${subjectsRestored} subjects for ${TARGET_TERM}.`);

    // 3. Align Student History
    console.log(`\nAligning student marks for ${TARGET_TERM}...`);
    
    // Get all live students
    const liveStudentsSnap = await getDocs(collection(db, 'students'));
    const liveStudents = {};
    liveStudentsSnap.forEach(d => {
        const data = d.data();
        liveStudents[data.adNo] = { id: d.id, ...data };
    });

    let studentsUpdated = 0;
    let studentsNotFound = 0;

    for (const [backupId, backupStu] of Object.entries(backupStudents)) {
        const adNo = backupStu.adNo;
        const liveStu = liveStudents[adNo];
        
        if (liveStu && backupStu.academicHistory && backupStu.academicHistory[TARGET_TERM]) {
            const docRef = doc(db, 'students', liveStu.id);
            const termData = backupStu.academicHistory[TARGET_TERM];
            
            // Align history className to include modern names (S1 -> FS2)
            if (termData.className === 'S1') {
                termData.className = 'FS2';
            }
            
            // Update the specific term history
            await updateDoc(docRef, {
                [`academicHistory.${TARGET_TERM}`]: termData
            });
            
            studentsUpdated++;
        } else {
            if (backupStu.academicHistory && backupStu.academicHistory[TARGET_TERM]) {
                 // only report if they actually have data to restore
                studentsNotFound++;
            }
        }
    }
    
    console.log(`✅ Aligned marks for ${studentsUpdated} students.`);
    if (studentsNotFound > 0) console.log(`⚠️ ${studentsNotFound} students from backup with ${TARGET_TERM} data not found in Live DB.`);
    
    console.log('\n--- Restoration Complete ---');
    process.exit(0);
}

restore().catch(err => {
    console.error('Restoration Failed:', err);
    process.exit(1);
});
