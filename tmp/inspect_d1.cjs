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

async function inspectD1() {
    console.log('Inspecting D1 in Firestore...');
    const settingsSnap = await getDocs(collection(db, 'settings'));
    settingsSnap.docs.forEach(d => {
        console.log(`Settings Doc [${d.id}]:`, JSON.stringify(d.data(), null, 2));
    });

    const studentsSnap = await getDocs(collection(db, 'students'));
    const d1Students = studentsSnap.docs.filter(d => {
        const data = d.data();
        return data.currentClass === 'D1' || data.className === 'D1';
    });
    console.log(`Found ${d1Students.length} students with currentClass/className == 'D1'`);
    d1Students.forEach(s => {
        console.log(`- Student: ${s.data().adNo} | ${s.data().name} | currentClass: ${s.data().currentClass} | className: ${s.data().className}`);
    });
}

inspectD1().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
