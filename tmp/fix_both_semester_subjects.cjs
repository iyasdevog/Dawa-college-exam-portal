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
const backupSubjects  = backup.subjects  || [];

// ── CORRECTED manual mapping: backup subject ID → live catalog ID ──────────
// Auto-mapper had wrong matches — these are the verified correct mappings
const MANUAL_MAPPING = {
    // Correctly auto-mapped (same ID)
    'U5h7b4ayJ4TXYPe3RK3U': 'U5h7b4ayJ4TXYPe3RK3U', // LIFE SKILLS
    'LJmadPPVVEm4fgoV9sa7': 'LJmadPPVVEm4fgoV9sa7', // THAFSEER NASAFI (D3)
    'NGJhadni3bvGmbcE4qfb': 'NGJhadni3bvGmbcE4qfb', // HADEES
    'b7i4ktKfIjDUcpH43Qyb': 'b7i4ktKfIjDUcpH43Qyb', // URDU BASICS
    'PGKFnsp7FVreVxHxf3h5': 'PGKFnsp7FVreVxHxf3h5', // ISLAMIC HISTORY IN AMAVIYYA
    '0rZIlO28oNyTzxvIgStz': '0rZIlO28oNyTzxvIgStz', // البلاغة الواضحة
    'L2k1CmbHyJ4uQE8IXMRG': 'L2k1CmbHyJ4uQE8IXMRG', // ENGLISH (D1-D3)
    '5IK84Czem1O3uqNYxk3P': '5IK84Czem1O3uqNYxk3P', // MA'NI
    'Pz43xv74fMApuJXicYAR': 'Pz43xv74fMApuJXicYAR', // IT MS EXCEL (D1)
    'gfruq2d6apOpKs4K4oAr': 'gfruq2d6apOpKs4K4oAr', // ICT
    'FNvcco4gBpKSr4PZvWAF': 'FNvcco4gBpKSr4PZvWAF', // أسرار ألفاظ القرآن
    '4D4nchSJchNn7ON3yDFl': '4D4nchSJchNn7ON3yDFl', // تيسير الولدان
    'uGxUEb1XGGe2H1dh77gH': 'uGxUEb1XGGe2H1dh77gH', // THAFSEER JALALIN
    'Waz0IPCaf7QS3wR8JWyw': 'Waz0IPCaf7QS3wR8JWyw', // RESEARCH
    '4GnL8JeWBqKpHvQSEvtJ': '4GnL8JeWBqKpHvQSEvtJ', // علوم القرآن
    '4ILHgiGPtvR0TBQwpMpv': '4ILHgiGPtvR0TBQwpMpv', // Arabic Linguistics (PG1)

    // CORRECTED mappings (auto-mapper was wrong)
    'HhYOvVLxGKjUqzwDQ7nn': 'q89Hvjls2oxeLIH0KPP7', // FIQH → Fiqh
    'NNXtpSXZ7koV9ThPj4JC': 'q89Hvjls2oxeLIH0KPP7', // FIQH → Fiqh
    'a1DIz7nG2NOscDNHMm4g': 'q89Hvjls2oxeLIH0KPP7', // FIQH → Fiqh
    '5F74s7oqSKHy2Ikmu6SV': 'q89Hvjls2oxeLIH0KPP7', // FIQH → Fiqh
    '2d9xeZydKU2MJ9LNBqBK': 'q89Hvjls2oxeLIH0KPP7', // FIQH → Fiqh

    'fkJarsZ7vbOArzsh2d3G': 'oEeoKz4sXwWUireULgrq', // QATHRUNADA
    '1DAJIniYi05HFryzRm7l': 'ajSb4N77pzO9n6fqKbfC', // TAFSEER'UL JALALAINI
    'LE3H8jmEoBG7Cfv3wRgu': 'pOj9STiOdMSkFLhpa2v1', // MANTHIQ → Manthiq
    'KXGpLyGf0ilEAFhtWB8W': 'ho0E0KjbSGybbkr2NakY', // BALAGA
    'ec3I3Je2t5IXC6fr6t1j': 'vTtTsFtSZph15dJ28Im6', // النحو الواضح
    '3IEwTRLXB39rgEcpfgxB': 'qurspjhTpEcZOppD5IgE', // MA'ANI → Ma'ani (D2)

    // NAHV — all variants map to same live ID
    'bxeWMVbsuqbbEYVut73e': 'zPTnqG80jqeClZtRXXOh',
    '6cnp4HcPmDE9KRm3LAsG': 'zPTnqG80jqeClZtRXXOh',
    'DKrOWn7dfutHJsbgtOP7': 'zPTnqG80jqeClZtRXXOh',
    'EarvmCeEDnoBQFADEiMY': 'zPTnqG80jqeClZtRXXOh',
    '4ZP825755fjBhM8Ku2k5': 'zPTnqG80jqeClZtRXXOh',
    '669XsQaM1KbySALDY13h': 'zPTnqG80jqeClZtRXXOh',

    // DOURA — all variants
    'Gh5xTNdCRAYL47ZRCPgC': 'yehe4gkz6bD6XbxofAXU',
    '945iCqjkQGZJ3qEvdZg8': 'yehe4gkz6bD6XbxofAXU',
    'FDpQsjimx20bWQyhVKhb': 'yehe4gkz6bD6XbxofAXU',
    'J8QJQgK8Qkr9Sfyzhg6M': 'yehe4gkz6bD6XbxofAXU',

    // THAJWEED
    'AAepbPj7Llmhm67Th4ML': 'g9P8vGMSRy0cYdUcoFr3',

    // SARF (AJNAS)
    'M3TalRQDW5DUTEwplHS3': 'rYDaCyK2vLsj8LxMMI6a', // SARF → SARF (not SARF AJNAS)
    '2a6makFhlDyCRa90FMeN': 'js77i63e9gYAwSj4we6z', // SARF (AJNAS)

    // MOTIVATION
    '8E9XVxkbo11sDKpLvaT5': 'k3syQ8J209hZJ0rHDgqn',

    // URDU → correct URDU (not URDU BASICS)
    '20hGruyLHQSAeqIcie5a': 'ydchkXBm7GouzmRN4Ksc', // URDU → URDU
    'SumCyUAGD3BlU00sUnX2': 'ydchkXBm7GouzmRN4Ksc', // URDU → URDU

    // ENGLISH (D classes) → xd6INM4khNcQM4PHVehF (not L2k1)
    'GW0CyD9buC4kQZFoDRq0': 'xd6INM4khNcQM4PHVehF',
    'STS8GX5LIfWcOKWG2iN7': 'xd6INM4khNcQM4PHVehF',

    // IT → It subject (vkGSpLNgUWoLu4tOKkbK)
    'dTxBOL1D4t7nnjGpTbV6': 'vkGSpLNgUWoLu4tOKkbK',

    // ARABIC (HS class) → c36I4lMYbFsEbfnXggbB
    'CCCg6g31DlwK7WgbmPJL': 'c36I4lMYbFsEbfnXggbB',

    // THAFSEER — map to THAFSEER (not NASAFI unless it's D3)
    '3y4xZzW4qYkACgmJ0AjM': 'gRGZIOuy0XDiiy5d2z2i', // THAFSEER
    '2Ts9ogW7nfh3dd83pBY1': 'gRGZIOuy0XDiiy5d2z2i', // THAFSEER

    // HADEETH
    'GvfbiwbXkn6lwxx9Gr8T': 'qkAnwPrMQmLt9mYOdizC', // HADEETH → Hadeeth
};

