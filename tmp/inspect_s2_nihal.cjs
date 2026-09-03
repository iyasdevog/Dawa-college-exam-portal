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

async function inspectS2BackupVsLive() {
    console.log('\n=== INSPECTING S2 MARKS IN MASTER BACKUP VS FIRESTORE LIVE ===\n');

    // 1. Load backup file
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const backupStudents = backupData.students || [];
    const backupSubjects = backupData.subjects || [];
    const backupSubjectMap = new Map(backupSubjects.map(s => [s.id, s]));

    // Find Nihal N (AdNo: 138) in backup
    const backupNihal = backupStudents.find(s => String(s.adNo) === '138');
    if (backupNihal) {
        console.log('--- NIHAL N (AdNo: 138) IN BACKUP FILE ---');
        console.log(`Name: ${backupNihal.name} | currentClass: ${backupNihal.currentClass} | className: ${backupNihal.className}`);
        const oddHist = backupNihal.academicHistory ? backupNihal.academicHistory['2025-2026-Odd'] : null;
        console.log('Odd History Class:', oddHist?.className);
        console.log('Top-level marks count:', backupNihal.marks ? Object.keys(backupNihal.marks).length : 0);
        console.log('History marks count:', oddHist?.marks ? Object.keys(oddHist.marks).length : 0);

        const marksToInspect = oddHist?.marks || backupNihal.marks || {};
        console.log('\nAll Marks Recorded for Nihal N in Backup:');
        Object.entries(marksToInspect).forEach(([subId, markObj]) => {
            const sub = backupSubjectMap.get(subId);
            const meta = oddHist?.subjectMetadata?.[subId] || backupNihal.subjectMetadata?.[subId];
            console.log(`  - [${subId}] "${sub?.name || meta?.name || 'UNKNOWN'}" | total:${markObj.total} (int:${markObj.int ?? markObj.ce}, ext:${markObj.ext ?? markObj.ta})`);
        });
    }

    // 2. Fetch live Nihal N from Firestore
    const studentsSnap = await getDocs(collection(db, 'students'));
    const liveStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    const liveNihal = liveStudents.find(s => String(s.adNo) === '138');

    if (liveNihal) {
        console.log('\n--- NIHAL N (AdNo: 138) IN FIRESTORE LIVE ---');
        const oddHist = liveNihal.academicHistory ? liveNihal.academicHistory['2025-2026-Odd'] : null;
        console.log('Live Odd History Class:', oddHist?.className);
        console.log('Live Odd Marks count:', oddHist?.marks ? Object.keys(oddHist.marks).length : 0);

        console.log('\nAll Marks Recorded for Nihal N in Live Firestore:');
        const subjectsSnap = await getDocs(collection(db, 'subjects'));
        const liveSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const liveSubjectMap = new Map(liveSubjects.map(s => [s.id, s]));

        if (oddHist && oddHist.marks) {
            Object.entries(oddHist.marks).forEach(([subId, markObj]) => {
                const sub = liveSubjectMap.get(subId);
                const meta = oddHist.subjectMetadata ? oddHist.subjectMetadata[subId] : null;
                console.log(`  - [${subId}] "${sub?.name || meta?.name || 'UNKNOWN'}" | total:${markObj.total} (int:${markObj.int}, ext:${markObj.ext})`);
            });
        }
    }
}

inspectS2BackupVsLive().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
