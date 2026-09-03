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

async function checkSupplementaryCollection() {
    console.log('\n=== CHECKING SUPPLEMENTARY EXAMS COLLECTION FOR UNMAPPED IDs ===\n');

    const unmappedTargetIds = [
        'CP73DIkL4tGuX8pgH6JU',
        'v1eqpVhe9zwBenNqz5nL',
        'zjfIw4gLzhZUwNgljmsa',
        'qONeFnfq8xP7dXSUlboO',
        'hXwj90u3pLUzQh5pkhcS',
        'kbGr9LuXzpvE3Ws0PiE5',
        'qPqFCSR8H6Gvx9nQbacG',
        'XZ8Sl65cKfzW03J4YhPg'
    ];

    for (const targetId of unmappedTargetIds) {
        const suppDoc = await getDoc(doc(db, 'supplementaryExams', targetId));
        if (suppDoc.exists()) {
            console.log(`FOUND in supplementaryExams collection: id="${targetId}"`);
            console.dir(suppDoc.data(), { depth: null });
        } else {
            console.log(`NOT in supplementaryExams collection: id="${targetId}"`);
        }
    }

    const suppSnap = await getDocs(collection(db, 'supplementaryExams'));
    const allSupps = suppSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`\nTotal items in supplementaryExams collection: ${allSupps.length}`);
    if (allSupps.length > 0) {
        console.log('Sample supplementary exam:', allSupps[0]);
    }
}

checkSupplementaryCollection().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
