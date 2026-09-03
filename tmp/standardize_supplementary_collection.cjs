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

async function standardizeSupplementaryCollection() {
    console.log('\n=== STANDARDIZING ALL SUPPLEMENTARY EXAM RECORDS TO 2025-2026-Odd ===\n');

    const snap = await getDocs(collection(db, 'supplementaryExams'));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`Total supplementary exam records in DB: ${items.length}`);

    let updatedCount = 0;
    const batch = writeBatch(db);

    items.forEach(item => {
        // Enforce term-bound standard: examTerm = '2025-2026-Odd'
        const needsUpdate = item.examTerm !== '2025-2026-Odd' || !item.termKey;
        if (needsUpdate) {
            const docRef = doc(db, 'supplementaryExams', item.id);
            batch.update(docRef, {
                examTerm: '2025-2026-Odd',
                termKey: '2025-2026-Odd',
                originalSemester: 'Odd',
                originalYear: 2025
            });
            updatedCount++;
        }
    });

    if (updatedCount > 0) {
        await batch.commit();
        console.log(`✅ Successfully updated & standardized ${updatedCount} supplementary exam records to 2025-2026-Odd!`);
    } else {
        console.log('All supplementary exam records are already cleanly standardized to 2025-2026-Odd.');
    }
}

standardizeSupplementaryCollection().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
