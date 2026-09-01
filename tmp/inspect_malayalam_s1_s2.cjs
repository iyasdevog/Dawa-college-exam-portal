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

async function inspectMalayalamS1S2() {
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const bkSubjects = backup.subjects || [];
    const bkStudents = backup.students || [];

    const fsStudentsSnap = await getDocs(collection(db, 'students'));
    const fsStudents = fsStudentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const fsSubjectsSnap = await getDocs(collection(db, 'subjects'));
    const fsSubjects = fsSubjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log('=== MALAYALAM IN S1 (FS2) & S2 (FS3) ===\n');

    console.log('FIRESTORE MALAYALAM SUBJECTS:');
    fsSubjects.filter(s => s.name.toLowerCase().includes('malayalam')).forEach(s => {
        console.log(`  [${s.id}] "${s.name}" | type=${s.subjectType} | sem=${s.activeSemester} | classes=${(s.targetClasses||[]).join(',')}`);
    });

    console.log('\nMAY 23 BACKUP MALAYALAM SUBJECTS:');
    bkSubjects.filter(s => s.name.toLowerCase().includes('malayalam')).forEach(s => {
        console.log(`  [${s.id}] "${s.name}" | type=${s.subjectType} | sem=${s.activeSemester} | classes=${(s.targetClasses||[]).join(',')}`);
    });

    console.log('\n--- S1 (FS2) STUDENTS MALAYALAM MARKS ---');
    const s1BkStudents = bkStudents.filter(s => ['FS2','S1'].includes(s.className || s.currentClass));
    console.log(`Found ${s1BkStudents.length} S1 students in backup.`);
    s1BkStudents.slice(0, 5).forEach(bkSt => {
        const fsSt = fsStudents.find(s => s.adNo === bkSt.adNo);
        console.log(`Student Adm ${bkSt.adNo} (${bkSt.name}):`);
        console.log(`  BACKUP 2025-2026-Odd marks:`);
        const bkOdd = bkSt.academicHistory?.['2025-2026-Odd']?.marks || {};
        Object.keys(bkOdd).forEach(subId => {
            const sub = bkSubjects.find(x => x.id === subId);
            if (sub?.name.toLowerCase().includes('malayalam')) {
                console.log(`    [${subId}] "${sub.name}" = ${bkOdd[subId]?.total}`);
            }
        });

        if (fsSt) {
            console.log(`  FIRESTORE 2025-2026-Odd marks:`);
            const fsOdd = fsSt.academicHistory?.['2025-2026-Odd']?.marks || {};
            Object.keys(fsOdd).forEach(subId => {
                const sub = fsSubjects.find(x => x.id === subId);
                if (sub?.name.toLowerCase().includes('malayalam')) {
                    console.log(`    [${subId}] "${sub ? sub.name : 'MISSING'}" = ${fsOdd[subId]?.total}`);
                }
            });
        }
        console.log('');
    });

    console.log('\n--- S2 (FS3) STUDENTS MALAYALAM MARKS ---');
    const s2BkStudents = bkStudents.filter(s => ['FS3','S2'].includes(s.className || s.currentClass));
    console.log(`Found ${s2BkStudents.length} S2 students in backup.`);
    s2BkStudents.slice(0, 5).forEach(bkSt => {
        const fsSt = fsStudents.find(s => s.adNo === bkSt.adNo);
        console.log(`Student Adm ${bkSt.adNo} (${bkSt.name}):`);
        console.log(`  BACKUP 2025-2026-Odd marks:`);
        const bkOdd = bkSt.academicHistory?.['2025-2026-Odd']?.marks || {};
        Object.keys(bkOdd).forEach(subId => {
            const sub = bkSubjects.find(x => x.id === subId);
            if (sub?.name.toLowerCase().includes('malayalam')) {
                console.log(`    [${subId}] "${sub.name}" = ${bkOdd[subId]?.total}`);
            }
        });

        if (fsSt) {
            console.log(`  FIRESTORE 2025-2026-Odd marks:`);
            const fsOdd = fsSt.academicHistory?.['2025-2026-Odd']?.marks || {};
            Object.keys(fsOdd).forEach(subId => {
                const sub = fsSubjects.find(x => x.id === subId);
                if (sub?.name.toLowerCase().includes('malayalam')) {
                    console.log(`    [${subId}] "${sub ? sub.name : 'MISSING'}" = ${fsOdd[subId]?.total}`);
                }
            });
        }
        console.log('');
    });
}

inspectMalayalamS1S2().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
