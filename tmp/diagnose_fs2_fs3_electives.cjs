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

async function diagnoseFS2FS3Electives() {
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const bkSubjects = backup.subjects || [];
    const bkStudents = backup.students || [];

    const fsStudentsSnap = await getDocs(collection(db, 'students'));
    const fsStudents = fsStudentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const fsSubjectsSnap = await getDocs(collection(db, 'subjects'));
    const fsSubjects = fsSubjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log('=== 1. COMMUNICATIVE ARABIC IN FS2 & FS3 ===\n');
    console.log('Communicative Arabic Subject (Du5idoGnJfvUVsWB3Drg) in Firestore:');
    const commArab = fsSubjects.find(s => s.id === 'Du5idoGnJfvUVsWB3Drg');
    console.log(commArab);

    console.log('\nFS2/FS3 Students in Firestore with Communicative Arabic mark:');
    fsStudents.filter(s => ['FS2','S1','FS3','S2'].includes(s.className || s.currentClass)).forEach(st => {
        const hist = st.academicHistory || {};
        Object.keys(hist).forEach(tk => {
            const marks = hist[tk]?.marks || {};
            if (marks['Du5idoGnJfvUVsWB3Drg'] !== undefined) {
                console.log(`  Student Adm ${st.adNo} (${st.name}, class=${st.className}) | Term ${tk} | mark=${marks['Du5idoGnJfvUVsWB3Drg']?.total}`);
            }
        });
    });

    console.log('\n=== 2. ELECTIVES FOR FS2 & FS3 IN MAY 23 BACKUP (EVEN SEMESTER) ===\n');

    console.log('All Elective Subjects in May 23 Backup targeting FS2/FS3:');
    bkSubjects.filter(s => s.subjectType === 'elective' && (s.targetClasses||[]).some(c => ['FS2','S1','FS3','S2'].includes(c))).forEach(s => {
        console.log(`  [${s.id}] "${s.name}" | type=${s.subjectType} | sem=${s.activeSemester} | classes=${(s.targetClasses||[]).join(',')}`);
    });

    console.log('\nFS2 (S1) Students Elective Marks in Even Semester (May 23 Backup):');
    bkStudents.filter(s => ['FS2','S1'].includes(s.className || s.currentClass)).forEach(st => {
        const history = st.academicHistory || {};
        const evenMarks = history['2025-2026-Even']?.marks || {};
        Object.keys(evenMarks).forEach(subId => {
            const sub = bkSubjects.find(x => x.id === subId);
            if (sub && sub.subjectType === 'elective') {
                console.log(`  Student Adm ${st.adNo} (${st.name}): [${subId}] "${sub.name}" = ${evenMarks[subId]?.total}`);
            }
        });
    });

    console.log('\nFS3 (S2) Students Elective Marks in Even Semester (May 23 Backup):');
    bkStudents.filter(s => ['FS3','S2'].includes(s.className || s.currentClass)).forEach(st => {
        const history = st.academicHistory || {};
        const evenMarks = history['2025-2026-Even']?.marks || {};
        Object.keys(evenMarks).forEach(subId => {
            const sub = bkSubjects.find(x => x.id === subId);
            if (sub && sub.subjectType === 'elective') {
                console.log(`  Student Adm ${st.adNo} (${st.name}): [${subId}] "${sub.name}" = ${evenMarks[subId]?.total}`);
            }
        });
    });

    console.log('\n=== 3. ELECTIVES FOR FS2 & FS3 IN FIRESTORE RIGHT NOW (EVEN SEMESTER) ===\n');

    console.log('All Elective Subjects in Firestore targeting FS2/FS3:');
    fsSubjects.filter(s => s.subjectType === 'elective' && (s.targetClasses||[]).some(c => ['FS2','S1','FS3','S2'].includes(c))).forEach(s => {
        console.log(`  [${s.id}] "${s.name}" | type=${s.subjectType} | sem=${s.activeSemester} | classes=${(s.targetClasses||[]).join(',')}`);
    });

    console.log('\nFS2 (S1) Students Elective Marks in Even Semester (Firestore):');
    fsStudents.filter(s => ['FS2','S1'].includes(s.className || s.currentClass)).forEach(st => {
        const history = st.academicHistory || {};
        const evenMarks = history['2025-2026-Even']?.marks || {};
        Object.keys(evenMarks).forEach(subId => {
            const sub = fsSubjects.find(x => x.id === subId);
            if (sub && sub.subjectType === 'elective') {
                console.log(`  Student Adm ${st.adNo} (${st.name}): [${subId}] "${sub.name}" = ${evenMarks[subId]?.total}`);
            }
        });
    });

    console.log('\nFS3 (S2) Students Elective Marks in Even Semester (Firestore):');
    fsStudents.filter(s => ['FS3','S2'].includes(s.className || s.currentClass)).forEach(st => {
        const history = st.academicHistory || {};
        const evenMarks = history['2025-2026-Even']?.marks || {};
        Object.keys(evenMarks).forEach(subId => {
            const sub = fsSubjects.find(x => x.id === subId);
            if (sub && sub.subjectType === 'elective') {
                console.log(`  Student Adm ${st.adNo} (${st.name}): [${subId}] "${sub.name}" = ${evenMarks[subId]?.total}`);
            }
        });
    });
}

diagnoseFS2FS3Electives().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
