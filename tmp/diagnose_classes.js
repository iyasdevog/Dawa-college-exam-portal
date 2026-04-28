import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal",
    storageBucket: "my-edumark-portal.firebasestorage.app",
    messagingSenderId: "445255012917",
    appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c"
};

async function diagnose() {
    console.log('--- Database Diagnostics ---');

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const studentsCol = collection(db, 'students');
    const snapshot = await getDocs(studentsCol);
    
    const classCounts = {};
    const studentsWithS1 = [];
    
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const cls = data.currentClass || 'None';
        classCounts[cls] = (classCounts[cls] || 0) + 1;
        
        if (cls === 'S1') {
            studentsWithS1.push({ id: docSnap.id, name: data.name });
        }
    });

    console.log('\nStudent counts by currentClass:');
    console.table(classCounts);

    console.log(`\nFound ${studentsWithS1.length} students still assigned to "S1"`);
    
    const settingsRef = doc(db, 'settings', 'global_admin_settings');
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
        const settings = settingsSnap.data();
        console.log('\nGlobal Settings:');
        console.log('Custom Classes:', settings.customClasses || []);
        console.log('Disabled Classes:', settings.disabledClasses || []);
        console.log('Current Academic Year:', settings.currentAcademicYear);
        console.log('Current Semester:', settings.currentSemester);
    } else {
        console.log('Global settings document not found.');
    }
}

diagnose().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
