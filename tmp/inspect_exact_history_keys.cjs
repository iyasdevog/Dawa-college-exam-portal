const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal",
    storageBucket: "my-edumark-portal.firebasestorage.app",
    messagingSenderId: "445255012917",
    appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c",
    measurementId: "G-LLMWHDTZ1T"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspectExactHistoryKeys() {
    console.log('\n=== INSPECTING EXACT academicHistory KEYS IN FIRESTORE ===\n');

    const snapshot = await getDocs(collection(db, 'students'));
    const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(s => !s.isDeleted);

    const historyKeysFound = new Set();
    const studentsByTermKey = {};

    students.forEach(s => {
        if (s.academicHistory) {
            Object.keys(s.academicHistory).forEach(k => {
                historyKeysFound.add(k);
                studentsByTermKey[k] = (studentsByTermKey[k] || 0) + 1;
            });
        }
    });

    console.log('All unique academicHistory keys in database:');
    console.log(Array.from(historyKeysFound));

    console.log('\nStudent count per academicHistory key:');
    console.dir(studentsByTermKey);

    // Let's check a sample student with D3 class in 2025-2026-Odd
    const d3Student = students.find(s => {
        if (!s.academicHistory) return false;
        return Object.values(s.academicHistory).some(h => h.className === 'D3');
    });

    if (d3Student) {
        console.log('\nSample D3 Student:', d3Student.name);
        console.log('Academic History Keys:', Object.keys(d3Student.academicHistory));
        console.log('Academic History Content:', JSON.stringify(d3Student.academicHistory, null, 2));
    }
}

inspectExactHistoryKeys().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
