const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteField, updateDoc } = require('firebase/firestore');

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

const ULOOMUL_QURAN_ID = 'zcETLOpNXYMgEE7VNARb'; // valid only D2, D3, PG1
const COMM_ARABIC_ID   = 'Du5idoGnJfvUVsWB3Drg'; // valid only HS3, PG1, D3

// Arabic-type IDs that are NOT supposed to be in D1
const ARABIC_WRONG_FOR_D1 = new Set([
    'c36I4lMYbFsEbfnXggbB', // Arabic school_subject → HS1, HS2
    '0sqxyIEy00893p01q14D', // ARABIC WRITING → HS3, P2
    COMM_ARABIC_ID,          // Communicative Arabic → HS3, PG1, D3
    '4ILHgiGPtvR0TBQwpMpv', // Arabic Linguistics → PG1
]);

function bkStudent(adNo) { return backupStudents.find(s => String(s.adNo) === String(adNo)); }
function bkHas(adNo, subId) {
    const bk = bkStudent(adNo);
    if (!bk) return false;
    for (const td of Object.values(bk.academicHistory || {})) {
        if (td?.marks?.[subId] !== undefined) return true;
    }
    if (bk.marks?.[subId] !== undefined) return true;
    return false;
}
function subLabel(subId, liveSubjects) {
    const l = liveSubjects.find(s => s.id === subId);
    if (l) return `"${l.name}" [${l.subjectType}] valid=[${(l.targetClasses||[]).join(',')}]`;
    const b = backupSubjects.find(s => s.id === subId);
    return b ? `"${b.name}" [BACKUP-ONLY]` : `"UNKNOWN"`;
}

const toDelete = [];

