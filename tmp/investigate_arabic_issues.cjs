const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

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
const backupSubjects = backup.subjects || [];

// Subject IDs that need checking
const COMM_ARABIC_ID   = 'Du5idoGnJfvUVsWB3Drg'; // Communicative Arabic → only HS3, PG1, D3
const ULOOMUL_QURAN_ID = 'zcETLOpNXYMgEE7VNARb'; // Uloomul Quran        → only D3, D2, PG1
// All "Arabic-type" subject IDs (for finding duplicates)
const ARABIC_SUBJECT_IDS = new Set([
    'c36I4lMYbFsEbfnXggbB', // Arabic (HS1, HS2)
    '0sqxyIEy00893p01q14D', // ARABIC WRITING (HS3, P2)
    COMM_ARABIC_ID,
    '4ILHgiGPtvR0TBQwpMpv', // Arabic Linguistics (PG1)
    'vTtTsFtSZph15dJ28Im6', // النحو الواضح
    'iYKwhn4uUF0sXEAn6vzn', // علم الصرف
    'caYZAo7jqThNe2ehNGaR', // معاني القرآن
    'FZEU0cd5htr3RO7kwdAj', // مناهج المفسرين
]);

function subName(subId, liveSubjects) {
    const l = liveSubjects.find(s => s.id === subId);
    if (l) return `"${l.name}" [${l.subjectType}] [${(l.targetClasses||[]).join(',')}]`;
    const b = backupSubjects.find(s => s.id === subId);
    return b ? `"${b.name}" [BACKUP-ONLY]` : '"UNKNOWN"';
}

function bkHasSubject(bkStudent, subjectId) {
    const history = bkStudent?.academicHistory || {};
    for (const td of Object.values(history)) {
        if (td?.marks?.[subjectId] !== undefined) return true;
    }
    return false;
}

// Deletions to execute after analysis
const toDelete = []; // { docId, ref, term, subjectId, label }

