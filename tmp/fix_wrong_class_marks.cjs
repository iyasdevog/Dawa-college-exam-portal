const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, deleteField, updateDoc } = require('firebase/firestore');

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

const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
const backupStudents = backup.students || [];
const backupSubjects  = backup.subjects  || [];

// ─── Subject IDs ────────────────────────────────────────────────────────────
const IDS = {
    COMM_ARABIC:    'Du5idoGnJfvUVsWB3Drg', // → only HS3, PG1, D3
    ULOOMUL_QURAN:  'zcETLOpNXYMgEE7VNARb', // → only D2, D3, PG1
    BALAGA:         'ho0E0KjbSGybbkr2NakY', // → only D2, D1 (Even only)
    ARABIC_SCHOOL:  'c36I4lMYbFsEbfnXggbB', // → only HS1, HS2
    ARABIC_WRITING: '0sqxyIEy00893p01q14D', // → only HS3, P2
};

// Which classes each subject is VALID for
const VALID_CLASSES = {
    [IDS.COMM_ARABIC]:   ['HS3','PG1','D3'],
    [IDS.ULOOMUL_QURAN]: ['D2','D3','PG1'],
    [IDS.BALAGA]:        ['D2','D1'],
    [IDS.ARABIC_SCHOOL]: ['HS1','HS2'],
    [IDS.ARABIC_WRITING]:['HS3','P2'],
};

// All Arabic-type IDs (for detecting multiple arabic subjects in same class)
const ALL_ARABIC_IDS = new Set(Object.values(IDS));

function bkHas(adNo, subjectId) {
    const bk = backupStudents.find(s => String(s.adNo) === String(adNo));
    if (!bk) return false;
    for (const td of Object.values(bk.academicHistory || {})) {
        if (td?.marks?.[subjectId] !== undefined) return true;
    }
    return false;
}

function subLabel(subId, liveSubjects) {
    const l = liveSubjects.find(s => s.id === subId);
    if (l) return `"${l.name}" [${l.subjectType}] valid=[${(l.targetClasses||[]).join(',')}]`;
    const b = backupSubjects.find(s => s.id === subId);
    return b ? `"${b.name}" [BACKUP-ONLY]` : `"UNKNOWN"`;
}

const toDelete = []; // { ref, term, subjectId, label, student }

