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

async function auditSubjectConfigs() {
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const bkSubjects = backup.subjects || [];

    const fsSubjectsSnap = await getDocs(collection(db, 'subjects'));
    const fsSubjects = fsSubjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const fsSubjectMap = new Map(fsSubjects.map(s => [s.id, s]));

    console.log('=== SUBJECT CONFIG AUDIT: MAY 23 BACKUP VS FIRESTORE ===\n');

    let misconfiguredCount = 0;

    bkSubjects.forEach(bkSub => {
        const fsSub = fsSubjectMap.get(bkSub.id);
        if (!fsSub) {
            console.log(`❌ Subject [${bkSub.id}] "${bkSub.name}" EXISTS IN BACKUP BUT MISSING IN FIRESTORE!`);
            misconfiguredCount++;
            return;
        }

        const bkClasses = (bkSub.targetClasses || []).sort().join(',');
        const fsClasses = (fsSub.targetClasses || []).sort().join(',');

        const bkSem = bkSub.activeSemester || 'Both';
        const fsSem = fsSub.activeSemester || 'Both';

        const bkType = bkSub.subjectType || 'general';
        const fsType = fsSub.subjectType || 'general';

        if (bkClasses !== fsClasses || bkSem !== fsSem || bkType !== fsType) {
            misconfiguredCount++;
            console.log(`⚠️ Subject [${bkSub.id}] "${bkSub.name}":`);
            if (bkType !== fsType) console.log(`    subjectType: Backup="${bkType}" vs Firestore="${fsType}"`);
            if (bkSem !== fsSem) console.log(`    activeSemester: Backup="${bkSem}" vs Firestore="${fsSem}"`);
            if (bkClasses !== fsClasses) console.log(`    targetClasses: Backup="[${bkClasses}]" vs Firestore="[${fsClasses}]"`);
        }
    });

    console.log(`\nAudit complete: ${misconfiguredCount} subjects misconfigured or missing relative to May 23 master backup.`);
}

auditSubjectConfigs().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
