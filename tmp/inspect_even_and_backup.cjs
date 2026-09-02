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

async function inspectEvenAndBackup() {
    console.log('=== DETAILED AUDIT OF EVEN MARKS & MASTER BACKUP SUBJECTS ===\n');

    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const bkSubMap = new Map((backup.subjects || []).map(s => [s.id, s]));

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const fsSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const fsSubMap = new Map(fsSubjects.map(s => [s.id, s]));

    const studentsSnap = await getDocs(collection(db, 'students'));
    const fsStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Analysis of 2025-2026-Even marks in Firestore
    const evenMarksBySubject = new Map(); // subId -> count
    const oddMarksBySubject = new Map(); // subId -> count

    fsStudents.forEach(st => {
        const oddMarks = st.academicHistory?.['2025-2026-Odd']?.marks || {};
        const evenMarks = st.academicHistory?.['2025-2026-Even']?.marks || {};

        Object.keys(oddMarks).forEach(subId => {
            oddMarksBySubject.set(subId, (oddMarksBySubject.get(subId) || 0) + 1);
        });

        Object.keys(evenMarks).forEach(subId => {
            evenMarksBySubject.set(subId, (evenMarksBySubject.get(subId) || 0) + 1);
        });
    });

    console.log('=== ALL SUBJECTS WITH MARKS IN ODD AND/OR EVEN ===');
    console.log('ID | Subject Name | Current FS activeSemester | Backup activeSemester | Odd Marks Count | Even Marks Count');
    console.log('-'.repeat(120));

    fsSubjects.forEach(s => {
        const bkSub = bkSubMap.get(s.id);
        const oddCount = oddMarksBySubject.get(s.id) || 0;
        const evenCount = evenMarksBySubject.get(s.id) || 0;
        const fsSem = s.activeSemester || 'Both';
        const bkSem = bkSub?.activeSemester || 'Both';

        if (oddCount > 0 || evenCount > 0) {
            console.log(`${s.id.padEnd(20)} | ${s.name.padEnd(25)} | FS: ${fsSem.padEnd(5)} | BK: ${bkSem.padEnd(5)} | Odd: ${String(oddCount).padEnd(5)} | Even: ${String(evenCount).padEnd(5)}`);
        }
    });

    console.log('\n=== SUBJECTS WITH NO MARKS IN ODD OR EVEN ===');
    fsSubjects.forEach(s => {
        const oddCount = oddMarksBySubject.get(s.id) || 0;
        const evenCount = evenMarksBySubject.get(s.id) || 0;
        if (oddCount === 0 && evenCount === 0) {
            const fsSem = s.activeSemester || 'Both';
            console.log(`Unused Subject: [${s.id}] "${s.name}" (activeSemester: ${fsSem})`);
        }
    });
}

inspectEvenAndBackup().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
