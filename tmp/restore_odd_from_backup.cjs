const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteField } = require('firebase/firestore');

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

// ── Verified manual mapping: backup subId → live catalog subId ──────────────
const ID_MAP = {
    // Same ID in both
    'U5h7b4ayJ4TXYPe3RK3U': 'U5h7b4ayJ4TXYPe3RK3U', // LIFE SKILLS
    'LJmadPPVVEm4fgoV9sa7': 'LJmadPPVVEm4fgoV9sa7', // THAFSEER NASAFI (D3 only)
    'NGJhadni3bvGmbcE4qfb': 'NGJhadni3bvGmbcE4qfb', // HADEES
    'b7i4ktKfIjDUcpH43Qyb': 'b7i4ktKfIjDUcpH43Qyb', // URDU BASICS (elective)
    'PGKFnsp7FVreVxHxf3h5': 'PGKFnsp7FVreVxHxf3h5', // ISLAMIC HISTORY AMAVIYYA
    '0rZIlO28oNyTzxvIgStz': '0rZIlO28oNyTzxvIgStz', // البلاغة الواضحة
    'L2k1CmbHyJ4uQE8IXMRG': 'L2k1CmbHyJ4uQE8IXMRG', // ENGLISH (D elective)
    '5IK84Czem1O3uqNYxk3P': '5IK84Czem1O3uqNYxk3P', // MA'NI (D1)
    'Pz43xv74fMApuJXicYAR': 'Pz43xv74fMApuJXicYAR', // IT MS EXCEL (D1)
    'gfruq2d6apOpKs4K4oAr': 'gfruq2d6apOpKs4K4oAr', // ICT
    'FNvcco4gBpKSr4PZvWAF': 'FNvcco4gBpKSr4PZvWAF', // أسرار ألفاظ القرآن
    '4D4nchSJchNn7ON3yDFl': '4D4nchSJchNn7ON3yDFl', // تيسير الولدان
    'uGxUEb1XGGe2H1dh77gH': 'uGxUEb1XGGe2H1dh77gH', // THAFSEER JALALIN (D2)
    'Waz0IPCaf7QS3wR8JWyw': 'Waz0IPCaf7QS3wR8JWyw', // RESEARCH
    '4GnL8JeWBqKpHvQSEvtJ': '4GnL8JeWBqKpHvQSEvtJ', // علوم القرآن
    '4ILHgiGPtvR0TBQwpMpv': '4ILHgiGPtvR0TBQwpMpv', // Arabic Linguistics (PG1)

    // FIQH → Fiqh (simple)
    'HhYOvVLxGKjUqzwDQ7nn': 'q89Hvjls2oxeLIH0KPP7',
    'NNXtpSXZ7koV9ThPj4JC': 'q89Hvjls2oxeLIH0KPP7',
    'a1DIz7nG2NOscDNHMm4g': 'q89Hvjls2oxeLIH0KPP7',
    '5F74s7oqSKHy2Ikmu6SV': 'q89Hvjls2oxeLIH0KPP7',
    '2d9xeZydKU2MJ9LNBqBK': 'q89Hvjls2oxeLIH0KPP7',

    'fkJarsZ7vbOArzsh2d3G': 'oEeoKz4sXwWUireULgrq', // QATHRUNADA
    '1DAJIniYi05HFryzRm7l': 'ajSb4N77pzO9n6fqKbfC', // TAFSEER'UL JALALAINI (D2/D3)
    'LE3H8jmEoBG7Cfv3wRgu': 'pOj9STiOdMSkFLhpa2v1', // MANTHIQ → Manthiq
    'KXGpLyGf0ilEAFhtWB8W': 'ho0E0KjbSGybbkr2NakY', // BALAGA
    'ec3I3Je2t5IXC6fr6t1j': 'vTtTsFtSZph15dJ28Im6', // النحو الواضح
    '3IEwTRLXB39rgEcpfgxB': 'qurspjhTpEcZOppD5IgE', // MA'ANI → Ma'ani (D2)

    // NAHV (all variants)
    'bxeWMVbsuqbbEYVut73e': 'zPTnqG80jqeClZtRXXOh',
    '6cnp4HcPmDE9KRm3LAsG': 'zPTnqG80jqeClZtRXXOh',
    'DKrOWn7dfutHJsbgtOP7': 'zPTnqG80jqeClZtRXXOh',
    'EarvmCeEDnoBQFADEiMY': 'zPTnqG80jqeClZtRXXOh',
    '4ZP825755fjBhM8Ku2k5': 'zPTnqG80jqeClZtRXXOh',
    '669XsQaM1KbySALDY13h': 'zPTnqG80jqeClZtRXXOh',

    // DOURA (all variants)
    'Gh5xTNdCRAYL47ZRCPgC': 'yehe4gkz6bD6XbxofAXU',
    '945iCqjkQGZJ3qEvdZg8': 'yehe4gkz6bD6XbxofAXU',
    'FDpQsjimx20bWQyhVKhb': 'yehe4gkz6bD6XbxofAXU',
    'J8QJQgK8Qkr9Sfyzhg6M': 'yehe4gkz6bD6XbxofAXU',

    'AAepbPj7Llmhm67Th4ML': 'g9P8vGMSRy0cYdUcoFr3', // THAJWEED

    // SARF → simple SARF (not AJNAS)
    'M3TalRQDW5DUTEwplHS3': 'rYDaCyK2vLsj8LxMMI6a',
    // SARF (AJNAS) → keep as AJNAS variant
    '2a6makFhlDyCRa90FMeN': 'js77i63e9gYAwSj4we6z',

    '8E9XVxkbo11sDKpLvaT5': 'k3syQ8J209hZJ0rHDgqn', // MOTIVATION

    // URDU → simple URDU
    '20hGruyLHQSAeqIcie5a': 'ydchkXBm7GouzmRN4Ksc',
    'SumCyUAGD3BlU00sUnX2': 'ydchkXBm7GouzmRN4Ksc',

    // ENGLISH → simple ENGLISH (D/HS class)
    'GW0CyD9buC4kQZFoDRq0': 'xd6INM4khNcQM4PHVehF',
    'STS8GX5LIfWcOKWG2iN7': 'xd6INM4khNcQM4PHVehF',

    // IT → simple It
    'dTxBOL1D4t7nnjGpTbV6': 'vkGSpLNgUWoLu4tOKkbK',

    // ARABIC (HS school) → Arabic
    'CCCg6g31DlwK7WgbmPJL': 'c36I4lMYbFsEbfnXggbB',

    // THAFSEER → simple THAFSEER (not NASAFI)
    '3y4xZzW4qYkACgmJ0AjM': 'gRGZIOuy0XDiiy5d2z2i',
    '2Ts9ogW7nfh3dd83pBY1': 'gRGZIOuy0XDiiy5d2z2i',

    // HADEETH → Hadeeth
    'GvfbiwbXkn6lwxx9Gr8T': 'qkAnwPrMQmLt9mYOdizC',
};

