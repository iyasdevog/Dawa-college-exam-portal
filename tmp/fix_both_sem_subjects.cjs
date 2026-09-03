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

async function fixBothSemSubjects() {
    console.log('\n=== FIXING "BOTH SEM" SUBJECTS → Even + 2025-2026 ===\n');

    const snap = await getDocs(collection(db, 'subjects'));
    const subjects = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    // All subjects with activeSemester='Both' AND no academicYear set → Even + 2025-2026
    const bothNoYear = subjects.filter(s => s.activeSemester === 'Both' && (!s.academicYear || s.academicYear === ''));

    console.log(`Found ${bothNoYear.length} subjects tagged 'Both' with no academicYear.`);
    console.log('These will be updated to: activeSemester=Even, academicYear=2025-2026\n');

    // Preview first 5
    bothNoYear.slice(0, 5).forEach(s => {
        console.log(`  Preview: "${s.name}" [${(s.targetClasses||[]).join(',')}]`);
    });
    if (bothNoYear.length > 5) console.log(`  ... and ${bothNoYear.length - 5} more`);

    // Write in batches of 500 (Firestore limit)
    const BATCH_SIZE = 499;
    let totalUpdated = 0;

    for (let i = 0; i < bothNoYear.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const chunk = bothNoYear.slice(i, i + BATCH_SIZE);

        chunk.forEach(s => {
            const ref = doc(db, 'subjects', s.id);
            batch.update(ref, {
                activeSemester: 'Even',
                academicYear: '2025-2026'
            });
        });

        await batch.commit();
        totalUpdated += chunk.length;
        console.log(`Batch ${Math.ceil((i + 1) / BATCH_SIZE)}: Updated ${totalUpdated}/${bothNoYear.length} subjects`);
    }

    console.log(`\n✅ Done! Updated ${totalUpdated} subjects to activeSemester=Even, academicYear=2025-2026`);

    // Verify result
    const verifySnap = await getDocs(collection(db, 'subjects'));
    const verifySubjects = verifySnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const byYear = {};
    verifySubjects.forEach(s => {
        const year = s.academicYear || 'UNSET';
        const sem = s.activeSemester || 'UNSET';
        if (!byYear[year]) byYear[year] = { Odd: 0, Even: 0, Both: 0, unset: 0 };
        if (sem === 'Odd') byYear[year].Odd++;
        else if (sem === 'Even') byYear[year].Even++;
        else if (sem === 'Both') byYear[year].Both++;
        else byYear[year].unset++;
    });

    console.log('\nFinal breakdown after fix:');
    console.dir(byYear, { depth: null });

    // Final simulation
    const terms = ['2025-2026-Odd', '2025-2026-Even', '2026-2027-Odd'];
    console.log('\nSimulated getAllSubjects() after fix:');
    for (const termKey of terms) {
        const lastHyphenIndex = termKey.lastIndexOf('-');
        const targetYear = termKey.substring(0, lastHyphenIndex);
        const targetSem = termKey.substring(lastHyphenIndex + 1);

        const result = verifySubjects.filter(s => {
            const subjectYear = s.academicYear;
            if (subjectYear && subjectYear !== 'All' && targetYear && subjectYear !== targetYear) return false;
            if (!s.activeSemester || s.activeSemester === 'Both') return true;
            return s.activeSemester === targetSem;
        });

        const bothCount = result.filter(s => s.activeSemester === 'Both' || !s.activeSemester).length;
        console.log(`  "${termKey}": ${result.length} subjects (${bothCount} still Both/unset)`);
    }
}

fixBothSemSubjects().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
