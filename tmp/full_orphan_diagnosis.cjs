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

async function diagnose() {
    console.log('=== FULL ORPHAN DIAGNOSIS (ALL STUDENTS) ===\n');

    // 1. Get canonical subjects
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjectById = new Map();
    subjectsSnap.docs.forEach(d => subjectById.set(d.id, d.data()));

    const validIds = new Set(subjectById.keys());
    console.log(`Canonical subject IDs (${validIds.size}): ${[...validIds].join(', ')}\n`);

    // 2. Scan all students
    const studentsSnap = await getDocs(collection(db, 'students'));
    console.log(`Total students: ${studentsSnap.docs.length}\n`);

    // Show class distribution
    const classCounts = {};
    studentsSnap.docs.forEach(d => {
        const data = d.data();
        const cls = data.className || data.currentClass || 'UNKNOWN';
        classCounts[cls] = (classCounts[cls] || 0) + 1;
    });
    console.log('Class distribution:');
    Object.entries(classCounts).sort().forEach(([c, n]) => console.log(`  ${c}: ${n} students`));

    // 3. Find all orphaned mark keys across ALL students
    const orphanedKeys = new Map(); // orphanId -> { count, sample_name, sample_total }
    let totalStudentsWithOrphans = 0;
    let totalOrphanedEntries = 0;

    studentsSnap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const history = data.academicHistory || {};
        let hasOrphan = false;

        Object.keys(history).forEach(termKey => {
            const marks = history[termKey]?.marks || {};
            Object.keys(marks).forEach(subId => {
                if (!validIds.has(subId)) {
                    hasOrphan = true;
                    totalOrphanedEntries++;
                    if (!orphanedKeys.has(subId)) {
                        orphanedKeys.set(subId, { count: 0, samples: [] });
                    }
                    const entry = orphanedKeys.get(subId);
                    entry.count++;
                    if (entry.samples.length < 3) {
                        entry.samples.push(`${data.adNo} (${data.className}): total=${marks[subId]?.total ?? '?'}`);
                    }
                }
            });
        });

        if (hasOrphan) totalStudentsWithOrphans++;
    });

    console.log(`\n=== ORPHANED MARK ANALYSIS ===`);
    console.log(`Students with orphaned mark keys: ${totalStudentsWithOrphans}`);
    console.log(`Total orphaned mark entries: ${totalOrphanedEntries}`);
    console.log(`Unique orphaned subject IDs: ${orphanedKeys.size}`);

    if (orphanedKeys.size > 0) {
        console.log('\nOrphaned subject IDs (with count and samples):');
        orphanedKeys.forEach((info, orphanId) => {
            console.log(`  ID: "${orphanId}" | referenced by ${info.count} students`);
            info.samples.forEach(s => console.log(`       -> ${s}`));
        });
    } else {
        console.log('\n✅ NO ORPHANED MARKS FOUND! All student mark keys point to valid subjects.');
        
        // Show sample marks from a few students to understand the data
        console.log('\nSample student marks (first 3):');
        studentsSnap.docs.slice(0, 3).forEach(docSnap => {
            const data = docSnap.data();
            console.log(`\n  ${data.adNo} - ${data.name} (${data.className})`);
            const history = data.academicHistory || {};
            Object.keys(history).slice(0, 2).forEach(termKey => {
                const marks = history[termKey]?.marks || {};
                const markKeys = Object.keys(marks);
                console.log(`  Term: ${termKey} | ${markKeys.length} marks`);
                markKeys.slice(0, 5).forEach(k => {
                    const subName = subjectById.has(k) ? subjectById.get(k).name : '???';
                    console.log(`    [${k}] "${subName}" = ${marks[k]?.total ?? '?'}`);
                });
            });
        });
    }
}

diagnose().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
