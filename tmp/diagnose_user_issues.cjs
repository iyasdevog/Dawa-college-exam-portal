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

async function diagnoseUserIssues() {
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const bkSubjects = backup.subjects || [];
    const bkStudents = backup.students || [];

    const fsStudentsSnap = await getDocs(collection(db, 'students'));
    const fsStudents = fsStudentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const fsSubjectsSnap = await getDocs(collection(db, 'subjects'));
    const fsSubjects = fsSubjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log('=== 1. CHECKING THREE MISSING ELECTIVE STUDENTS (Adm No 22, 32, 34) ===\n');

    ['22', '32', '34'].forEach(adNo => {
        const bkSt = bkStudents.find(s => s.adNo === adNo);
        const fsSt = fsStudents.find(s => s.adNo === adNo);

        console.log(`Student Adm No ${adNo}: ${bkSt ? bkSt.name : 'Not in backup'}`);
        if (bkSt) {
            console.log(`  MAY 23 BACKUP History terms:`, Object.keys(bkSt.academicHistory || {}));
            Object.keys(bkSt.academicHistory || {}).forEach(tk => {
                const marks = bkSt.academicHistory[tk]?.marks || {};
                console.log(`    Term ${tk} (${Object.keys(marks).length} marks):`);
                Object.keys(marks).forEach(subId => {
                    const sub = bkSubjects.find(x => x.id === subId);
                    console.log(`      [${subId}] "${sub ? sub.name : 'MISSING'}" (type=${sub ? sub.subjectType : '?'}) = ${marks[subId]?.total}`);
                });
            });
        }
        if (fsSt) {
            console.log(`  CURRENT FIRESTORE History terms:`, Object.keys(fsSt.academicHistory || {}));
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

    console.log('=== 2. CHECKING P1 / HS2 STUDENTS & ARABIC MARKS & JUNAID (Adm No 213) ===\n');

    const p1AdNos = ['134', '176', '174', '177', '181', '182', '180', '213'];
    p1AdNos.forEach(adNo => {
        const bkSt = bkStudents.find(s => s.adNo === adNo);
        const fsSt = fsStudents.find(s => s.adNo === adNo);

        console.log(`P1 Student Adm No ${adNo}: ${bkSt ? bkSt.name : (fsSt ? fsSt.name : 'Not found')}`);
        if (bkSt) {
            console.log(`  MAY 23 BACKUP (class=${bkSt.className}):`);
            Object.keys(bkSt.academicHistory || {}).forEach(tk => {
                const marks = bkSt.academicHistory[tk]?.marks || {};
                console.log(`    Term ${tk} (${Object.keys(marks).length} marks):`);
                Object.keys(marks).forEach(subId => {
                    const sub = bkSubjects.find(x => x.id === subId);
                    console.log(`      [${subId}] "${sub ? sub.name : 'MISSING'}" = ${marks[subId]?.total}`);
                });
            });
        }
        if (fsSt) {
            console.log(`  FIRESTORE (class=${fsSt.className}):`);
            Object.keys(fsSt.academicHistory || {}).forEach(tk => {
                const marks = fsSt.academicHistory[tk]?.marks || {};
                console.log(`    Term ${tk} (${Object.keys(marks).length} marks):`);
                Object.keys(marks).forEach(subId => {
                    const sub = fsSubjects.find(x => x.id === subId);
                    console.log(`      [${subId}] "${sub ? sub.name : 'MISSING'}" = ${marks[subId]?.total}`);
                });
            });
        }
        console.log('');
    });
}

diagnoseUserIssues().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
