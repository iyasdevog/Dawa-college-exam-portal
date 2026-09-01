const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, deleteDoc, doc } = require('firebase/firestore');

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

async function findDuplicateStudents() {
    console.log('Scanning Firestore for duplicate student documents by Admission Number...');
    const snapshot = await getDocs(collection(db, 'students'));
    
    const adNoMap = new Map();
    snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const adNo = (data.adNo || '').toString().trim();
        if (!adNo) return;

        if (!adNoMap.has(adNo)) {
            adNoMap.set(adNo, []);
        }

        let totalMarksCount = Object.keys(data.marks || {}).length;
        if (data.academicHistory) {
            Object.values(data.academicHistory).forEach(h => {
                totalMarksCount += Object.keys(h.marks || {}).length;
            });
        }

        adNoMap.get(adNo).push({
            docId: docSnap.id,
            adNo,
            name: data.name,
            currentClass: data.currentClass || data.className,
            totalMarksCount,
            hasHistory: !!data.academicHistory && Object.keys(data.academicHistory).length > 0,
            isDeleted: !!data.isDeleted
        });
    });

    const duplicates = [];
    adNoMap.forEach((list, adNo) => {
        if (list.length > 1) {
            duplicates.push({ adNo, records: list });
        }
    });

    console.log(`FOUND ${duplicates.length} ADMISSION NUMBERS WITH DUPLICATE DOCUMENTS IN FIRESTORE:`);
    duplicates.forEach(d => {
        console.log(`\nAdNo: ${d.adNo} (${d.records.length} records):`);
        d.records.forEach(r => {
            console.log(`  - DocID: ${r.docId} | Name: "${r.name}" | Class: ${r.currentClass} | TotalMarks: ${r.totalMarksCount} | Deleted: ${r.isDeleted}`);
        });
    });
}

findDuplicateStudents().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