async function run() {
    const studentsSnap = await getDocs(collection(db, 'students'));
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const liveSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allStudents  = studentsSnap.docs.map(d => ({ _docId: d.id, _ref: d.ref, ...d.data() }));

    function getClass(st) { return st.currentClass || st.className || ''; }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: check a specific subject in students of a given class
    // ─────────────────────────────────────────────────────────────────────────
    function checkSubjectInClass(className, subjectId, reason) {
        const students = allStudents.filter(s => getClass(s) === className);
        console.log(`\n── ${reason} (${className}, ${students.length} students) ──`);
        let found = 0;
        students.forEach(st => {
            Object.entries(st.academicHistory || {}).forEach(([term, td]) => {
                const m = td?.marks?.[subjectId];
                if (m === undefined) return;
                found++;
                const inBk = bkHas(st.adNo, subjectId);
                const action = inBk ? '⚠️  IN BACKUP → KEEP' : '❌ NOT IN BACKUP → DELETE';
                console.log(`  [${st.adNo}] ${st.name} | term "${term}" | ${subLabel(subjectId, liveSubjects)} = ${m.total} (${m.ext}+${m.int}) | ${action}`);
                if (!inBk) toDelete.push({ ref: st._ref, term, subjectId, label: subLabel(subjectId, liveSubjects), student: `Adm ${st.adNo} ${st.name}` });
            });
        });
        if (found === 0) console.log('  ✅ No students in this class have this subject mark.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper: detect students with MULTIPLE Arabic-type marks in same term
    // ─────────────────────────────────────────────────────────────────────────
    function checkDuplicateArabicInClass(className) {
        const students = allStudents.filter(s => getClass(s) === className);
        console.log(`\n── Duplicate Arabic in ${className} (${students.length} students) ──`);
        let found = 0;
        students.forEach(st => {
            Object.entries(st.academicHistory || {}).forEach(([term, td]) => {
                const marks = td?.marks || {};
                const arabicKeys = Object.keys(marks).filter(k => {
                    if (ALL_ARABIC_IDS.has(k)) return true;
                    const sub = liveSubjects.find(s => s.id === k);
                    return sub?.name?.toLowerCase().includes('arabic');
                });
                if (arabicKeys.length <= 1) return;
                found++;
                console.log(`  ⚠️  [${st.adNo}] ${st.name} | term "${term}" → ${arabicKeys.length} arabic marks:`);
                arabicKeys.forEach(k => {
                    const validClasses = VALID_CLASSES[k] || (liveSubjects.find(s => s.id === k)?.targetClasses || []);
                    const isWrongClass = !validClasses.includes(className);
                    const inBk = bkHas(st.adNo, k);
                    const action = inBk ? '⚠️  IN BACKUP → KEEP' : (isWrongClass ? '❌ WRONG CLASS + NOT IN BACKUP → DELETE' : '⚠️  VALID CLASS BUT NOT IN BACKUP');
                    console.log(`    [${k}] ${subLabel(k, liveSubjects)} = ${marks[k].total} | ${action}`);
                    if (!inBk && isWrongClass) toDelete.push({ ref: st._ref, term, subjectId: k, label: subLabel(k, liveSubjects), student: `Adm ${st.adNo} ${st.name}` });
                });
            });
        });
        if (found === 0) console.log('  ✅ No duplicate arabic marks found.');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Also check ALL students for subjects outside their valid class list
    // ─────────────────────────────────────────────────────────────────────────
    function checkSubjectAnyWrongClass(subjectId) {
        const validClasses = VALID_CLASSES[subjectId] || [];
        const wrongStudents = allStudents.filter(s => !validClasses.includes(getClass(s)));
        let found = 0;
        wrongStudents.forEach(st => {
            Object.entries(st.academicHistory || {}).forEach(([term, td]) => {
                const m = td?.marks?.[subjectId];
                if (m === undefined) return;
                found++;
                const inBk = bkHas(st.adNo, subjectId);
                const action = inBk ? '⚠️  IN BACKUP → KEEP' : '❌ NOT IN BACKUP → DELETE';
                console.log(`  [${st.adNo}] ${st.name} (${getClass(st)}) | term "${term}" | = ${m.total} | ${action}`);
                if (!inBk) toDelete.push({ ref: st._ref, term, subjectId, label: subLabel(subjectId, liveSubjects), student: `Adm ${st.adNo} ${st.name} (${getClass(st)})` });
            });
        });
        if (found === 0) console.log(`  ✅ No wrong-class students have this subject.`);
    }

    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n\n══════════════════════════════════════════════════════════════════');
    console.log('CASE 1 — Communicative Arabic in WRONG classes (valid: HS3, PG1, D3)');
    console.log('══════════════════════════════════════════════════════════════════');
    checkSubjectAnyWrongClass(IDS.COMM_ARABIC);

    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n\n══════════════════════════════════════════════════════════════════');
    console.log('CASE 2 — Uloomul Quran in WRONG classes (valid: D2, D3, PG1)');
    console.log('══════════════════════════════════════════════════════════════════');
    checkSubjectAnyWrongClass(IDS.ULOOMUL_QURAN);

    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n\n══════════════════════════════════════════════════════════════════');
    console.log('CASE 3 — Balaga [ho0E0Kjb] in WRONG classes (valid: D2, D1)');
    console.log('══════════════════════════════════════════════════════════════════');
    checkSubjectAnyWrongClass(IDS.BALAGA);

    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n\n══════════════════════════════════════════════════════════════════');
    console.log('CASE 4 — Duplicate Arabic subjects in D1, D2, P2');
    console.log('══════════════════════════════════════════════════════════════════');
    checkDuplicateArabicInClass('D1');
    checkDuplicateArabicInClass('D2');
    checkDuplicateArabicInClass('P2');

    // ═════════════════════════════════════════════════════════════════════════
    // EXECUTE DELETIONS
    // ═════════════════════════════════════════════════════════════════════════
    console.log('\n\n══════════════════════════════════════════════════════════════════');
    console.log(`DELETIONS QUEUED: ${toDelete.length}`);
    console.log('══════════════════════════════════════════════════════════════════\n');

    if (toDelete.length === 0) {
        console.log('✅ Nothing to delete. All suspicious marks exist in backup (were legitimate).');
        process.exit(0);
    }

    toDelete.forEach((d, i) => {
        console.log(`${i+1}. ${d.student} | term="${d.term}" | subject: ${d.label}`);
    });

    console.log('\n\nExecuting deletions from Firestore...\n');
    for (const item of toDelete) {
        const payload = {};
        payload[`academicHistory.${item.term}.marks.${item.subjectId}`] = deleteField();
        await updateDoc(item.ref, payload);
        console.log(`✅ DELETED: ${item.student} | ${item.label} from term "${item.term}"`);
    }
    console.log('\n✅ All done.');
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
