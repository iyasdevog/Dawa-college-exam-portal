const { initializeApp } = require('firebase/app');
const { getFirestore, doc, deleteDoc, updateDoc, setDoc } = require('firebase/firestore');

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

async function fixJunaidDuplicate() {
    console.log('=== FIXING JUNAID DUPLICATE DOCUMENT IN FIRESTORE ===\n');

    // 1. Delete corrupt document RYVEaYK0dIZpanMNxuuf (which had adNo: "MUHAMMED JUNAID", name: "213", 0 marks)
    const corruptDocRef = doc(db, 'students', 'RYVEaYK0dIZpanMNxuuf');
    console.log('Deleting corrupt document RYVEaYK0dIZpanMNxuuf...');
    await deleteDoc(corruptDocRef);
    console.log('✅ Corrupt document RYVEaYK0dIZpanMNxuuf deleted.');

    // 2. Ensure valid document YZSIp4g2gfsp9KN7l776 is clean and correctly configured
    const validDocRef = doc(db, 'students', 'YZSIp4g2gfsp9KN7l776');
    console.log('Updating valid document YZSIp4g2gfsp9KN7l776...');
    await updateDoc(validDocRef, {
        name: 'Muhammed Junaid',
        adNo: '213',
        className: 'HS2',
        currentClass: 'HS2',
        isDeleted: false
    });
    console.log('✅ Valid document YZSIp4g2gfsp9KN7l776 updated successfully.');
}

fixJunaidDuplicate().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
