
import { getDb } from './config/firebaseConfig';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

async function inspect() {
    const db = getDb();
    if (!db) return console.log("No DB");

    console.log("--- Settings ---");
    const settingsSnap = await getDoc(doc(db, 'settings', 'global_admin_settings'));
    console.log(JSON.stringify(settingsSnap.data(), null, 2));

    console.log("--- Students holding HS1 ---");
    const studentsSnap = await getDocs(collection(db, 'students'));
    studentsSnap.docs.forEach(d => {
        const data = d.data();
        if (data.currentClass === 'HS1' || (data.academicHistory && Object.values(data.academicHistory).some(h => h.className === 'HS1'))) {
            console.log(`Student: ${data.name} (${data.adNo}) has HS1 reference`);
        }
    });

    console.log("--- Subjects holding HS1 ---");
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    subjectsSnap.docs.forEach(d => {
        const data = d.data();
        if (data.targetClasses && data.targetClasses.includes('HS1')) {
            console.log(`Subject: ${data.name} has HS1 in targetClasses`);
        }
    });
}

inspect();
