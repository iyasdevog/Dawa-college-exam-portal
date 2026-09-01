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

async function compareFirestoreWithMay23Backup() {
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const bkSubjects = backup.subjects || [];
    const bkStudents = backup.students || [];

    const fsSubjectsSnap = await getDocs(collection(db, 'subjects'));
    const fsSubjects = fsSubjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const fsStudentsSnap = await getDocs(collection(db, 'students'));
    const fsStudents = fsStudentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log('=== COMPARISON: FIRESTORE vs MAY 23 BACKUP ===\n');
    console.log(`Backup Subjects: ${bkSubjects.length} | Firestore Subjects: ${fsSubjects.length}`);
    console.log(`Backup Students: ${bkStudents.length} | Firestore Students: ${fsStudents.length}`);

    // Check English Elective in Firestore
    console.log('\n--- ENGLISH SUBJECTS IN FIRESTORE ---');
    fsSubjects.filter(s => s.name.toUpperCase().includes('ENGLISH')).forEach(s => {
        console.log(`  [${s.id}] "${s.name}" | type=${s.subjectType} | sem=${s.activeSemester} | classes=${(s.targetClasses||[]).join(',')}`);
    });

    // Check English Elective in May 23 Backup
    console.log('\n--- ENGLISH SUBJECTS IN MAY 23 BACKUP ---');
    bkSubjects.filter(s => s.name.toUpperCase().includes('ENGLISH')).forEach(s => {
        console.log(`  [${s.id}] "${s.name}" | type=${s.subjectType} | sem=${s.activeSemester} | classes=${(s.targetClasses||[]).join(',')}`);
    });

    // Check Communicative Arabic in Firestore vs Backup
    console.log('\n--- COMMUNICATIVE ARABIC IN FIRESTORE ---');
    fsSubjects.filter(s => s.name.toLowerCase().includes('communicative arabic')).forEach(s => {
        console.log(`  [${s.id}] "${s.name}" | type=${s.subjectType} | sem=${s.activeSemester} | classes=${(s.targetClasses||[]).join(',')}`);
    });
    console.log('\n--- COMMUNICATIVE ARABIC IN MAY 23 BACKUP ---');
    bkSubjects.filter(s => s.name.toLowerCase().includes('communicative arabic')).forEach(s => {
        console.log(`  [${s.id}] "${s.name}" | type=${s.subjectType} | sem=${s.activeSemester} | classes=${(s.targetClasses||[]).join(',')}`);
    });

    // Check Malayalam in Firestore vs Backup
    console.log('\n--- MALAYALAM IN FIRESTORE ---');
    fsSubjects.filter(s => s.name.toLowerCase().includes('malayalam')).forEach(s => {
        console.log(`  [${s.id}] "${s.name}" | type=${s.subjectType} | sem=${s.activeSemester} | classes=${(s.targetClasses||[]).join(',')}`);
    });
    console.log('\n--- MALAYALAM IN MAY 23 BACKUP ---');
    bkSubjects.filter(s => s.name.toLowerCase().includes('malayalam')).forEach(s => {
        console.log(`  [${s.id}] "${s.name}" | type=${s.subjectType} | sem=${s.activeSemester} | classes=${(s.targetClasses||[]).join(',')}`);
    });

    // Check Arabic in P1 (HS2) in Firestore vs Backup
    console.log('\n--- ARABIC (P1 / HS2) IN FIRESTORE ---');
    fsSubjects.filter(s => (s.targetClasses||[]).includes('HS2') || (s.targetClasses||[]).includes('P1')).filter(s => s.name.toLowerCase().includes('arabic')).forEach(s => {
        console.log(`  [${s.id}] "${s.name}" | type=${s.subjectType} | sem=${s.activeSemester} | classes=${(s.targetClasses||[]).join(',')}`);
    });
    console.log('\n--- ARABIC (P1 / HS2) IN MAY 23 BACKUP ---');
    bkSubjects.filter(s => (s.targetClasses||[]).includes('HS2') || (s.targetClasses||[]).includes('P1')).filter(s => s.name.toLowerCase().includes('arabic')).forEach(s => {
        console.log(`  [${s.id}] "${s.name}" | type=${s.subjectType} | sem=${s.activeSemester} | classes=${(s.targetClasses||[]).join(',')}`);
    });

}

compareFirestoreWithMay23Backup().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
