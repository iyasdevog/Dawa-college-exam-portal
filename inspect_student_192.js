
const { initializeApp, getApps, getApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');
const { configurationService } = require('./src/infrastructure/services/ConfigurationService');

async function inspectStudent192() {
    const config = configurationService.getFirebaseConfig();
    const app = !getApps().length ? initializeApp(config) : getApp();
    const db = getFirestore(app);
    
    console.log("Searching for Student 192 (AdNo) in Firestore...");
    const studentsRef = collection(db, 'students');
    const q = query(studentsRef, where('adNo', '==', '192'));
    const snap = await getDocs(q);
    
    if (snap.empty) {
        console.log("No student found with AdNo 192");
        return;
    }
    
    for (const doc of snap.docs) {
        const data = doc.data();
        console.log(`\n=== Student: ${data.name} (AdNo: ${data.adNo}, ID: ${doc.id}) ===`);
        
        // Check supplementary exams for this student
        const suppRef = collection(db, 'supplementaryExams');
        const sq = query(suppRef, where('studentId', '==', doc.id));
        const sSnap = await getDocs(sq);
        console.log(`Supplementary Exams Found: ${sSnap.size}`);
        sSnap.forEach(sd => {
            const sdata = sd.data();
            console.log(`- ExamID: ${sd.id}, Subject: ${sdata.subjectName}, SubjectId: ${sdata.subjectId}, Status: ${sdata.status}, AppType: ${sdata.applicationType}, Marks:`, JSON.stringify(sdata.marks));
        });
    }
    process.exit(0);
}

inspectStudent192().catch(console.error);