async function investigate() {
    const studentsSnap = await getDocs(collection(db, 'students'));
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const liveSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allStudents  = studentsSnap.docs.map(d => ({ _docId: d.id, _ref: d.ref, ...d.data() }));

    // ─────────────────────────────────────────────────────────────
    // CASE 1 — Muhammed Anas K (Adm 152) Communicative Arabic in FS3
    // ─────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('CASE 1 — Adm 152 Communicative Arabic (should NOT be in FS3)');
    console.log('══════════════════════════════════════════════════════════════\n');

    const anas    = allStudents.find(s => String(s.adNo) === '152');
    const anasBk  = backupStudents.find(s => String(s.adNo) === '152');
    const bkAnasHas = bkHasSubject(anasBk, COMM_ARABIC_ID);

    if (anas) {
        Object.entries(anas.academicHistory || {}).forEach(([term, td]) => {
            const m = td?.marks?.[COMM_ARABIC_ID];
            if (m !== undefined) {
                const inBk = bkAnasHas;
                console.log(`⚠️  Term "${term}": Comm Arabic = ${m.total} (${m.ext}+${m.int})`);
                console.log(`   In backup? ${inBk ? 'YES (keep)' : 'NO → MARK FOR DELETION'}`);
                if (!inBk) toDelete.push({ docId: anas._docId, ref: anas._ref, term, subjectId: COMM_ARABIC_ID, label: 'Comm Arabic', student: `Adm 152 ${anas.name}` });
            }
        });
        if (!Object.values(anas.academicHistory || {}).some(td => td?.marks?.[COMM_ARABIC_ID] !== undefined))
            console.log('✅ No Comm Arabic mark found in DB for Adm 152.');
    }

    // ─────────────────────────────────────────────────────────────
    // CASE 2 — D1 students: extra Arabic-type subject
    // ─────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('CASE 2 — D1 students: Extra Arabic-type subject (Comm Arabic)');
    console.log('══════════════════════════════════════════════════════════════\n');

    const d1Students = allStudents.filter(s => s.currentClass === 'D1' || s.className === 'D1');
    console.log(`D1 students in DB: ${d1Students.length}`);

    d1Students.forEach(st => {
        const bkSt = backupStudents.find(b => String(b.adNo) === String(st.adNo));
        Object.entries(st.academicHistory || {}).forEach(([term, td]) => {
            const marks = td?.marks || {};
            const arabicMarks = Object.keys(marks).filter(k => ARABIC_SUBJECT_IDS.has(k) || 
                liveSubjects.find(s => s.id === k)?.name?.toLowerCase().includes('arabic'));
            
            if (arabicMarks.length > 1) {
                console.log(`⚠️  [${st.adNo}] ${st.name} | Term "${term}" → ${arabicMarks.length} arabic-type marks:`);
                arabicMarks.forEach(k => {
                    const inBk = bkHasSubject(bkSt, k);
                    console.log(`     [${k}] ${subName(k, liveSubjects)} = ${marks[k].total} | in backup? ${inBk ? 'YES' : 'NO → DELETE'}`);
                    if (!inBk) toDelete.push({ docId: st._docId, ref: st._ref, term, subjectId: k, label: `Arabic[${k}]`, student: `Adm ${st.adNo} ${st.name}` });
                });
            } else if (arabicMarks.length === 1) {
                const k = arabicMarks[0];
                const inBk = bkHasSubject(bkSt, k);
                // Only flag if it's Communicative Arabic (wrong class)
                if (k === COMM_ARABIC_ID) {
                    console.log(`⚠️  [${st.adNo}] ${st.name} | Term "${term}" → Comm Arabic = ${marks[k].total} | in backup? ${inBk ? 'YES' : 'NO → DELETE'}`);
                    if (!inBk) toDelete.push({ docId: st._docId, ref: st._ref, term, subjectId: k, label: 'Comm Arabic', student: `Adm ${st.adNo} ${st.name}` });
                }
            }
        });
    });

    // ─────────────────────────────────────────────────────────────
    // CASE 3 — D1 students: Uloomul Quran (should only be D2, D3, PG1)
    // ─────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log('CASE 3 — D1 students: Uloomul Quran (should NOT be in D1)');
    console.log('══════════════════════════════════════════════════════════════\n');

    d1Students.forEach(st => {
        const bkSt = backupStudents.find(b => String(b.adNo) === String(st.adNo));
        Object.entries(st.academicHistory || {}).forEach(([term, td]) => {
            const m = td?.marks?.[ULOOMUL_QURAN_ID];
            if (m !== undefined) {
                const inBk = bkHasSubject(bkSt, ULOOMUL_QURAN_ID);
                console.log(`⚠️  [${st.adNo}] ${st.name} | Term "${term}" → Uloomul Quran = ${m.total} (${m.ext}+${m.int}) | in backup? ${inBk ? 'YES (keep)' : 'NO → DELETE'}`);
                if (!inBk) toDelete.push({ docId: st._docId, ref: st._ref, term, subjectId: ULOOMUL_QURAN_ID, label: 'Uloomul Quran', student: `Adm ${st.adNo} ${st.name}` });
            }
        });
    });

    // Also check ALL students for Uloomul Quran in wrong classes
    const uqWrongClass = allStudents.filter(s => !['D1','D2','D3','PG1'].includes(s.currentClass || s.className));
    let uqWrongFound = false;
    uqWrongClass.forEach(st => {
        Object.entries(st.academicHistory || {}).forEach(([term, td]) => {
            const m = td?.marks?.[ULOOMUL_QURAN_ID];
            if (m !== undefined) {
                uqWrongFound = true;
                const bkSt = backupStudents.find(b => String(b.adNo) === String(st.adNo));
                const inBk = bkHasSubject(bkSt, ULOOMUL_QURAN_ID);
                console.log(`⚠️  [${st.adNo}] ${st.name} (${st.currentClass}) | Term "${term}" → Uloomul Quran = ${m.total} | in backup? ${inBk ? 'YES' : 'NO → DELETE'}`);
                if (!inBk) toDelete.push({ docId: st._docId, ref: st._ref, term, subjectId: ULOOMUL_QURAN_ID, label: 'Uloomul Quran', student: `Adm ${st.adNo} ${st.name}` });
            }
        });
    });
    if (!uqWrongFound) console.log('No Uloomul Quran marks found in wrong classes beyond D1.');

    // ─────────────────────────────────────────────────────────────
    // EXECUTE DELETIONS
    // ─────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════════');
    console.log(`DELETIONS QUEUED: ${toDelete.length}`);
    console.log('══════════════════════════════════════════════════════════════\n');

    if (toDelete.length === 0) {
        console.log('Nothing to delete. All suspicious marks exist in backup too.');
        process.exit(0);
    }

    toDelete.forEach((d, i) => {
        console.log(`${i+1}. ${d.student} | term="${d.term}" | subject: ${d.label} [${d.subjectId}]`);
    });

    console.log('\nExecuting deletions...\n');
    for (const item of toDelete) {
        const updatePayload = {
            [`academicHistory.${item.term}.marks.${item.subjectId}`]: null
        };
        // Firestore doesn't support null in updateDoc to delete a nested field — use deleteField
        const { deleteField } = require('firebase/firestore');
        const payload = {};
        payload[`academicHistory.${item.term}.marks.${item.subjectId}`] = deleteField();
        await updateDoc(item.ref, payload);
        console.log(`✅ DELETED: ${item.student} | ${item.label} from term "${item.term}"`);
    }

    console.log('\n✅ All deletions complete.');
}

investigate().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
