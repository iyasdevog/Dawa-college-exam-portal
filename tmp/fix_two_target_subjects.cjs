const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

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

const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
const backupSubjects = backup.subjects || [];

async function fixBothTargetSubjects() {
    console.log('=== FIXING TARGET SUBJECTS CONFIG & SEMESTERS ===\n');

    // 1. Update 4ILHgiGPtvR0TBQwpMpv (Arabic Linguistics) -> activeSemester: 'Odd', targetClasses: ['PG1']
    const sub1Ref = doc(db, 'subjects', '4ILHgiGPtvR0TBQwpMpv');
    await updateDoc(sub1Ref, {
        activeSemester: 'Odd',
        targetClasses: ['PG1']
    });
    console.log('✅ Updated [4ILHgiGPtvR0TBQwpMpv] "Arabic Linguistics (textual Application)": activeSemester="Odd", targetClasses=["PG1"]');

    // 2. Update ho0E0KjbSGybbkr2NakY (Balaga) -> activeSemester: 'Odd', targetClasses: ['D2', 'D1', 'D3']
    const sub2Ref = doc(db, 'subjects', 'ho0E0KjbSGybbkr2NakY');
    await updateDoc(sub2Ref, {
        activeSemester: 'Odd',
        targetClasses: ['D2', 'D1', 'D3']
    });
    console.log('✅ Updated [ho0E0KjbSGybbkr2NakY] "Balaga": activeSemester="Odd", targetClasses=["D2", "D1", "D3"]');
}

fixBothTargetSubjects().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
