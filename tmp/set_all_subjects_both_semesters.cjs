const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

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

async function setAllSubjectsBothSemesters() {
    console.log('=== SETTING ALL SUBJECTS TO activeSemester: "Both" IN FIRESTORE ===\n');

    const snap = await getDocs(collection(db, 'subjects'));
    console.log(`Found ${snap.docs.length} subjects in catalog.`);

    let count = 0;
    for (const d of snap.docs) {
        const sub = d.data();
        if (sub.activeSemester !== 'Both') {
            await updateDoc(d.ref, { activeSemester: 'Both' });
            count++;
            console.log(`  Set subject [${d.id}] "${sub.name}" activeSemester to "Both" (was "${sub.activeSemester}")`);
        }
    }

    console.log(`\n✅ Updated ${count} subjects to activeSemester: "Both"!`);
}

setAllSubjectsBothSemesters().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
