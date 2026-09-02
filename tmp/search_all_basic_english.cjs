const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');

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

async function searchAllBasicEnglish() {
    console.log('=== SEARCHING ALL COLLECTIONS & STUDENTS FOR BASIC ENGLISH MARKS ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    
    // Check all term keys across all students for Basic English or English marks
    studentsSnap.docs.forEach(docSnap => {
        const student = docSnap.data();
        const history = student.academicHistory || {};

        Object.entries(history).forEach(([termKey, termData]) => {
            const marks = termData?.marks || {};
            const subjectMetadata = termData?.subjectMetadata || {};

            Object.entries(marks).forEach(([subId, mark]) => {
                const metaName = subjectMetadata[subId]?.name || '';
                if (metaName.toLowerCase().includes('basic english') || subId === 'ZT9XwBTEeSP7rOe2x8ik' || subId === '6gZ0p8rH9re48nlfDaWr' || subId === 'V9xt5WnO1bSvKLoW112r' || subId === 'AlbtqudvSom1OmhpBhnU') {
                    console.log(`Student [${student.adNo}] ${student.name} (${student.className || student.currentClass}) | Term: ${termKey} | SubID: ${subId} ("${metaName}") | Mark:`, mark);
                }
            });
        });
    });
}

searchAllBasicEnglish().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
