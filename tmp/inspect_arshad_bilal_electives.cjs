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

async function inspectArshadAndBilalElectives() {
    console.log('\n=== INSPECTING ARSHAD PK (116) AND BILAL (124) ELECTIVE MARKS ===\n');

    // Load Backup File
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const backupStudents = backupData.students || [];
    const backupSubjects = backupData.subjects || [];
    const backupSubjectMap = new Map(backupSubjects.map(s => [s.id, s]));

    const targetAdNos = ['116', '124'];

    console.log('--- MASTER BACKUP DATA ---');
    targetAdNos.forEach(adNo => {
        const bkSt = backupStudents.find(s => String(s.adNo) === adNo);
        if (bkSt) {
            console.log(`\nStudent: "${bkSt.name}" (adNo: ${bkSt.adNo}, class: ${bkSt.currentClass})`);
            const hist = bkSt.academicHistory ? bkSt.academicHistory['2025-2026-Odd'] : null;
            const marksObj = hist?.marks || bkSt.marks || {};
            const metaObj = hist?.subjectMetadata || bkSt.subjectMetadata || {};

            console.log('All marks recorded in Backup:');
            Object.entries(marksObj).forEach(([subId, mark]) => {
                const sub = backupSubjectMap.get(subId);
                const meta = metaObj[subId];
                console.log(`  - [${subId}] "${sub?.name || meta?.name || subId}" (type: ${sub?.subjectType || meta?.subjectType}) : total=${mark.total} (${mark.ext ?? mark.ta}+${mark.int ?? mark.ce})`);
            });
        }
    });

    console.log('\n--- LIVE FIRESTORE DATA ---');
    const liveStudentsSnap = await getDocs(collection(db, 'students'));
    const liveStudents = liveStudentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    const liveSubjectsSnap = await getDocs(collection(db, 'subjects'));
    const liveSubjects = liveSubjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    const liveSubjectMap = new Map(liveSubjects.map(s => [s.id, s]));

    targetAdNos.forEach(adNo => {
        const liveSt = liveStudents.find(s => String(s.adNo) === adNo);
        if (liveSt) {
            const hist = liveSt.academicHistory ? liveSt.academicHistory['2025-2026-Odd'] : null;
            console.log(`\nStudent: "${liveSt.name}" (adNo: ${liveSt.adNo}, class: ${hist?.className})`);
            const marksObj = hist?.marks || {};
            const metaObj = hist?.subjectMetadata || {};

            console.log('All marks recorded in Live Firestore:');
            Object.entries(marksObj).forEach(([subId, mark]) => {
                const sub = liveSubjectMap.get(subId);
                const meta = metaObj[subId];
                console.log(`  - [${subId}] "${sub?.name || meta?.name || subId}" (type: ${sub?.subjectType || meta?.subjectType}) : total=${mark.total} (${mark.ext}+${mark.int})`);
            });
        }
    });
}

inspectArshadAndBilalElectives().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
