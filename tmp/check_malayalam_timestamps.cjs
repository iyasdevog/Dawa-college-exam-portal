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

async function checkMalayalamTimestamps() {
    const mayBkPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const mayBk = fs.existsSync(mayBkPath) ? JSON.parse(fs.readFileSync(mayBkPath, 'utf8')) : {};

    const aprBkPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-04-04T04-11-10.json');
    const aprBk = fs.existsSync(aprBkPath) ? JSON.parse(fs.readFileSync(aprBkPath, 'utf8')) : {};

    console.log('=== CHECKING MALAYALAM TIMESTAMPS & BACKUPS ===\n');

    // 1. Check April 4 Backup subjects
    const aprSubjects = aprBk.subjects || aprBk.Subjects || [];
    const aprS1S2Mal = aprSubjects.filter(s => (s.name||'').toLowerCase().includes('malayalam'));
    console.log(`April 4 Backup Malayalam Subjects (${aprS1S2Mal.length}):`);
    aprS1S2Mal.forEach(s => {
        console.log(`  [${s.id}] "${s.name}" | sem=${s.activeSemester} | classes=${(s.targetClasses||[]).join(',')}`);
    });

    // Check April 4 Backup student marks
    const aprStudents = aprBk.students || aprBk.Students || [];
    let aprOddMalCount = 0;
    let aprEvenMalCount = 0;
    aprStudents.forEach(st => {
        const hist = st.academicHistory || {};
        Object.keys(hist).forEach(tk => {
            const marks = hist[tk]?.marks || {};
            Object.keys(marks).forEach(subId => {
                const sub = aprSubjects.find(x => x.id === subId);
                const name = (sub?.name || hist[tk]?.subjectMetadata?.[subId]?.name || '').toLowerCase();
                if (name.includes('malayalam')) {
                    if (tk.includes('Odd')) aprOddMalCount++;
                    if (tk.includes('Even')) aprEvenMalCount++;
                }
            });
        });
    });
    console.log(`April 4 Backup Malayalam Marks: Odd=${aprOddMalCount}, Even=${aprEvenMalCount}`);

    // 2. Check May 23 Backup Malayalam subject metadata timestamps
    const mayStudents = mayBk.students || [];
    console.log(`\nMay 23 Backup Malayalam Subject Metadata Timestamps:`);
    mayStudents.slice(0, 10).forEach(st => {
        const hist = st.academicHistory || {};
        Object.keys(hist).forEach(tk => {
            const meta = hist[tk]?.subjectMetadata || {};
            Object.keys(meta).forEach(subId => {
                if (meta[subId]?.name?.toLowerCase().includes('malayalam')) {
                    const ts = meta[subId]?.timestamp;
                    const dateStr = ts ? new Date(ts).toISOString() : 'N/A';
                    console.log(`  Student ${st.adNo} (${st.name}) | Term ${tk} | ts=${ts} (${dateStr})`);
                }
            });
        });
    });

    // 3. Check Firestore Malayalam Subject Metadata Timestamps
    const fsStudentsSnap = await getDocs(collection(db, 'students'));
    console.log(`\nFirestore Malayalam Subject Metadata Timestamps:`);
    fsStudentsSnap.docs.forEach(d => {
        const st = d.data();
        const hist = st.academicHistory || {};
        Object.keys(hist).forEach(tk => {
            const meta = hist[tk]?.subjectMetadata || {};
            Object.keys(meta).forEach(subId => {
                if (meta[subId]?.name?.toLowerCase().includes('malayalam') || subId === 'D5ZEMWpBGGhGvESByu4l' || subId === 'Kogdr0NtmlAEQR6WiUCw') {
                    const ts = meta[subId]?.timestamp;
                    const dateStr = ts ? new Date(ts).toISOString() : 'N/A';
                    console.log(`  Student ${st.adNo} (${st.name}) | Term ${tk} | subId=${subId} | ts=${ts} (${dateStr})`);
                }
            });
        });
    });
}

checkMalayalamTimestamps().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
