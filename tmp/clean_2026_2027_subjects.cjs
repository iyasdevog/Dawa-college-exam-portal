const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc } = require('firebase/firestore');

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

async function clean20262027Subjects() {
    console.log('\n================================================================');
    console.log('  CLEANING 2026-2027-Odd SUBJECTS FOR NON-EXISTENT CLASSES      ');
    console.log('================================================================\n');

    const invalidClasses = ['S1', 'S2', 'HS3', 'D1', 'P1', 'P2'];

    const snap = await getDocs(collection(db, 'subjects'));
    const allSubjects = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    
    // Get 2026-2027-Odd subjects ONLY
    const subs2026 = allSubjects.filter(s => s.academicYear === '2026-2027' && s.activeSemester === 'Odd');

    console.log(`Initial 2026-2027-Odd subjects count: ${subs2026.length}`);

    let deletedCount = 0;
    let updatedCount = 0;

    for (const sub of subs2026) {
        const targets = sub.targetClasses || [];
        const filteredTargets = targets.filter(tc => !invalidClasses.includes(tc));

        if (filteredTargets.length === 0) {
            // Delete subject completely as it only targeted invalid classes
            await deleteDoc(doc(db, 'subjects', sub.id));
            console.log(`  🗑️  DELETED subject "${sub.name}" (${sub.id}) - previously targeted [${targets.join(', ')}]`);
            deletedCount++;
        } else if (filteredTargets.length !== targets.length) {
            // Update subject to remove invalid target classes
            await updateDoc(doc(db, 'subjects', sub.id), {
                targetClasses: filteredTargets
            });
            console.log(`  ✏️  UPDATED subject "${sub.name}" (${sub.id}) - targetClasses: [${targets.join(', ')}] -> [${filteredTargets.join(', ')}]`);
            updatedCount++;
        }
    }

    console.log(`\n✅ Finished cleaning 2026-2027-Odd subjects!`);
    console.log(`   - Subjects deleted: ${deletedCount}`);
    console.log(`   - Subjects updated: ${updatedCount}`);
    console.log(`   - Remaining active subjects in 2026-2027-Odd: ${subs2026.length - deletedCount}`);
}

clean20262027Subjects().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
