const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

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

async function inspectJunaid() {
    console.log('=== INSPECTING JUNAID DOCUMENT IN FIRESTORE ===\n');

    const snap = await getDocs(collection(db, 'students'));
    const junaidDocs = snap.docs
        .map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
        .filter(s => (s.adNo && String(s.adNo).includes('213')) || (s.name && String(s.name).includes('213')) || (s.name && String(s.name).toLowerCase().includes('junaid')) || (s.adNo && String(s.adNo).toLowerCase().includes('junaid')));

    console.log(`Found ${junaidDocs.length} documents matching Junaid / 213:\n`);

    junaidDocs.forEach(d => {
        console.log(`Doc ID: ${d.id}`);
        console.log(`  name: "${d.name}"`);
        console.log(`  adNo: "${d.adNo}"`);
        console.log(`  className: "${d.className}"`);
        console.log(`  currentClass: "${d.currentClass}"`);
        console.log(`  isDeleted: ${d.isDeleted}`);
        console.log(`  academicHistory keys:`, Object.keys(d.academicHistory || {}));
        Object.keys(d.academicHistory || {}).forEach(tk => {
            const marks = d.academicHistory[tk]?.marks || {};
            console.log(`    Term ${tk} (${Object.keys(marks).length} marks):`);
            Object.keys(marks).forEach(subId => {
                console.log(`      [${subId}] = ${marks[subId]?.total}`);
            });
        });
        console.log('');
    });
}

inspectJunaid().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