function remapMark(backupId) {
    return ID_MAP[backupId] || backupId; // use as-is if no mapping
}

function buildCleanOddTerm(bkTermData) {
    if (!bkTermData) return null;
    const oldMarks = bkTermData.marks || {};
    const newMarks = {};
    const skipped = [];

    Object.entries(oldMarks).forEach(([backupId, markVal]) => {
        const liveId = remapMark(backupId);
        if (!liveId) { skipped.push(backupId); return; }

        // Merge duplicates: if same liveId appears from multiple backup IDs, keep higher total
        if (newMarks[liveId]) {
            if ((markVal.total || 0) > (newMarks[liveId].total || 0)) {
                newMarks[liveId] = sanitizeMark(markVal);
            }
        } else {
            newMarks[liveId] = sanitizeMark(markVal);
        }
    });

    return {
        clean: {
            className: bkTermData.className || '',
            semester: 'Odd',
            marks: newMarks,
            grandTotal: bkTermData.grandTotal || 0,
            average: bkTermData.average || 0,
            rank: bkTermData.rank || 0,
            performanceLevel: bkTermData.performanceLevel || 'Not Assessed',
        },
        skipped
    };
}

function sanitizeMark(m) {
    return {
        total: m.total ?? 0,
        ext:   m.ext   ?? 0,
        int:   m.int   ?? 0,
        status: m.status || (((m.total ?? 0) >= 40) ? 'Passed' : 'Failed'),
    };
}

