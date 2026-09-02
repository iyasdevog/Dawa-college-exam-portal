const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
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

async function restoreSemesterTags() {
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const bkSubjects = backup.subjects || [];
    const bkSubMap = new Map(bkSubjects.map(s => [s.id, s]));

    const snap = await getDocs(collection(db, 'subjects'));

    console.log('=== 1. CHECKING BASIC ENGLISH IN FIRESTORE ===\n');
    snap.docs.forEach(d => {
        const sub = d.data();
        if ((sub.name || '').toLowerCase().includes('basic english')) {
            console.log(`Basic English Subject Document [${d.id}]:`);
            console.log(`  name: "${sub.name}"`);
            console.log(`  subjectType: "${sub.subjectType}"`);
            console.log(`  activeSemester: "${sub.activeSemester}"`);
            console.log(`  targetClasses:`, sub.targetClasses);
            console.log('');
        }
    });

    console.log('\n=== 2. RESTORING CORRECT ODD/EVEN SEMESTER TAGS FROM MASTER BACKUP ===\n');
    let restoredCount = 0;

    for (const d of snap.docs) {
        const fsSub = d.data();
        const bkSub = bkSubMap.get(d.id);

        if (bkSub && bkSub.activeSemester) {
            if (fsSub.activeSemester !== bkSub.activeSemester) {
                await updateDoc(d.ref, { activeSemester: bkSub.activeSemester });
                restoredCount++;
                console.log(`  Restored [${d.id}] "${fsSub.name}" activeSemester -> "${bkSub.activeSemester}" (was "${fsSub.activeSemester}")`);
            }
        }
    }

    console.log(`\n✅ Restored correct semester tags for ${restoredCount} subjects from master backup!`);
}

restoreSemesterTags().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
