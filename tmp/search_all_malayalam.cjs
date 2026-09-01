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

async function searchAllMalayalam() {
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const bkSubjects = backup.subjects || [];
    const bkStudents = backup.students || [];

    const fsStudentsSnap = await getDocs(collection(db, 'students'));
    const fsStudents = fsStudentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log('=== SEARCHING ALL MALAYALAM MARKS FOR S1 (FS2) & S2 (FS3) ===\n');

    const s1s2Students = bkStudents.filter(s => ['FS2','S1','FS3','S2'].includes(s.className || s.currentClass));
    console.log(`Checking ${s1s2Students.length} S1/S2 students in May 23 backup...`);

    let bkFoundCount = 0;
    s1s2Students.forEach(bkSt => {
        const history = bkSt.academicHistory || {};
        Object.keys(history).forEach(tk => {
            const marks = history[tk]?.marks || {};
            Object.keys(marks).forEach(subId => {
                const sub = bkSubjects.find(x => x.id === subId);
                const name = (sub?.name || history[tk]?.subjectMetadata?.[subId]?.name || '').toLowerCase();
                if (name.includes('malayalam')) {
                    bkFoundCount++;
                    console.log(`  BACKUP: Student ${bkSt.adNo} (${bkSt.name}, class=${bkSt.className}) | Term ${tk} | Sub [${subId}] "${name}" = ${marks[subId]?.total}`);
                }
            });
        });
    });
    console.log(`May 23 Backup Malayalam entries: ${bkFoundCount}`);

    let fsFoundCount = 0;
    console.log(`\nChecking Firestore S1/S2 students...`);
    fsStudents.filter(s => ['FS2','S1','FS3','S2'].includes(s.className || s.currentClass)).forEach(fsSt => {
        const history = fsSt.academicHistory || {};
        Object.keys(history).forEach(tk => {
            const marks = history[tk]?.marks || {};
            Object.keys(marks).forEach(subId => {
                const name = (subId === 'D5ZEMWpBGGhGvESByu4l' || subId === 'Kogdr0NtmlAEQR6WiUCw' || subId === 'VblHptFYytqZ6BOoZ17c') ? 'malayalam' : '';
                if (name.includes('malayalam')) {
                    fsFoundCount++;
                    console.log(`  FIRESTORE: Student ${fsSt.adNo} (${fsSt.name}, class=${fsSt.className}) | Term ${tk} | Sub [${subId}] = ${marks[subId]?.total}`);
                }
            });
        });
    });
    console.log(`Firestore Malayalam entries: ${fsFoundCount}`);
}

searchAllMalayalam().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
