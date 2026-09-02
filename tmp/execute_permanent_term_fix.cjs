const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, deleteField } = require('firebase/firestore');

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

async function executePermanentTermFix() {
    console.log('=== EXECUTION PHASE: PERMANENT TERM FIX & ELECTIVE RE-MIGRATION ===\n');

    // 1. UPDATE SUBJECT CATALOG ENTRIES
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }));

    const multiTermNames = [
        'manthiq', 'doura', 'fiqh', 'arabic', 'nahv', 'it', 'english',
        'communicative arabic', 'hadeeth', 'balaga', "ma'ani", 'النحو الواضح',
        'basic english', 'communicative english', 'life skills', 'thajweed', 'sarf'
    ];

    let subUpdatedCount = 0;
    for (const s of subjects) {
        const lowerName = (s.name || '').toLowerCase();
        let needsUpdate = false;
        const updates = {};

        // A. Basic English
        if (s.id === 'ZT9XwBTEeSP7rOe2x8ik') {
            updates.subjectType = 'elective';
            updates.activeSemester = 'Both';
            updates.targetClasses = ['FS2', 'S1', 'FS3', 'S2', 'HS2', 'P1'];
            needsUpdate = true;
        }
        // B. Communicative English
        else if (s.id === 't34laHHb8z8OsOGje6fl') {
            updates.subjectType = 'elective';
            updates.activeSemester = 'Both';
            updates.targetClasses = ['FS2', 'S1', 'FS3', 'S2', 'HS2', 'P1'];
            needsUpdate = true;
        }
        // C. General multi-term subjects restored to 'Both'
        else if (multiTermNames.some(m => lowerName.includes(m)) && s.activeSemester !== 'Both') {
            updates.activeSemester = 'Both';
            needsUpdate = true;
        }

        if (needsUpdate) {
            await updateDoc(s.ref, updates);
            subUpdatedCount++;
            console.log(`  Updated Subject [${s.id}] "${s.name}":`, updates);
        }
    }
    console.log(`\n✅ Updated ${subUpdatedCount} subject catalog documents in Firestore.`);

    // 2. RE-MAP FS2 EVEN ENGLISH MARKS TO ENROLLED ELECTIVES
    const basicEng = subjects.find(s => s.id === 'ZT9XwBTEeSP7rOe2x8ik');
    const commEng = subjects.find(s => s.id === 't34laHHb8z8OsOGje6fl');

    const basicEngEnrolled = new Set(basicEng?.enrolledStudents || []);
    const commEngEnrolled = new Set(commEng?.enrolledStudents || []);

    const studentsSnap = await getDocs(collection(db, 'students'));
    const fs2StudentDocs = studentsSnap.docs.filter(d => {
        const data = d.data();
        return (data.className || data.currentClass) === 'FS2';
    });

    console.log(`\nFound ${fs2StudentDocs.length} students in class FS2. Re-mapping Even English marks...`);

    let remappedBasicCount = 0;
    let remappedCommCount = 0;

    for (const docSnap of fs2StudentDocs) {
        const studentData = docSnap.data();
        const history = studentData.academicHistory || {};
        const evenTermData = history['2025-2026-Even'];

        if (evenTermData && evenTermData.marks) {
            const genEngMark = evenTermData.marks['wfsl5eUpE4E6nn0G1oqb']; // Generic English mark

            if (genEngMark) {
                let targetSubId = null;
                let targetSubName = '';

                if (basicEngEnrolled.has(docSnap.id)) {
                    targetSubId = 'ZT9XwBTEeSP7rOe2x8ik'; // Basic English
                    targetSubName = 'Basic English';
                    remappedBasicCount++;
                } else if (commEngEnrolled.has(docSnap.id)) {
                    targetSubId = 't34laHHb8z8OsOGje6fl'; // Communicative English
                    targetSubName = 'Communicative English';
                    remappedCommCount++;
                }

                if (targetSubId) {
                    const newMarks = { ...evenTermData.marks };
                    const newMetadata = { ...(evenTermData.subjectMetadata || {}) };

                    // Move mark to target elective
                    newMarks[targetSubId] = genEngMark;
                    delete newMarks['wfsl5eUpE4E6nn0G1oqb']; // Remove generic mark

                    newMetadata[targetSubId] = {
                        name: targetSubName,
                        arabicName: targetSubName === 'Basic English' ? 'الانجليزية الأساسية' : 'الإنجليزية التواصلية',
                        maxINT: 30,
                        maxEXT: 70,
                        passingTotal: 40,
                        subjectType: 'elective',
                        activeSemester: 'Both'
                    };

                    await updateDoc(docSnap.ref, {
                        [`academicHistory.2025-2026-Even.marks`]: newMarks,
                        [`academicHistory.2025-2026-Even.subjectMetadata`]: newMetadata
                    });

                    console.log(`  Re-mapped [${studentData.adNo}] ${studentData.name} -> ${targetSubName} (Mark Total: ${genEngMark.total})`);
                }
            }
        }
    }

    console.log(`\n✅ FS2 Mark Migration Complete:`);
    console.log(`   - ${remappedBasicCount} students re-mapped to Basic English`);
    console.log(`   - ${remappedCommCount} students re-mapped to Communicative English`);
}

executePermanentTermFix().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
