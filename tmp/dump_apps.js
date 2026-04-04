const { collection, getDocs, query, where } = require('firebase/firestore');
const { getDb } = require('./config/firebaseConfig');

async function dumpApprovedApps() {
    const db = getDb();
    if (!db) { console.error('No DB'); return; }
    
    const q = query(collection(db, 'applications'), where('status', '==', 'approved'));
    const snapshot = await getDocs(q);
    
    console.log(`Total Approved Apps found: ${snapshot.docs.length}`);
    
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}, AdNo: [${data.adNo}], Type: ${data.type}, Subject: ${data.subjectId}, StudentId: ${data.studentId || 'MISSING'}`);
    });
}

dumpApprovedApps().catch(console.error);
