const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');
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

async function inspectBasicEnglish() {
    console.log('=== INSPECTING BASIC ENGLISH SUBJECTS & MARKS ===\n');

    // 1. Check all subject docs with 'English' or 'Basic English' in name
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const englishSubjects = [];
    subjectsSnap.docs.forEach(d => {
        const sub = d.data();
        if ((sub.name || '').toLowerCase().includes('english')) {
            englishSubjects.push({ id: d.id, ...sub });
        }
    });

    console.log(`Found ${englishSubjects.length} English-related subjects in Firestore:`);
    englishSubjects.forEach(s => {
        console.log(`  ID: ${s.id} | Name: "${s.name}" | activeSemester: ${s.activeSemester} | targetClasses:`, s.targetClasses);
    });

    // 2. Check Master Backup for Basic English
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const bkEnglishSubjects = (backup.subjects || []).filter(s => (s.name || '').toLowerCase().includes('english'));
    console.log(`\nFound ${bkEnglishSubjects.length} English-related subjects in Master Backup:`);
    bkEnglishSubjects.forEach(s => {
        console.log(`  ID: ${s.id} | Name: "${s.name}" | activeSemester: ${s.activeSemester} | targetClasses:`, s.targetClasses);
    });

    // 3. Search all student marks in Firestore for any English/Basic English subject ID
    const studentsSnap = await getDocs(collection(db, 'students'));
    const englishSubjectIds = new Set([
        ...englishSubjects.map(s => s.id),
        ...bkEnglishSubjects.map(s => s.id)
    ]);

    console.log(`\nSearching student marks for subject IDs: ${[...englishSubjectIds].join(', ')}`);

    const markBreakdown = {}; // subId -> { oddCount, evenCount, classes: Set }

    studentsSnap.docs.forEach(d => {
        const student = d.data();
        const cls = student.className || student.currentClass || 'UNKNOWN';
        const history = student.academicHistory || {};

        ['2025-2026-Odd', '2025-2026-Even'].forEach(termKey => {
            const marks = history[termKey]?.marks || {};
            Object.keys(marks).forEach(subId => {
                if (englishSubjectIds.has(subId) || Object.values(englishSubjects).some(s => s.id === subId)) {
                    if (!markBreakdown[subId]) {
                        markBreakdown[subId] = { oddCount: 0, evenCount: 0, classes: new Set() };
                    }
                    if (termKey === '2025-2026-Odd') markBreakdown[subId].oddCount++;
                    if (termKey === '2025-2026-Even') markBreakdown[subId].evenCount++;
                    markBreakdown[subId].classes.add(cls);
                }
            });
        });
    });

    console.log('\nMarks breakdown by English Subject ID:');
    Object.entries(markBreakdown).forEach(([subId, data]) => {
        const liveSub = englishSubjects.find(s => s.id === subId);
        const bkSub = bkEnglishSubjects.find(s => s.id === subId);
        const name = liveSub?.name || bkSub?.name || 'UNKNOWN';
        console.log(`  SubID: ${subId} ("${name}"):`);
        console.log(`    2025-2026-Odd Marks: ${data.oddCount}`);
        console.log(`    2025-2026-Even Marks: ${data.evenCount}`);
        console.log(`    Classes affected: ${[...data.classes].join(', ')}`);
    });

    // 4. Also check Master Backup for student marks under Basic English
    const bkMarkBreakdown = {};
    (backup.students || []).forEach(st => {
        const history = st.academicHistory || {};
        ['2025-2026-Odd', '2025-2026-Even'].forEach(termKey => {
            const marks = history[termKey]?.marks || {};
            Object.keys(marks).forEach(subId => {
                if (englishSubjectIds.has(subId)) {
                    if (!bkMarkBreakdown[subId]) bkMarkBreakdown[subId] = { oddCount: 0, evenCount: 0 };
                    if (termKey === '2025-2026-Odd') bkMarkBreakdown[subId].oddCount++;
                    if (termKey === '2025-2026-Even') bkMarkBreakdown[subId].evenCount++;
                }
            });
        });
    });

    console.log('\nMaster Backup Marks breakdown by English Subject ID:');
    Object.entries(bkMarkBreakdown).forEach(([subId, data]) => {
        const bkSub = bkEnglishSubjects.find(s => s.id === subId);
        console.log(`  SubID: ${subId} ("${bkSub?.name}"): Odd=${data.oddCount}, Even=${data.evenCount}`);
    });
}

inspectBasicEnglish().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
