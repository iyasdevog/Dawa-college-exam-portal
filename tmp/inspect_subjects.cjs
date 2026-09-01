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

async function inspectSubjects() {
    console.log('Fetching all subjects from Firestore...');
    const snapshot = await getDocs(collection(db, 'subjects'));
    console.log(`Total subjects in Firestore: ${snapshot.docs.length}`);

    const subjects = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    const s1Subjects = subjects.filter(s => {
        const tc = s.targetClasses || [];
        return tc.includes('S1') || tc.includes('FS2');
    });

    console.log(`Found ${s1Subjects.length} subjects targeting S1/FS2:`);
    s1Subjects.forEach(s => {
        console.log(`- ID: "${s.id}" | Name: "${s.name}" | Year: "${s.academicYear}" | Sem: "${s.activeSemester}" | targetClasses:`, s.targetClasses);
    });
}

inspectSubjects().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
