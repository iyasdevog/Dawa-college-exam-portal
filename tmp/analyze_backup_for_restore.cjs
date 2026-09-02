const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

async function analyze() {
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const liveSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const studentsSnap = await getDocs(collection(db, 'students'));
    const liveStudents = studentsSnap.docs.map(d => ({ _docId: d.id, ...d.data() }));

    console.log('=== BACKUP vs LIVE CATALOG SUBJECT ID MAPPING ===\n');
    console.log(`Backup subjects: ${backupSubjects.length}`);
    console.log(`Live subjects:   ${liveSubjects.length}\n`);

    // Collect all subject IDs used in backup Odd marks
    const backupOddSubIds = new Set();
    const backupStudentCount = { withOdd: 0, withEven: 0, total: backupStudents.length };
    backupStudents.forEach(st => {
        const oddMarks = st.academicHistory?.['2025-2026-Odd']?.marks || {};
        const evenMarks = st.academicHistory?.['2025-2026-Even']?.marks || {};
        if (Object.keys(oddMarks).length > 0) backupStudentCount.withOdd++;
        if (Object.keys(evenMarks).length > 0) backupStudentCount.withEven++;
        Object.keys(oddMarks).forEach(k => backupOddSubIds.add(k));
    });

    console.log(`Backup students: ${backupStudentCount.total}`);
    console.log(`  With 2025-2026-Odd marks: ${backupStudentCount.withOdd}`);
    console.log(`  With 2025-2026-Even marks: ${backupStudentCount.withEven}`);
    console.log(`Unique subject IDs in backup Odd marks: ${backupOddSubIds.size}\n`);

    // Map each backup subject ID to live catalog
    console.log('=== SUBJECT ID MAPPING (backup → live) ===\n');
    const mapping = {}; // backupId → liveId (or null if unmapped)
    const unmapped = [];

    backupOddSubIds.forEach(backupId => {
        // Already in live catalog
        if (liveSubjects.find(s => s.id === backupId)) {
            mapping[backupId] = backupId; // same ID, no mapping needed
            console.log(`✅ SAME    [${backupId}] → already in live catalog`);
            return;
        }
        // In backup subjects list
        const bkSub = backupSubjects.find(s => s.id === backupId);
        if (!bkSub) {
            mapping[backupId] = null;
            unmapped.push({ id: backupId, name: 'UNKNOWN (not in backup subjects list)' });
            console.log(`❌ UNKNOWN [${backupId}] → not in backup subjects list`);
            return;
        }
        // Find by name match in live catalog
        const nameNorm = bkSub.name?.trim().toLowerCase();
        const liveSub = liveSubjects.find(s =>
            s.name?.trim().toLowerCase() === nameNorm ||
            s.name?.trim().toLowerCase().includes(nameNorm) ||
            nameNorm.includes(s.name?.trim().toLowerCase())
        );
        if (liveSub) {
            mapping[backupId] = liveSub.id;
            console.log(`🔄 MAPPED  [${backupId}] "${bkSub.name}" → [${liveSub.id}] "${liveSub.name}"`);
        } else {
            mapping[backupId] = null;
            unmapped.push({ id: backupId, name: bkSub.name });
            console.log(`❌ NO MATCH [${backupId}] "${bkSub.name}" → NO LIVE MATCH FOUND`);
        }
    });

    if (unmapped.length > 0) {
        console.log(`\n⚠️  ${unmapped.length} UNMAPPED subject IDs (these marks will be skipped in restore):`);
        unmapped.forEach(u => console.log(`   [${u.id}] "${u.name}"`));
    }

    // Live catalog semester analysis
    console.log('\n\n=== LIVE CATALOG SEMESTER TAGS ===\n');
    const oddSubs = liveSubjects.filter(s => s.activeSemester === 'Odd');
    const evenSubs = liveSubjects.filter(s => s.activeSemester === 'Even');
    const bothSubs = liveSubjects.filter(s => s.activeSemester === 'Both');
    console.log(`Odd only:  ${oddSubs.length}`);
    console.log(`Even only: ${evenSubs.length}`);
    console.log(`Both:      ${bothSubs.length}`);

    if (bothSubs.length > 0) {
        console.log('\n"Both" subjects (may bleed between semesters):');
        bothSubs.forEach(s => console.log(`  [${s.id}] "${s.name}" | classes=[${(s.targetClasses||[]).join(',')}]`));
    }

    // Live DB: what terms exist right now
    console.log('\n\n=== CURRENT DB TERM COVERAGE ===\n');
    const termCounts = {};
    liveStudents.forEach(st => {
        const hist = st.academicHistory || {};
        Object.keys(hist).forEach(t => {
            const markCount = Object.keys(hist[t]?.marks || {}).length;
            if (!termCounts[t]) termCounts[t] = { students: 0, withMarks: 0 };
            termCounts[t].students++;
            if (markCount > 0) termCounts[t].withMarks++;
        });
        // Check legacy fields
        if (st.marks && Object.keys(st.marks).length > 0) {
            if (!termCounts['LEGACY_TOP_LEVEL']) termCounts['LEGACY_TOP_LEVEL'] = { students: 0, withMarks: 0 };
            termCounts['LEGACY_TOP_LEVEL'].students++;
            termCounts['LEGACY_TOP_LEVEL'].withMarks++;
        }
    });
    Object.entries(termCounts).sort().forEach(([t, c]) => {
        console.log(`  "${t}": ${c.students} students, ${c.withMarks} with marks`);
    });

    // Save mapping to file
    fs.writeFileSync(path.join(__dirname, 'subject_id_mapping.json'), JSON.stringify({ mapping, unmapped }, null, 2));
    console.log('\n\nMapping saved to tmp/subject_id_mapping.json');
    console.log(`\nSummary:`);
    const mapped = Object.values(mapping).filter(v => v !== null).length;
    const same   = Object.entries(mapping).filter(([k,v]) => k === v).length;
    console.log(`  ${same} IDs same in backup & live`);
    console.log(`  ${mapped - same} IDs remapped by name`);
    console.log(`  ${unmapped.length} IDs unmapped (unknown subjects)`);
}

analyze().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
