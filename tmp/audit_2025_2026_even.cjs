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

async function audit20252026Even() {
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const bkSubjects = backup.subjects || [];
    const bkStudents = backup.students || [];

    const fsStudentsSnap = await getDocs(collection(db, 'students'));
    const fsStudents = fsStudentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const fsSubjectsSnap = await getDocs(collection(db, 'subjects'));
    const fsSubjects = fsSubjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const fsSubjectMap = new Map(fsSubjects.map(s => [s.id, s]));

    console.log('====================================================');
    console.log('   FULL AUDIT: 2025-2026 EVEN SEMESTER DATA');
    console.log('====================================================\n');

    const systemClasses = ['FS1', 'FS2', 'FS3', 'HS1', 'HS2', 'HS3', 'D1', 'D2', 'D3', 'PG1', 'Hifz'];

    for (const cls of systemClasses) {
        console.log(`\n====================================================`);
        console.log(`  CLASS: ${cls}`);
        console.log(`====================================================`);

        const bkClassStudents = bkStudents.filter(s => s.className === cls || s.currentClass === cls);
        const fsClassStudents = fsStudents.filter(s => (s.className === cls || s.currentClass === cls) && !s.isDeleted);

        console.log(`Students Count: Backup=${bkClassStudents.length} | Firestore=${fsClassStudents.length}`);

        // Get subjects targeting this class in Firestore
        const fsTargetSubjects = fsSubjects.filter(s => {
            const tc = s.targetClasses || [];
            const isMatch = tc.includes(cls) || 
                (cls === 'FS2' && tc.includes('S1')) || (cls === 'FS3' && tc.includes('S2')) ||
                (cls === 'HS2' && tc.includes('P1')) || (cls === 'HS3' && tc.includes('P2'));
            const isSemOk = !s.activeSemester || s.activeSemester === 'Both' || s.activeSemester === 'Even';
            return isMatch && isSemOk;
        });

        console.log(`Target Subjects in Firestore for ${cls} (Even/Both): ${fsTargetSubjects.length}`);
        fsTargetSubjects.forEach(s => {
            console.log(`  - [${s.id}] "${s.name}" (type=${s.subjectType}, sem=${s.activeSemester})`);
        });

        // Audit student marks for 2025-2026-Even
        let missingMarksCount = 0;
        let validMarksCount = 0;

        fsClassStudents.forEach(st => {
            const bkSt = bkStudents.find(s => s.adNo === st.adNo);
            const history = st.academicHistory || {};
            const evenTerm = history['2025-2026-Even'];
            const evenMarks = evenTerm?.marks || {};

            const bkEvenMarks = bkSt?.academicHistory?.['2025-2026-Even']?.marks || {};

            const markKeys = Object.keys(evenMarks);
            if (markKeys.length === 0) {
                if (Object.keys(bkEvenMarks).length > 0) {
                    console.log(`  ⚠️ Student Adm ${st.adNo} (${st.name}): HAS ${Object.keys(bkEvenMarks).length} MARKS IN BACKUP BUT 0 IN FIRESTORE!`);
                    missingMarksCount++;
                }
            } else {
                validMarksCount++;
                // Check if any mark keys point to unmapped/orphaned IDs
                markKeys.forEach(k => {
                    const sub = fsSubjectMap.get(k);
                    if (!sub) {
                        console.log(`  ❌ Student Adm ${st.adNo} (${st.name}): Has orphaned mark key [${k}] in 2025-2026-Even!`);
                    }
                });
            }
        });

        console.log(`Summary for ${cls} 2025-2026-Even: ${validMarksCount} students with marks, ${missingMarksCount} students missing backup marks.`);
    }
}

audit20252026Even().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
