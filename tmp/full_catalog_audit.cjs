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

async function fullCatalogAudit() {
    console.log('=== FULL FIRESTORE SUBJECT CATALOG AUDIT ===\n');

    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const bkSubMap = new Map((backup.subjects || []).map(s => [s.id, s]));

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const fsSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const studentsSnap = await getDocs(collection(db, 'students'));
    const fsStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Count marks per subject across Odd and Even
    const oddMarkCounts = new Map();
    const evenMarkCounts = new Map();

    fsStudents.forEach(st => {
        const oddMarks = st.academicHistory?.['2025-2026-Odd']?.marks || {};
        const evenMarks = st.academicHistory?.['2025-2026-Even']?.marks || {};

        Object.keys(oddMarks).forEach(k => oddMarkCounts.set(k, (oddMarkCounts.get(k) || 0) + 1));
        Object.keys(evenMarks).forEach(k => evenMarkCounts.set(k, (evenMarkCounts.get(k) || 0) + 1));
    });

    console.log('ID | Subject Name | Type | activeSemester | Target Classes | Odd Marks | Even Marks | Backup Type');
    console.log('='.repeat(130));

    fsSubjects.forEach(s => {
        const bk = bkSubMap.get(s.id);
        const oddC = oddMarkCounts.get(s.id) || 0;
        const evenC = evenMarkCounts.get(s.id) || 0;
        const classes = (s.targetClasses || []).join(',');
        console.log(`${s.id.padEnd(20)} | ${s.name.padEnd(25)} | ${(s.subjectType || 'general').padEnd(8)} | ${(s.activeSemester || 'Both').padEnd(5)} | ${classes.padEnd(25)} | ${String(oddC).padEnd(5)} | ${String(evenC).padEnd(5)} | ${bk?.subjectType || 'N/A'}`);
    });
}

fullCatalogAudit().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
