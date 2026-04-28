import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, writeBatch, query, where, deleteDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal",
    storageBucket: "my-edumark-portal.firebasestorage.app",
    messagingSenderId: "445255012917",
    appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c"
};

const OLD_NAME = 'S1';
const NEW_NAME = 'FS2';

async function repair() {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    console.log(`--- Starting Global Repair: ${OLD_NAME} -> ${NEW_NAME} ---`);

    // 1. Repair Global Settings
    const settingsRef = doc(db, 'settings', 'global_admin_settings');
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
        const settings = settingsSnap.data();
        let customClasses = settings.customClasses || [];
        let disabledClasses = settings.disabledClasses || [];
        
        if (!customClasses.includes(NEW_NAME)) customClasses.push(NEW_NAME);
        if (!disabledClasses.includes(OLD_NAME)) disabledClasses.push(OLD_NAME);
        
        // Ensure availableYears is not empty
        if (!settings.availableYears || settings.availableYears.length === 0) {
            console.log('Fixing empty availableYears...');
            const years = new Set(['2025-2026', '2026S2']);
            await setDoc(settingsRef, { availableYears: Array.from(years) }, { merge: true });
        }

        await setDoc(settingsRef, { customClasses, disabledClasses }, { merge: true });
        console.log('Global settings updated.');
    }

    // 2. Repair Students Academic History
    console.log('Updating student historical records...');
    const studentSnaps = await getDocs(collection(db, 'students'));
    const studentBatch = writeBatch(db);
    let studentCount = 0;
    
    studentSnaps.forEach(d => {
        const data = d.data();
        let changed = false;
        
        if (data.currentClass === OLD_NAME) {
            data.currentClass = NEW_NAME;
            data.className = NEW_NAME;
            changed = true;
        }

        if (data.academicHistory) {
            Object.keys(data.academicHistory).forEach(term => {
                if (data.academicHistory[term].className === OLD_NAME) {
                    data.academicHistory[term].className = NEW_NAME;
                    changed = true;
                }
            });
        }

        if (changed) {
            studentBatch.set(d.ref, data, { merge: true });
            studentCount++;
        }
    });
    if (studentCount > 0) await studentBatch.commit();
    console.log(`Updated ${studentCount} students.`);

    // 3. Repair Subjects
    console.log('Updating subject target classes...');
    const subjectSnaps = await getDocs(collection(db, 'subjects'));
    const subjectBatch = writeBatch(db);
    let subjectCount = 0;
    subjectSnaps.forEach(d => {
        const data = d.data();
        const targets = data.targetClasses || [];
        if (targets.includes(OLD_NAME)) {
            const updated = targets.map(c => c === OLD_NAME ? NEW_NAME : c);
            subjectBatch.update(d.ref, { targetClasses: updated });
            subjectCount++;
        }
    });
    if (subjectCount > 0) await subjectBatch.commit();
    console.log(`Updated ${subjectCount} subjects.`);

    // 4. Repair Timetables
    console.log('Updating timetables...');
    const ttSnaps = await getDocs(query(collection(db, 'timetables'), where('className', '==', OLD_NAME)));
    const ttBatch = writeBatch(db);
    ttSnaps.forEach(d => ttBatch.update(d.ref, { className: NEW_NAME }));
    if (ttSnaps.size > 0) await ttBatch.commit();
    console.log(`Updated ${ttSnaps.size} timetable entries.`);

    // 5. Repair Attendance (ID Renaming)
    console.log('Migrating attendance documents...');
    const attendanceSnaps = await getDocs(collection(db, 'attendance'));
    let attCount = 0;
    for (const d of attendanceSnaps.docs) {
        if (d.id.startsWith(`${OLD_NAME}_`)) {
            const newId = d.id.replace(`${OLD_NAME}_`, `${NEW_NAME}_`);
            console.log(`Migrating attendance: ${d.id} -> ${newId}`);
            await setDoc(doc(db, 'attendance', newId), d.data());
            await deleteDoc(d.ref);
            attCount++;
        }
    }
    console.log(`Migrated ${attCount} attendance documents.`);

    console.log('--- Repair Complete ---');
}

repair().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
