const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

async function compareBackupEnglishAndElectives() {
    console.log('\n=== COMPARING MASTER BACKUP VS FIRESTORE FOR ENGLISH AND ELECTIVES ===\n');

    // 1. Load Backup File
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const backupStudents = backupData.students || [];
    const backupSubjects = backupData.subjects || [];
    const backupSubjectMap = new Map(backupSubjects.map(s => [s.id, s]));

    console.log(`Master Backup stats: ${backupStudents.length} students, ${backupSubjects.length} subjects`);

    // Audit English subjects in backup
    console.log('\n1. ALL ENGLISH SUBJECTS IN MASTER BACKUP CATALOG:');
    const backupEnglishSubjects = backupSubjects.filter(s => (s.name || '').toLowerCase().includes('english'));
    backupEnglishSubjects.forEach(s => {
        console.log(`  - [${s.id}] "${s.name}" | type: "${s.subjectType}" | activeSem: "${s.activeSemester}" | targets: [${(s.targetClasses||[]).join(',')}]`);
    });

    // Audit Elective subjects in backup
    console.log('\n2. ALL ELECTIVE SUBJECTS IN MASTER BACKUP CATALOG:');
    const backupElectiveSubjects = backupSubjects.filter(s => s.subjectType === 'elective');
    backupElectiveSubjects.forEach(s => {
        console.log(`  - [${s.id}] "${s.name}" | type: "${s.subjectType}" | activeSem: "${s.activeSemester}" | targets: [${(s.targetClasses||[]).join(',')}]`);
    });

    // Check student mark entries in backup for 2025-2026-Odd
    console.log('\n3. CHECKING STUDENT MARKS FOR ENGLISH AND ELECTIVES IN BACKUP (2025-2026-Odd):');
    let totalBackupElectiveMarksCount = 0;

    backupStudents.forEach(st => {
        const hist = st.academicHistory ? st.academicHistory['2025-2026-Odd'] : null;
        const marksObj = hist?.marks || st.marks || {};
        const metaObj = hist?.subjectMetadata || st.subjectMetadata || {};

        let hasGenEng = false;
        let hasElecEng = false;
        const electiveMarksForStudent = [];

        Object.entries(marksObj).forEach(([subId, mark]) => {
            const catSub = backupSubjectMap.get(subId);
            const metaSub = metaObj[subId];
            const name = (catSub?.name || metaSub?.name || subId).trim();
            const type = catSub?.subjectType || metaSub?.subjectType || 'general';

            if (name.toLowerCase().includes('english')) {
                if (type === 'general') hasGenEng = true;
                if (type === 'elective') hasElecEng = true;
            }

            if (type === 'elective') {
                totalBackupElectiveMarksCount++;
                electiveMarksForStudent.push({ subId, name, total: mark.total });
            }
        });

        if (hasGenEng && hasElecEng) {
            console.log(`  Student "${st.name}" (AdNo: ${st.adNo}, Class: ${hist?.className || st.currentClass}) HAS BOTH General English AND Elective English in Backup!`);
        }
    });

    console.log(`\nTotal Elective Marks recorded across all students in Master Backup: ${totalBackupElectiveMarksCount}`);

    // Now compare with live Firestore database
    const liveStudentsSnap = await getDocs(collection(db, 'students'));
    const liveStudents = liveStudentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    const liveSubjectsSnap = await getDocs(collection(db, 'subjects'));
    const liveSubjects = liveSubjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    const liveSubjectMap = new Map(liveSubjects.map(s => [s.id, s]));

    let totalLiveElectiveMarksCount = 0;
    liveStudents.forEach(st => {
        const hist = st.academicHistory ? st.academicHistory['2025-2026-Odd'] : null;
        if (!hist || !hist.marks) return;
        const metaObj = hist.subjectMetadata || {};

        Object.entries(hist.marks).forEach(([subId, mark]) => {
            const catSub = liveSubjectMap.get(subId);
            const metaSub = metaObj[subId];
            const type = catSub?.subjectType || metaSub?.subjectType || 'general';
            if (type === 'elective' && (mark.total > 0 || mark.int !== undefined || mark.ext !== undefined)) {
                totalLiveElectiveMarksCount++;
            }
        });
    });

    console.log(`Total Elective Marks recorded in Live Firestore (2025-2026-Odd): ${totalLiveElectiveMarksCount}`);
}

compareBackupEnglishAndElectives().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
