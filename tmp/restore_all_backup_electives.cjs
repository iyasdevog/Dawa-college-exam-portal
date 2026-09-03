const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch, doc } = require('firebase/firestore');

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

async function restoreAllBackupElectives() {
    console.log('\n=== INSPECTING AND RESTORING ALL ELECTIVE MARKS FROM MASTER BACKUP ===\n');

    // 1. Load Backup File
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const backupStudents = backupData.students || [];
    const backupSubjects = backupData.subjects || [];
    const backupSubjectMap = new Map(backupSubjects.map(s => [s.id, s]));

    // Fetch live data
    const liveStudentsSnap = await getDocs(collection(db, 'students'));
    const liveStudents = liveStudentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    const liveSubjectsSnap = await getDocs(collection(db, 'subjects'));
    const liveSubjects = liveSubjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    const liveSubjectMap = new Map(liveSubjects.map(s => [s.id, s]));

    // Map backup students by adNo
    const backupByAdNo = new Map(backupStudents.map(s => [String(s.adNo).trim(), s]));

    let restoredElectiveMarksCount = 0;
    let updatedStudentsCount = 0;
    const batch = writeBatch(db);

    liveStudents.forEach(st => {
        const adNoKey = String(st.adNo).trim();
        const bkSt = backupByAdNo.get(adNoKey);
        if (!bkSt) return;

        const bkHist = bkSt.academicHistory ? (bkSt.academicHistory['2025-2026-Odd'] || bkSt.academicHistory['2025-2026-Odd']) : null;
        const bkMarks = bkHist?.marks || bkSt.marks || {};
        const bkMeta = bkHist?.subjectMetadata || bkSt.subjectMetadata || {};

        const liveHist = st.academicHistory ? st.academicHistory['2025-2026-Odd'] : null;
        if (!liveHist) return;

        let liveMarks = { ...(liveHist.marks || {}) };
        let liveMeta = { ...(liveHist.subjectMetadata || {}) };
        let modified = false;

        Object.entries(bkMarks).forEach(([subId, bMark]) => {
            const catSub = backupSubjectMap.get(subId);
            const metaSub = bkMeta[subId];
            const type = catSub?.subjectType || metaSub?.subjectType || 'general';

            if (type === 'elective') {
                const subName = (catSub?.name || metaSub?.name || subId).trim();
                const normName = subName.toLowerCase();

                // Check if live student has a mark for this elective
                const hasLiveElectiveMark = Object.keys(liveMarks).some(lk => {
                    const lSub = liveSubjectMap.get(lk);
                    const lMeta = liveMeta[lk];
                    const lName = (lSub?.name || lMeta?.name || lk).trim().toLowerCase();
                    const lType = lSub?.subjectType || lMeta?.subjectType || 'general';
                    return (lk === subId || lName === normName) && lType === 'elective';
                });

                if (!hasLiveElectiveMark && bMark && (bMark.total > 0 || bMark.int !== undefined || bMark.ext !== undefined)) {
                    console.log(`  + Restoring missing Elective "${subName}" [${subId}] for "${st.name}" (AdNo: ${st.adNo}, Class: ${liveHist.className}) | total: ${bMark.total}`);
                    
                    liveMarks[subId] = {
                        int: bMark.int !== undefined ? Number(bMark.int) : (Number(bMark.ce) || 0),
                        ext: bMark.ext !== undefined ? Number(bMark.ext) : (Number(bMark.ta) || 0),
                        total: Number(bMark.total) || 0,
                        status: bMark.status || 'Passed'
                    };

                    if (catSub || metaSub) {
                        liveMeta[subId] = {
                            name: catSub?.name || metaSub?.name || subName,
                            arabicName: catSub?.arabicName || metaSub?.arabicName || '',
                            maxEXT: catSub?.maxEXT ?? metaSub?.maxEXT ?? 70,
                            maxINT: catSub?.maxINT ?? metaSub?.maxINT ?? 30,
                            passingTotal: catSub?.passingTotal ?? metaSub?.passingTotal ?? 40,
                            subjectType: 'elective'
                        };
                    }

                    modified = true;
                    restoredElectiveMarksCount++;
                }
            }
        });

        if (modified) {
            liveHist.marks = liveMarks;
            liveHist.subjectMetadata = liveMeta;
            const updatedHistory = {
                ...st.academicHistory,
                '2025-2026-Odd': liveHist
            };

            const docRef = doc(db, 'students', st.id);
            batch.update(docRef, { academicHistory: updatedHistory });
            updatedStudentsCount++;
        }
    });

    console.log(`\nTotal restored missing elective marks: ${restoredElectiveMarksCount}`);

    if (updatedStudentsCount > 0) {
        await batch.commit();
        console.log(`✅ Successfully committed missing elective marks for ${updatedStudentsCount} students to Firestore!`);
    } else {
        console.log('No missing elective marks were found to restore.');
    }
}

restoreAllBackupElectives().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
