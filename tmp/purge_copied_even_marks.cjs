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

async function purgeCopiedEvenMarks() {
    console.log('=== EXECUTION: DEDUPLICATING CATALOG & PURGING COPIED EVEN MARKS ===\n');

    // 1. DEDUPLICATE TARGET CLASSES IN FIRESTORE SUBJECT CATALOG
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    let deduplicatedSubjectsCount = 0;

    for (const d of subjectsSnap.docs) {
        const sub = d.data();
        const originalClasses = sub.targetClasses || [];
        const uniqueClasses = Array.from(new Set(originalClasses));

        let needsUpdate = false;
        const updates = {};

        if (originalClasses.length !== uniqueClasses.length) {
            updates.targetClasses = uniqueClasses;
            needsUpdate = true;
        }

        // Expand targetClasses for Basic English & Communicative English
        if (d.id === 'ZT9XwBTEeSP7rOe2x8ik' || d.id === 't34laHHb8z8OsOGje6fl') {
            const fullTargetClasses = Array.from(new Set([
                ...(updates.targetClasses || originalClasses),
                'FS1', 'FS2', 'S1', 'FS3', 'S2', 'HS1', 'HS2', 'P1', 'HS3', 'P2'
            ]));
            updates.targetClasses = fullTargetClasses;
            updates.subjectType = 'elective';
            updates.activeSemester = 'Both';
            needsUpdate = true;
        }

        if (needsUpdate) {
            await updateDoc(d.ref, updates);
            deduplicatedSubjectsCount++;
            console.log(`  Cleaned catalog subject [${d.id}] "${sub.name}":`, updates);
        }
    }
    console.log(`\n✅ Catalog cleanup complete: ${deduplicatedSubjectsCount} subjects updated.`);

    // 2. PURGE COPIED ODD MARKS FROM EVEN SEMESTER FOR FS2 AND FS3
    const studentsSnap = await getDocs(collection(db, 'students'));
    const fs2fs3Docs = studentsSnap.docs.filter(d => {
        const data = d.data();
        const cls = data.className || data.currentClass;
        return ['FS2', 'FS3', 'S1', 'S2'].includes(cls);
    });

    console.log(`\nScanning ${fs2fs3Docs.length} FS2/FS3 student documents for artificially copied Even marks...`);

    let totalPurgedEntries = 0;
    let studentsUpdatedCount = 0;

    for (const docSnap of fs2fs3Docs) {
        const student = docSnap.data();
        const history = student.academicHistory || {};

        const oddMarks = history['2025-2026-Odd']?.marks || {};
        const evenData = history['2025-2026-Even'];

        if (evenData && evenData.marks) {
            const currentEvenMarks = { ...evenData.marks };
            const currentEvenMeta = { ...(evenData.subjectMetadata || {}) };
            let modified = false;

            Object.keys(currentEvenMarks).forEach(subId => {
                const evenMark = currentEvenMarks[subId];
                const oddMark = oddMarks[subId];

                // Check if this mark was artificially copied without a timestamp,
                // OR matches the exact copied total & values from Odd semester
                // UNLESS it is genuine uploaded Doura or Basic/Communicative English
                const isElective = subId === 'ZT9XwBTEeSP7rOe2x8ik' || subId === 't34laHHb8z8OsOGje6fl' || subId === '6gZ0p8rH9re48nlfDaWr' || subId === 'ZJ10NiJMiV8nGZ4qx0g4';
                const isDouraWithTimestamp = subId === 'yehe4gkz6bD6XbxofAXU' && evenMark.updatedAt;

                if (!isElective && !isDouraWithTimestamp) {
                    // Check if mark was artificially copied from Odd
                    if (!evenMark.updatedAt || (oddMark && evenMark.total === oddMark.total && evenMark.int === oddMark.int)) {
                        delete currentEvenMarks[subId];
                        delete currentEvenMeta[subId];
                        modified = true;
                        totalPurgedEntries++;
                    }
                }
            });

            if (modified) {
                // Recalculate totals for Even semester after purging copied marks
                let newTotal = 0;
                let validCount = 0;

                Object.values(currentEvenMarks).forEach((m) => {
                    const subTot = typeof m.total === 'number' ? m.total : ((Number(m.int) || 0) + (Number(m.ext) || 0));
                    newTotal += subTot;
                    if (subTot > 0 || m.int !== undefined || m.ext !== undefined) validCount++;
                });

                const newAvg = validCount > 0 ? Math.round((newTotal / validCount) * 10) / 10 : 0;

                await updateDoc(docSnap.ref, {
                    [`academicHistory.2025-2026-Even.marks`]: currentEvenMarks,
                    [`academicHistory.2025-2026-Even.subjectMetadata`]: currentEvenMeta,
                    [`academicHistory.2025-2026-Even.grandTotal`]: newTotal,
                    [`academicHistory.2025-2026-Even.average`]: newAvg
                });
                studentsUpdatedCount++;
                console.log(`  Cleaned Even marks for Student Adm [${student.adNo}] ${student.name} (Retained ${Object.keys(currentEvenMarks).length} genuine Even marks)`);
            }
        }
    }

    console.log(`\n✅ Purged ${totalPurgedEntries} artificially copied mark entries across ${studentsUpdatedCount} student documents!`);
}

purgeCopiedEvenMarks().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
