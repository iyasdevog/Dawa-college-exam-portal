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

async function inspectP2Students() {
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const bkSubjects = backup.subjects || [];
    const bkStudents = backup.students || [];

    const fsStudentsSnap = await getDocs(collection(db, 'students'));
    const fsStudents = fsStudentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const fsSubjectsSnap = await getDocs(collection(db, 'subjects'));
    const fsSubjects = fsSubjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log('=== INSPECTING P2 (HS3) STUDENTS IN MAY 23 BACKUP VS FIRESTORE ===\n');

    const p2BkStudents = bkStudents.filter(s => s.className === 'HS3' || s.className === 'P2' || s.currentClass === 'HS3' || s.currentClass === 'P2');
    console.log(`Found ${p2BkStudents.length} P2/HS3 students in May 23 backup:\n`);

    p2BkStudents.forEach(bkSt => {
        const fsSt = fsStudents.find(s => s.adNo === bkSt.adNo);
        console.log(`Student Adm ${bkSt.adNo} - ${bkSt.name} (class=${bkSt.className}):`);
        
        console.log(`  MAY 23 BACKUP:`);
        Object.keys(bkSt.academicHistory || {}).forEach(tk => {
            const marks = bkSt.academicHistory[tk]?.marks || {};
            console.log(`    Term ${tk} (${Object.keys(marks).length} marks):`);
            Object.keys(marks).forEach(subId => {
                const sub = bkSubjects.find(x => x.id === subId);
                console.log(`      [${subId}] "${sub ? sub.name : 'MISSING'}" (type=${sub ? sub.subjectType : '?'}) = ${marks[subId]?.total}`);
            });
        });

        if (fsSt) {
            console.log(`  FIRESTORE:`);
            Object.keys(fsSt.academicHistory || {}).forEach(tk => {
                const marks = fsSt.academicHistory[tk]?.marks || {};
                console.log(`    Term ${tk} (${Object.keys(marks).length} marks):`);
                Object.keys(marks).forEach(subId => {
                    const sub = fsSubjects.find(x => x.id === subId);
                    console.log(`      [${subId}] "${sub ? sub.name : 'MISSING'}" (type=${sub ? sub.subjectType : '?'}) = ${marks[subId]?.total}`);
                });
            });
        }
        console.log('');
    });
}

inspectP2Students().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
