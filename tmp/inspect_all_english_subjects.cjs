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

async function inspectAllEnglishSubjects() {
    console.log('=== INSPECTING ALL ENGLISH SUBJECTS IN FIRESTORE ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));

    subjectsSnap.docs.forEach(doc => {
        const sub = doc.data();
        if (sub.name && sub.name.toLowerCase().includes('english')) {
            console.log(`[${doc.id}] "${sub.name}":`);
            console.log(`   subjectType: "${sub.subjectType}"`);
            console.log(`   activeSemester: "${sub.activeSemester}"`);
            console.log(`   targetClasses: [${(sub.targetClasses || []).join(', ')}]`);
            console.log(`   electiveType: "${sub.electiveType}"`);
            console.log('');
        }
    });
}

inspectAllEnglishSubjects().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
