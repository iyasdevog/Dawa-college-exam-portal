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

function normalizeSubjectName(name) {
    if (!name) return '';
    return name.toString().trim().toLowerCase()
        .replace(/['"’`]/g, '')
        .replace(/[^a-z0-9\u0600-\u06FF\s]/gi, ' ')
        .replace(/\s+/g, ' ');
}

function getMarkForSubject(marksObj, subject, metadataObj) {
    if (!marksObj || !subject) return undefined;
    if (marksObj[subject.id] !== undefined) return marksObj[subject.id];

    const sId = (subject.id || '').toLowerCase().trim();
    if (sId) {
        const idKey = Object.keys(marksObj).find(k => k.toLowerCase().trim() === sId);
        if (idKey) return marksObj[idKey];
    }

    const sNameNorm = normalizeSubjectName(subject.name || '');
    const sArabicNorm = normalizeSubjectName(subject.arabicName || '');

    const foundKey = Object.keys(marksObj).find(k => {
        const kNorm = normalizeSubjectName(k);
        if (sNameNorm && kNorm === sNameNorm) return true;
        if (sArabicNorm && kNorm === sArabicNorm) return true;

        const snap = metadataObj?.[k];
        if (snap) {
            const snapNameNorm = normalizeSubjectName(snap.name || '');
            const snapArabicNorm = normalizeSubjectName(snap.arabicName || '');
            if (sNameNorm && snapNameNorm === sNameNorm) return true;
            if (sArabicNorm && snapArabicNorm === sArabicNorm) return true;
        }

        return false;
    });

    if (foundKey) return marksObj[foundKey];
    return undefined;
}

async function auditEnglishAcrossAllClasses() {
    console.log('\n=== AUDITING ENGLISH SUBJECT & MARKS ACROSS ALL 8 CLASSES (2025-2026-Odd) ===\n');

    // 1. Master Backup English Audit
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const backupStudents = backupData.students || [];
    const backupSubjects = backupData.subjects || [];

    console.log('--- MASTER BACKUP: ENGLISH SUBJECTS CATALOG ---');
    const backupEngSubs = backupSubjects.filter(s => (s.name || '').toLowerCase().includes('english'));
    backupEngSubs.forEach(s => {
        console.log(`  - [${s.id}] "${s.name}" | type: "${s.subjectType}" | activeSem: "${s.activeSemester}" | targets: [${(s.targetClasses||[]).join(',')}]`);
    });

    // 2. Live Firestore English Audit
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const liveSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    
    console.log('\n--- LIVE FIRESTORE: ENGLISH SUBJECTS CATALOG ---');
    const liveEngSubs = liveSubjects.filter(s => (s.name || '').toLowerCase().includes('english'));
    liveEngSubs.forEach(s => {
        console.log(`  - [${s.id}] "${s.name}" | type: "${s.subjectType}" | year: "${s.academicYear}" | sem: "${s.activeSemester}" | targets: [${(s.targetClasses||[]).join(',')}]`);
    });

    const studentsSnap = await getDocs(collection(db, 'students'));
    const liveStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const classes = ['S1', 'S2', 'P1', 'P2', 'D1', 'D2', 'D3', 'PG-F'];

    console.log('\n--- ENGLISH MARKS PER CLASS IN LIVE FIRESTORE (2025-2026-Odd) ---');

    for (const className of classes) {
        const classStudents = liveStudents.filter(s => {
            const hist = s.academicHistory ? s.academicHistory['2025-2026-Odd'] : null;
            return hist && hist.className && hist.className.trim().toLowerCase() === className.toLowerCase();
        });

        // Check which English subjects target this class
        const targetEngSubs = liveEngSubs.filter(s => (s.targetClasses || []).includes(className) && s.activeSemester !== 'Even');

        console.log(`\n==================================================`);
        console.log(`CLASS: ${className} (${classStudents.length} students)`);
        console.log(`English Catalog Targets for ${className}: ${targetEngSubs.map(s => `[${s.id}] "${s.name}" (${s.subjectType})`).join(', ') || 'NONE'}`);

        targetEngSubs.forEach(engSub => {
            let filledCount = 0;
            classStudents.forEach(st => {
                const hist = st.academicHistory['2025-2026-Odd'];
                const mark = getMarkForSubject(hist.marks, engSub, hist.subjectMetadata);
                if (mark && !mark.isSupplementary && (mark.total > 0 || mark.int !== undefined || mark.ext !== undefined)) {
                    filledCount++;
                }
            });

            console.log(`  -> Subject [${engSub.id}] "${engSub.name}" (${engSub.subjectType}): Filled ${filledCount}/${classStudents.length} students`);
        });

        // Also check if students have ANY English mark in their marks object regardless of targetClasses
        let studentsWithAnyEnglishMark = 0;
        classStudents.forEach(st => {
            const hist = st.academicHistory['2025-2026-Odd'];
            const marksObj = hist.marks || {};
            const metaObj = hist.subjectMetadata || {};

            const hasAnyEng = Object.entries(marksObj).some(([subId, mark]) => {
                if (mark.isSupplementary) return false;
                const catSub = liveSubjects.find(s => s.id === subId);
                const metaSub = metaObj[subId];
                const name = catSub?.name || metaSub?.name || subId;
                return name.toLowerCase().includes('english') && (mark.total > 0 || mark.int !== undefined || mark.ext !== undefined);
            });

            if (hasAnyEng) studentsWithAnyEnglishMark++;
        });

        console.log(`  -> Total Students with ANY English mark in student record: ${studentsWithAnyEnglishMark}/${classStudents.length}`);
    }
}

auditEnglishAcrossAllClasses().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