async function run() {
    const studentsSnap = await getDocs(collection(db, 'students'));
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const liveSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const allStudents  = studentsSnap.docs.map(d => ({ _docId: d.id, _ref: d.ref, ...d.data() }));

    // ──────────────────────────────────────────────────────────────────────────
    // CASE 1: Adm 98 — Uloomul Quran in D1 Odd
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════════════════════════════');
    console.log('CASE 1 — Adm 98: Uloomul Quran in D1 (valid only D2/D3/PG1)');
    console.log('══════════════════════════════════════════════════════════════════\n');

    const st98 = allStudents.find(s => String(s.adNo) === '98');
    const bk98 = bkStudent('98');

    if (!st98) { console.log('Adm 98 NOT FOUND in DB'); }
    else {
        console.log(`DB: [${st98.adNo}] ${st98.name} | class: ${st98.currentClass || st98.className}`);
        console.log(`BACKUP: ${bk98 ? `[${bk98.adNo}] ${bk98.name} | class: ${bk98.className || bk98.currentClass}` : 'NOT FOUND in backup'}\n`);

        // Show ALL marks this student has (for full context)
        Object.entries(st98.academicHistory || {}).forEach(([term, td]) => {
            const marks = td?.marks || {};
            console.log(`  Term "${term}" — ${Object.keys(marks).length} subjects:`);
            Object.entries(marks).forEach(([subId, m]) => {
                const inBk = bkHas('98', subId);
                const isUQ = subId === ULOOMUL_QURAN_ID;
                const flag = isUQ ? (inBk ? '⚠️  UQ IN BACKUP' : '❌ UQ NOT IN BACKUP → DELETE') : (inBk ? '✅ in backup' : '⚠️  not in backup');
                console.log(`    [${subId}] ${subLabel(subId, liveSubjects)} = ${m.total} (${m.ext}+${m.int}) | ${flag}`);
                if (isUQ && !inBk) {
                    toDelete.push({ ref: st98._ref, term, subjectId: subId, label: 'Uloomul Quran', student: `Adm 98 ${st98.name}` });
                }
            });
        });

        // Show backup marks for comparison
        console.log('\n  BACKUP marks for Adm 98:');
        if (!bk98) { console.log('  (not in backup)'); }
        else {
            Object.entries(bk98.academicHistory || {}).forEach(([term, td]) => {
                const marks = td?.marks || {};
                console.log(`  Backup Term "${term}": ${Object.keys(marks).length} subjects`);
                Object.entries(marks).forEach(([subId, m]) => {
                    const bkSub = backupSubjects.find(s => s.id === subId);
                    console.log(`    [${subId}] "${bkSub?.name || 'UNKNOWN'}" = ${m.total}`);
                });
            });
            if (bk98.marks) {
                console.log('  Backup legacy marks:', Object.keys(bk98.marks).map(k => {
                    const bkSub = backupSubjects.find(s => s.id === k);
                    return `[${k}]"${bkSub?.name || '?'}"=${bk98.marks[k]?.total}`;
                }).join(', '));
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CASE 2: Adm 129 — M.Shabeeb extra Arabic in D1
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n\n══════════════════════════════════════════════════════════════════');
    console.log('CASE 2 — Adm 129 M.Shabeeb: Extra Arabic in D1');
    console.log('══════════════════════════════════════════════════════════════════\n');

    const st129 = allStudents.find(s => String(s.adNo) === '129');
    const bk129 = bkStudent('129');

    if (!st129) { console.log('Adm 129 NOT FOUND in DB'); }
    else {
        console.log(`DB: [${st129.adNo}] ${st129.name} | class: ${st129.currentClass || st129.className}`);
        console.log(`BACKUP: ${bk129 ? `[${bk129.adNo}] ${bk129.name} | class: ${bk129.className || bk129.currentClass}` : 'NOT FOUND in backup'}\n`);

        Object.entries(st129.academicHistory || {}).forEach(([term, td]) => {
            const marks = td?.marks || {};
            const arabicMarks = Object.entries(marks).filter(([k]) =>
                ARABIC_WRONG_FOR_D1.has(k) ||
                liveSubjects.find(s => s.id === k)?.name?.toLowerCase().includes('arabic')
            );

            console.log(`  Term "${term}" — ALL ${Object.keys(marks).length} subjects:`);
            Object.entries(marks).forEach(([subId, m]) => {
                const isArabic = ARABIC_WRONG_FOR_D1.has(subId) || liveSubjects.find(s => s.id === subId)?.name?.toLowerCase().includes('arabic');
                const inBk = bkHas('129', subId);
                const validClasses = liveSubjects.find(s => s.id === subId)?.targetClasses || [];
                const wrongClass = !validClasses.includes('D1');
                const tag = isArabic
                    ? (inBk ? '⚠️  ARABIC - IN BACKUP' : wrongClass ? '❌ ARABIC + WRONG CLASS + NOT IN BACKUP → DELETE' : '⚠️  ARABIC - NOT IN BACKUP')
                    : (inBk ? '' : '⚠️  not in backup');
                console.log(`    [${subId}] ${subLabel(subId, liveSubjects)} = ${m.total} (${m.ext}+${m.int}) ${tag}`);
                if (isArabic && !inBk && wrongClass) {
                    toDelete.push({ ref: st129._ref, term, subjectId: subId, label: subLabel(subId, liveSubjects), student: `Adm 129 M.Shabeeb` });
                }
            });

            if (arabicMarks.length === 0) console.log(`    (no arabic-type marks this term)`);
        });

        console.log('\n  BACKUP Arabic marks for Adm 129:');
        if (!bk129) { console.log('  (not in backup)'); }
        else {
            let foundAny = false;
            Object.entries(bk129.academicHistory || {}).forEach(([term, td]) => {
                const marks = td?.marks || {};
                Object.entries(marks).forEach(([subId, m]) => {
                    const bkSub = backupSubjects.find(s => s.id === subId);
                    if (bkSub?.name?.toLowerCase().includes('arabic') || ARABIC_WRONG_FOR_D1.has(subId)) {
                        foundAny = true;
                        console.log(`    Backup Term "${term}": [${subId}] "${bkSub?.name}" = ${m.total}`);
                    }
                });
            });
            if (!foundAny) console.log('    ✅ NO Arabic marks in backup for Adm 129 → any arabic mark is wrong');
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // EXECUTE
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n\n══════════════════════════════════════════════════════════════════');
    console.log(`DELETIONS QUEUED: ${toDelete.length}`);
    console.log('══════════════════════════════════════════════════════════════════\n');

    if (toDelete.length === 0) {
        console.log('Nothing to delete — all marks exist in backup or need manual review.');
        process.exit(0);
    }

    toDelete.forEach((d, i) => console.log(`${i+1}. ${d.student} | term="${d.term}" | ${d.label}`));

    console.log('\nExecuting...\n');
    for (const item of toDelete) {
        const payload = {};
        payload[`academicHistory.${item.term}.marks.${item.subjectId}`] = deleteField();
        await updateDoc(item.ref, payload);
        console.log(`✅ DELETED: ${item.student} | ${item.label} from term "${item.term}"`);
    }
    console.log('\n✅ Done.');
}

run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
