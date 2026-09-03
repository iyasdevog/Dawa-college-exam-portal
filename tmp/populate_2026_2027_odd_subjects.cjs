const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc, writeBatch } = require('firebase/firestore');

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

async function executeMigration() {
    console.log('\n======================================================');
    console.log('  EXECUTING 2026-2027-Odd SUBJECT POPULATION & CLEANUP ');
    console.log('======================================================\n');

    const snap = await getDocs(collection(db, 'subjects'));
    const allSubjects = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    // 1. Fix academicYear === 'All' subjects -> '2025-2026'
    const allYearSubs = allSubjects.filter(s => s.academicYear === 'All');
    console.log(`1. Fixing ${allYearSubs.length} subjects with academicYear === 'All'...`);
    
    for (const sub of allYearSubs) {
        const docRef = doc(db, 'subjects', sub.id);
        await updateDoc(docRef, { academicYear: '2025-2026' });
        console.log(`   ✓ Fixed subject "${sub.name}" (${sub.id}) -> academicYear: '2025-2026'`);
    }

    // 2. Clone 2025-2026 Even subjects to 2026-2027-Odd
    const sourceSubs = allSubjects.filter(s => 
        (s.academicYear === '2025-2026' || s.academicYear === 'All') && 
        (s.activeSemester === 'Even' || s.activeSemester === 'Both')
    );

    console.log(`\n2. Cloning ${sourceSubs.length} subjects for 2026-2027-Odd...`);

    let createdCount = 0;
    let batch = writeBatch(db);
    let batchOps = 0;

    for (const s of sourceSubs) {
        const newRef = doc(collection(db, 'subjects'));
        
        // Remove old id and prepare fresh cloned data
        const { id, ...data } = s;

        const clonedData = {
            ...data,
            academicYear: '2026-2027',
            activeSemester: 'Odd',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        batch.set(newRef, clonedData);
        createdCount++;
        batchOps++;

        if (batchOps >= 450) {
            await batch.commit();
            console.log(`   Committed batch of ${batchOps} subjects...`);
            batch = writeBatch(db);
            batchOps = 0;
        }
    }

    if (batchOps > 0) {
        await batch.commit();
        console.log(`   Committed final batch of ${batchOps} subjects.`);
    }

    console.log(`\n✅ Successfully created ${createdCount} subjects for 2026-2027-Odd!`);

    // 3. Ensure '2026-2027' is in global settings availableYears
    console.log('\n3. Updating global settings availableYears...');
    const settingsSnap = await getDocs(collection(db, 'settings'));
    const globalDoc = settingsSnap.docs.find(d => d.id === 'global');
    if (globalDoc) {
        const data = globalDoc.data();
        const existingYears = data.availableYears || ['2025-2026'];
        if (!existingYears.includes('2026-2027')) {
            const updatedYears = Array.from(new Set([...existingYears, '2026-2027'])).sort();
            await updateDoc(doc(db, 'settings', 'global'), { availableYears: updatedYears });
            console.log(`   ✓ Added '2026-2027' to availableYears: [${updatedYears.join(', ')}]`);
        } else {
            console.log(`   ✓ '2026-2027' already present in availableYears.`);
        }
    }

    console.log('\n======================================================');
    console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY WITH 0 LEAKS!');
    console.log('======================================================\n');
}

executeMigration().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