// Legacy top-level fields to delete from student documents
const LEGACY_FIELDS = ['marks','grandTotal','average','rank','performanceLevel','subjectMetadata','semester','termKey','className'];

async function restore() {
    const studentsSnap = await getDocs(collection(db, 'students'));
    const liveStudents = studentsSnap.docs.map(d => ({ _docId: d.id, _ref: d.ref, ...d.data() }));

    console.log(`Live DB students: ${liveStudents.length}`);
    console.log(`Backup students:  ${backupStudents.length}\n`);

    let restored = 0, notInBackup = 0, skippedTotal = 0;

    // Build batches of max 500 ops (Firestore limit)
    const BATCH_SIZE = 40; // use smaller for safety
    let batch = [];
    const allOps = [];

    for (const liveDoc of liveStudents) {
        const adNo = String(liveDoc.adNo);
        const bkSt = backupStudents.find(s => String(s.adNo) === adNo);

        const updatePayload = {};
        let hasChanges = false;

        // 1. Delete Even semester (full wipe — fresh start)
        if (liveDoc.academicHistory?.['2025-2026-Even']) {
            updatePayload['academicHistory.2025-2026-Even'] = deleteField();
            hasChanges = true;
        }

        // 2. Delete empty 2026-2027-Odd shell
        if (liveDoc.academicHistory?.['2026-2027-Odd']) {
            updatePayload['academicHistory.2026-2027-Odd'] = deleteField();
            hasChanges = true;
        }

        // 3. Delete legacy top-level fields
        LEGACY_FIELDS.forEach(field => {
            if (liveDoc[field] !== undefined) {
                updatePayload[field] = deleteField();
                hasChanges = true;
            }
        });

        // 4. Restore Odd marks from backup (if student is in backup)
        if (bkSt) {
            const bkOdd = bkSt.academicHistory?.['2025-2026-Odd'];
            if (bkOdd && Object.keys(bkOdd.marks || {}).length > 0) {
                const { clean, skipped } = buildCleanOddTerm(bkOdd);
                updatePayload['academicHistory.2025-2026-Odd'] = clean;
                if (skipped.length > 0) {
                    console.log(`  [${adNo}] ${liveDoc.name}: skipped ${skipped.length} unknown subIds: ${skipped.join(', ')}`);
                    skippedTotal += skipped.length;
                }
                hasChanges = true;
                restored++;
            }
        } else {
            notInBackup++;
        }

        if (hasChanges) {
            allOps.push({ ref: liveDoc._ref, payload: updatePayload, adNo, name: liveDoc.name });
        }
    }

    console.log(`\nOperations to execute: ${allOps.length}`);
    console.log(`  Will restore Odd marks: ${restored}`);
    console.log(`  Not in backup (new students): ${notInBackup}`);
    console.log(`  Unknown subIds skipped total: ${skippedTotal}\n`);

    // Execute in chunks
    let done = 0;
    for (let i = 0; i < allOps.length; i += BATCH_SIZE) {
        const chunk = allOps.slice(i, i + BATCH_SIZE);
        await Promise.all(chunk.map(op => updateDoc(op.ref, op.payload)));
        done += chunk.length;
        console.log(`Progress: ${done}/${allOps.length} students updated...`);
    }

    console.log(`\n✅ RESTORE COMPLETE`);
    console.log(`   Odd marks restored from backup: ${restored} students`);
    console.log(`   Even marks wiped (fresh start): ${liveStudents.length} students`);
    console.log(`   Legacy top-level fields removed`);
    console.log(`   Unknown subIds skipped: ${skippedTotal}`);
}

restore().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
