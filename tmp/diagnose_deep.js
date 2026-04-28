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
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    console.log('--- Deep Data Diagnostics ---');

    // 1. Check Global Settings
    const settingsSnap = await getDoc(doc(db, 'settings', 'global_admin_settings'));
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    console.log('\n[Global Settings]');
    console.log('Year:', settings.currentAcademicYear);
    console.log('Semester:', settings.currentSemester);
    console.log('Active Term Key:', `${settings.currentAcademicYear}-${settings.currentSemester}`);
    console.log('Available Years:', settings.availableYears || []);
    console.log('Custom Classes:', settings.customClasses || []);
    console.log('Disabled Classes:', settings.disabledClasses || []);

    // 2. Check Students
    const snapshot = await getDocs(collection(db, 'students'));
    const allHistoryKeys = new Set();
    const studentsInFS2 = [];
    
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.currentClass === 'FS2') {
            studentsInFS2.push(data);
        }
        if (data.academicHistory) {
            Object.keys(data.academicHistory).forEach(k => allHistoryKeys.add(k));
        }
    });

    console.log('\n[Database Stats]');
    console.log('Total Students:', snapshot.size);
    console.log('All Term Keys found in history:', Array.from(allHistoryKeys));

    if (studentsInFS2.length > 0) {
        console.log('\n[Sample FS2 Student History]');
        const sample = studentsInFS2[0];
        console.log('Name:', sample.name);
        console.log('currentClass:', sample.currentClass);
        console.log('History Keys:', Object.keys(sample.academicHistory || {}));
        
        // Check if current term exists in history
        const currentTermKey = `${settings.currentAcademicYear}-${settings.currentSemester}`;
        if (sample.academicHistory && sample.academicHistory[currentTermKey]) {
            console.log(`Current History Record (${currentTermKey}):`, sample.academicHistory[currentTermKey]);
        } else {
            console.log(`No history record found for current term: ${currentTermKey}`);
        }
        
        // Find "S1" in history
        Object.entries(sample.academicHistory || {}).forEach(([k, v]) => {
            if ((v as any).className === 'S1') {
                console.log(`Found "S1" in history key: ${k}`);
            }
        });
    }
}

diagnose().then(() => process.exit(0)).catch(console.error);
