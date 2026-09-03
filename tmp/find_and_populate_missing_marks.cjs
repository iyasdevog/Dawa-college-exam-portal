const fs = require('fs');
const path = require('path');
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

async function findAndPopulateMissingMarksFromBackup() {
    console.log('\n=== CHECKING & POPULATING MISSING MARKS FROM MAY 23 MASTER BACKUP ===\n');

    // 1. Load Backup File
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    if (!fs.existsSync(backupPath)) {
        console.error('Backup file not found at:', backupPath);
        return;
    }

    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    const backupStudents = backupData.students || [];
    console.log(`Loaded ${backupStudents.length} students from master backup.`);

    // Map backup students by admission number (adNo)
    const backupByAdNo = new Map();
    backupStudents.forEach(bs => {
        if (bs.adNo) backupByAdNo.set(String(bs.adNo).trim(), bs);
    });

    // 2. Fetch live subjects & students
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const liveSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    const liveSubjectMap = new Map(liveSubjects.map(s => [s.id, s]));

    const studentsSnap = await getDocs(collection(db, 'students'));
    const liveStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    console.log(`Loaded ${liveStudents.length} live students from Firestore.`);

    let missingMarksFound = 0;
    let studentsToUpdate = 0;
    const batch = writeBatch(db);

    liveStudents.forEach(student => {
        const adNoKey = String(student.adNo).trim();
        const backupStudent = backupByAdNo.get(adNoKey);
        if (!backupStudent) return;

        const liveHist = student.academicHistory ? student.academicHistory['2025-2026-Odd'] : null;
        if (!liveHist) return;

        const backupHist = backupStudent.academicHistory ? (backupStudent.academicHistory['2025-2026-Odd'] || backupStudent.academicHistory['2025-2026-Odd']) : null;
        const backupMarks = backupHist ? backupHist.marks : backupStudent.marks;

        if (!backupMarks || Object.keys(backupMarks).length === 0) return;

        let liveMarks = { ...(liveHist.marks || {}) };
        let liveMeta = { ...(liveHist.subjectMetadata || {}) };
        let modified = false;

        Object.entries(backupMarks).forEach(([bSubId, bMark]) => {
            // Find corresponding subject in live DB by subId or by name
            const backupMeta = backupHist?.subjectMetadata?.[bSubId] || backupStudent.subjectMetadata?.[bSubId];
            const subName = backupMeta?.name;

            // Check if liveMarks already has a mark for this subject (either key exists or name matches)
            let hasLiveMark = false;
            if (liveMarks[bSubId]) {
                hasLiveMark = true;
            } else if (subName) {
                const normName = subName.trim().toLowerCase();
                hasLiveMark = Object.keys(liveMarks).some(lk => {
                    const lMeta = liveMeta[lk];
                    const lSub = liveSubjectMap.get(lk);
                    const lName = (lSub?.name || lMeta?.name || '').trim().toLowerCase();
                    return lName === normName;
                });
            }

            if (!hasLiveMark && bMark && (bMark.int !== undefined || bMark.ext !== undefined || bMark.total > 0)) {
                // Find matching live subject ID for this student's class
                const targetClassName = liveHist.className || student.currentClass;
                const matchingLiveSub = liveSubjects.find(ls => 
                    subName && ls.name.trim().toLowerCase() === subName.trim().toLowerCase() &&
                    (ls.targetClasses || []).includes(targetClassName) &&
                    ls.academicYear === '2025-2026' &&
                    ls.activeSemester === 'Odd'
                ) || liveSubjects.find(ls => subName && ls.name.trim().toLowerCase() === subName.trim().toLowerCase());

                const useId = matchingLiveSub ? matchingLiveSub.id : bSubId;

                liveMarks[useId] = {
                    int: bMark.int !== undefined ? Number(bMark.int) : (Number(bMark.ce) || 0),
                    ext: bMark.ext !== undefined ? Number(bMark.ext) : (Number(bMark.ta) || 0),
                    total: Number(bMark.total) || 0,
                    status: bMark.status || 'Passed'
                };

                if (backupMeta) {
                    liveMeta[useId] = backupMeta;
                }

                modified = true;
                missingMarksFound++;
                console.log(`  + Restored mark for "${student.name}" (AdNo: ${student.adNo}, Class: ${targetClassName}) | Subject: "${subName || useId}" | total: ${bMark.total}`);
            }
        });

        if (modified) {
            liveHist.marks = liveMarks;
            liveHist.subjectMetadata = liveMeta;

            const updatedHistory = {
                ...student.academicHistory,
                '2025-2026-Odd': liveHist
            };

            const docRef = doc(db, 'students', student.id);
            batch.update(docRef, { academicHistory: updatedHistory });
            studentsToUpdate++;
        }
    });

    console.log(`\nTotal missing mark entries found & restored: ${missingMarksFound}`);
    if (studentsToUpdate > 0) {
        await batch.commit();
        console.log(`✅ Successfully committed missing marks for ${studentsToUpdate} students to Firestore!`);
    } else {
        console.log('No missing marks needed restoration.');
    }
}

findAndPopulateMissingMarksFromBackup().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
