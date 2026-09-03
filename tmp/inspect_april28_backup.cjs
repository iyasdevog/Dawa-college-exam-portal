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

async function inspectApril28Backup() {
    console.log('\n=== INSPECTING APRIL 28 BACKUP FILE FOR ARSHAD PK & BILAL ===\n');

    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-04-28T03-34-47.json');
    if (!fs.existsSync(backupPath)) {
        console.error('Backup file not found at:', backupPath);
        return;
    }

    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const backupStudents = backupData.students || [];
    const backupSubjects = backupData.subjects || [];
    const backupSubjectMap = new Map(backupSubjects.map(s => [s.id, s]));

    console.log(`April 28 Backup stats: ${backupStudents.length} students, ${backupSubjects.length} subjects`);

    const targetAdNos = ['116', '124'];

    console.log('\n--- APRIL 28 BACKUP DATA FOR ARSHAD PK (116) AND BILAL (124) ---');

    targetAdNos.forEach(adNo => {
        const bkSt = backupStudents.find(s => String(s.adNo) === adNo);
        if (bkSt) {
            console.log(`\nStudent: "${bkSt.name}" (adNo: ${bkSt.adNo}, currentClass: ${bkSt.currentClass}, className: ${bkSt.className})`);
            const historyObj = bkSt.academicHistory || {};
            console.log('Available history term keys:', Object.keys(historyObj));

            Object.entries(historyObj).forEach(([termKey, hist]) => {
                console.log(`  Term "${termKey}" (Class: ${hist.className}):`);
                const marksObj = hist.marks || {};
                const metaObj = hist.subjectMetadata || bkSt.subjectMetadata || {};

                Object.entries(marksObj).forEach(([subId, mark]) => {
                    const catSub = backupSubjectMap.get(subId);
                    const metaSub = metaObj[subId];
                    const name = catSub?.name || metaSub?.name || subId;
                    const type = catSub?.subjectType || metaSub?.subjectType || 'general';
                    console.log(`    - [${subId}] "${name}" (type: ${type}): total=${mark.total} (ext:${mark.ext ?? mark.ta}, int:${mark.int ?? mark.ce})`);
                });
            });

            if (bkSt.marks && Object.keys(bkSt.marks).length > 0) {
                console.log('  Top-level marks object:');
                Object.entries(bkSt.marks).forEach(([subId, mark]) => {
                    const catSub = backupSubjectMap.get(subId);
                    const metaSub = bkSt.subjectMetadata?.[subId];
                    const name = catSub?.name || metaSub?.name || subId;
                    const type = catSub?.subjectType || metaSub?.subjectType || 'general';
                    console.log(`    - [${subId}] "${name}" (type: ${type}): total=${mark.total} (ext:${mark.ext ?? mark.ta}, int:${mark.int ?? mark.ce})`);
                });
            }
        } else {
            console.log(`\nStudent with adNo "${adNo}" NOT FOUND in April 28 Backup!`);
        }
    });

    // Also check if ANY student in April 28 backup had missing marks compared to live DB
    console.log('\n--- CHECKING FOR ANY MARKS IN APRIL 28 BACKUP MISSING IN LIVE FIRESTORE ---');
    const liveStudentsSnap = await getDocs(collection(db, 'students'));
    const liveStudents = liveStudentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    const liveSubjectsSnap = await getDocs(collection(db, 'subjects'));
    const liveSubjects = liveSubjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    const liveSubjectMap = new Map(liveSubjects.map(s => [s.id, s]));

    let missingMarksCount = 0;

    backupStudents.forEach(bkSt => {
        if (!bkSt.adNo) return;
        const liveSt = liveStudents.find(s => String(s.adNo) === String(bkSt.adNo));
        if (!liveSt) return;

        const bkHistory = bkSt.academicHistory || {};
        const liveHistory = liveSt.academicHistory || {};

        Object.entries(bkHistory).forEach(([termKey, bkHist]) => {
            const liveHist = liveHistory[termKey];
            if (!liveHist || !liveHist.marks) return;

            const bkMarks = bkHist.marks || {};
            const bkMeta = bkHist.subjectMetadata || bkSt.subjectMetadata || {};
            const liveMarks = liveHist.marks || {};

            Object.entries(bkMarks).forEach(([subId, bMark]) => {
                if (bMark.isSupplementary) return;
                const catSub = backupSubjectMap.get(subId);
                const metaSub = bkMeta[subId];
                const subName = (catSub?.name || metaSub?.name || subId).trim().toLowerCase();

                const hasLiveMark = Object.keys(liveMarks).some(lk => {
                    const lSub = liveSubjectMap.get(lk);
                    const lMeta = liveHist.subjectMetadata?.[lk];
                    const lName = (lSub?.name || lMeta?.name || lk).trim().toLowerCase();
                    return lk === subId || lName === subName;
                });

                if (!hasLiveMark && (bMark.total > 0 || bMark.int !== undefined || bMark.ext !== undefined)) {
                    missingMarksCount++;
                    console.log(`  Missing Mark in Live DB: Student "${liveSt.name}" (AdNo: ${liveSt.adNo}, Term: ${termKey}) | Subject: "${subName}" [${subId}] | total: ${bMark.total}`);
                }
            });
        });
    });

    console.log(`\nTotal missing mark entries found in April 28 backup across all students: ${missingMarksCount}`);
}

inspectApril28Backup().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
