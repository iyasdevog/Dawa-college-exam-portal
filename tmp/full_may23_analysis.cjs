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

async function fullAnalysis() {
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const backupSubjects = backup.subjects || [];
    const backupStudents = backup.students || [];

    const fsSubjectsSnap = await getDocs(collection(db, 'subjects'));
    const fsSubjects = fsSubjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`May 23 Backup Subjects: ${backupSubjects.length}`);
    console.log(`Current Firestore Subjects: ${fsSubjects.length}`);

    // Print all Arabic / English / Malayalam subjects in May 23 backup
    console.log('\n=== ARABIC / ENGLISH / MALAYALAM SUBJECTS IN MAY 23 BACKUP ===');
    backupSubjects.forEach(s => {
        const n = (s.name || '').toLowerCase();
        if (n.includes('arabic') || n.includes('english') || n.includes('malayalam') || n.includes('عرب')) {
            console.log(`[${s.id}] "${s.name}" | type=${s.subjectType} | sem=${s.activeSemester} | classes=${(s.targetClasses||[]).join(',')}`);
        }
    });

    // Check all electives in May 23 backup
    console.log('\n=== ALL ELECTIVE SUBJECTS IN MAY 23 BACKUP ===');
    backupSubjects.filter(s => s.subjectType === 'elective').forEach(s => {
        console.log(`[${s.id}] "${s.name}" | type=${s.subjectType} | sem=${s.activeSemester} | classes=${(s.targetClasses||[]).join(',')}`);
    });

    // Check P1 (HS2) subjects and student marks in May 23 backup
    console.log('\n=== P1 (HS2) SUBJECTS & MARKS IN MAY 23 BACKUP ===');
    const p1Subs = backupSubjects.filter(s => (s.targetClasses||[]).includes('HS2') || (s.targetClasses||[]).includes('P1'));
    console.log(`Subjects targeting HS2/P1: ${p1Subs.length}`);
    p1Subs.forEach(s => console.log(`  [${s.id}] "${s.name}" | type=${s.subjectType}`));

    const hs2Students = backupStudents.filter(s => s.className === 'HS2' || s.className === 'P1' || s.currentClass === 'HS2' || s.currentClass === 'P1');
    console.log(`\nHS2/P1 Students: ${hs2Students.length}`);
    if (hs2Students.length > 0) {
        const sample = hs2Students[0];
        console.log(`Sample Student ${sample.adNo} - ${sample.name}:`);
        const oddMarks = sample.academicHistory?.['2025-2026-Odd']?.marks || sample.marks || {};
        Object.keys(oddMarks).forEach(subId => {
            const sub = backupSubjects.find(x => x.id === subId);
            console.log(`  [${subId}] -> "${sub ? sub.name : 'MISSING IN BACKUP'}" = ${oddMarks[subId]?.total}`);
        });
    }

    // Check S1 (FS2) subjects and student marks in May 23 backup
    console.log('\n=== S1 (FS2) SUBJECTS & MARKS IN MAY 23 BACKUP ===');
    const fs2Subs = backupSubjects.filter(s => (s.targetClasses||[]).includes('FS2') || (s.targetClasses||[]).includes('S1'));
    console.log(`Subjects targeting FS2/S1: ${fs2Subs.length}`);
    fs2Subs.forEach(s => console.log(`  [${s.id}] "${s.name}" | type=${s.subjectType}`));

    const fs2Students = backupStudents.filter(s => s.className === 'FS2' || s.className === 'S1' || s.currentClass === 'FS2' || s.currentClass === 'S1');
    console.log(`\nFS2/S1 Students: ${fs2Students.length}`);
    if (fs2Students.length > 0) {
        const sample = fs2Students[0];
        console.log(`Sample Student ${sample.adNo} - ${sample.name}:`);
        const oddMarks = sample.academicHistory?.['2025-2026-Odd']?.marks || sample.marks || {};
        Object.keys(oddMarks).forEach(subId => {
            const sub = backupSubjects.find(x => x.id === subId);
            console.log(`  [${subId}] -> "${sub ? sub.name : 'MISSING IN BACKUP'}" = ${oddMarks[subId]?.total}`);
        });
    }
}

fullAnalysis().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
