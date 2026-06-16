
const { initializeApp, getApps, getApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');
const { configurationService } = require('./src/infrastructure/services/ConfigurationService');

async function inspectBilal() {
    const config = configurationService.getFirebaseConfig();
    const app = !getApps().length ? initializeApp(config) : getApp();
    const db = getFirestore(app);
    
    console.log("Searching for Bilal in Firestore...");
    const studentsRef = collection(db, 'students');
    const q = query(studentsRef, where('name', '>=', 'Bilal'), where('name', '<=', 'Bilal\uf8ff'));
    const snap = await getDocs(q);
    
    if (snap.empty) {
        console.log("No student found with name Bilal");
        return;
    }
    
    for (const doc of snap.docs) {
        const data = doc.data();
        console.log(`\n=== Student: ${data.name} (AdNo: ${data.adNo}, ID: ${doc.id}) ===`);
        console.log("Academic History Keys:", Object.keys(data.academicHistory || {}));
        
        // Find Thajweed in any term
        if (data.academicHistory) {
            Object.entries(data.academicHistory).forEach(([term, details]) => {
                if (details.marks) {
                    Object.entries(details.marks).forEach(([subId, marks]) => {
                        const subName = marks.subjectName || '';
                        if (subId.toLowerCase().includes('thaj') || subName.toLowerCase().includes('thaj') || subId.toLowerCase().includes('fiqh')) {
                            console.log(`Term: ${term}, Subject: ${subId}, Marks:`, JSON.stringify(marks));
                        }
                    });
                }
            });
        }
        
        // Check supplementary exams for this student
        const suppRef = collection(db, 'supplementaryExams');
        const sq = query(suppRef, where('studentId', '==', doc.id));
        const sSnap = await getDocs(sq);
        console.log(`Supplementary Exams Found: ${sSnap.size}`);
        sSnap.forEach(sd => {
            const sdata = sd.data();
            console.log(`- ExamID: ${sd.id}, Subject: ${sdata.subjectName}, SubjectId: ${sdata.subjectId}, Status: ${sdata.status}, Attempt: ${sdata.attemptNumber}, Marks:`, JSON.stringify(sdata.marks));
        });
    }
    process.exit(0);
}

inspectBilal().catch(e => {
    console.error(e);
    process.exit(1);
});
