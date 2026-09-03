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

async function auditSupplementaryExamsCollection() {
    console.log('\n=== AUDITING SUPPLEMENTARY EXAMS COLLECTION ===\n');

    const snap = await getDocs(collection(db, 'supplementaryExams'));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`Total supplementary exam records in DB: ${items.length}`);

    const termsDist = {};
    items.forEach(it => {
        const term = it.examTerm || it.termKey || 'UNSET';
        termsDist[term] = (termsDist[term] || 0) + 1;
    });

    console.log('\nBreakdown by examTerm / termKey:');
    console.dir(termsDist);

    // Let's inspect sample items
    if (items.length > 0) {
        console.log('\nSample Supplementary Exam Item:');
        console.dir(items[0], { depth: null });
    }
}

auditSupplementaryExamsCollection().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