async function fixBothSubjects() {
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const liveSubjects = subjectsSnap.docs.map(d => ({ id: d.id, _ref: d.ref, ...d.data() }));

    // Step 1: Build set of live subject IDs that appear in backup Odd marks
    console.log('=== BUILDING ODD SEMESTER SUBJECT SET FROM BACKUP ===\n');
    const oddLiveSubIds = new Set();

    backupStudents.forEach(st => {
        const oddMarks = st.academicHistory?.['2025-2026-Odd']?.marks || {};
        Object.keys(oddMarks).forEach(backupId => {
            const liveId = MANUAL_MAPPING[backupId] || backupId;
            if (liveId && liveSubjects.find(s => s.id === liveId)) {
                oddLiveSubIds.add(liveId);
            }
        });
    });

    console.log(`Unique live subject IDs in backup Odd marks: ${oddLiveSubIds.size}`);
    console.log(Array.from(oddLiveSubIds).join('\n'));

    // Step 2: Categorize all 'Both' subjects
    console.log('\n=== RESOLVING "Both" SUBJECTS ===\n');
    const updates = [];

    liveSubjects.forEach(sub => {
        if (sub.activeSemester !== 'Both') return; // Only touch 'Both' subjects

        const isInOdd = oddLiveSubIds.has(sub.id);
        const newSemester = isInOdd ? 'Odd' : 'Even';

        console.log(`${isInOdd ? '[ODD ]' : '[EVEN]'} [${sub.id}] "${sub.name}" classes=[${(sub.targetClasses||[]).join(',')}] → was "Both" → now "${newSemester}"`);
        updates.push({ ref: sub._ref, id: sub.id, name: sub.name, newSemester });
    });

    console.log(`\n${updates.length} "Both" subjects to update.`);
    const toOdd  = updates.filter(u => u.newSemester === 'Odd').length;
    const toEven = updates.filter(u => u.newSemester === 'Even').length;
    console.log(`  → ${toOdd} will be set to Odd`);
    console.log(`  → ${toEven} will be set to Even`);

    // Step 3: Execute updates
    console.log('\nExecuting...\n');
    for (const u of updates) {
        await updateDoc(u.ref, { activeSemester: u.newSemester });
        console.log(`✅ [${u.id}] "${u.name}" → activeSemester: "${u.newSemester}"`);
    }

    console.log(`\n\n✅ Done. All "Both" subjects resolved to strict Odd/Even.`);
    console.log(`   Odd: ${toOdd} | Even: ${toEven} | Unchanged: ${liveSubjects.length - updates.length}`);
}

fixBothSubjects().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
