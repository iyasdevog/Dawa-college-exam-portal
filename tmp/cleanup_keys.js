import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, getDoc, writeBatch, setDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal",
    storageBucket: "my-edumark-portal.firebasestorage.app",
    messagingSenderId: "445255012917",
    appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c"
};

async function cleanup() {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    console.log('--- Cleaning Up Corrupted Term Keys ---');

    // 1. Fix Global Settings
    const settingsRef = doc(db, 'settings', 'global_admin_settings');
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
        const settings = settingsSnap.data();
        let year = settings.currentAcademicYear || '';
        let sem = settings.currentSemester || '';
        
        // If year looks like "2025-2026-Odd", strip the suffix
        if (year.endsWith('-Odd')) year = year.replace('-Odd', '');
        if (year.endsWith('-Even')) year = year.replace('-Even', '');
        
        await setDoc(settingsRef, { 
            currentAcademicYear: year,
            currentSemester: sem
        }, { merge: true });
        console.log(`Global Settings Cleaned: Year=${year}, Sem=${sem}`);
    }

    // 2. Fix Student History Keys
    const studentSnaps = await getDocs(collection(db, 'students'));
    const batch = writeBatch(db);
    let count = 0;

    studentSnaps.forEach(d => {
        const data = d.data();
        if (data.academicHistory) {
            const newHistory = {};
            let changed = false;
            Object.keys(data.academicHistory).forEach(key => {
                let newKey = key;
                if (key.endsWith('OddOdd')) newKey = key.replace('OddOdd', 'Odd');
                if (key.endsWith('EvenEven')) newKey = key.replace('EvenEven', 'Even');
                
                if (newKey !== key) {
                    newHistory[newKey] = data.academicHistory[key];
                    changed = true;
                } else {
                    newHistory[key] = data.academicHistory[key];
                }
            });
            if (changed) {
                batch.update(d.ref, { academicHistory: newHistory });
                count++;
            }
        }
    });
    if (count > 0) await batch.commit();
    console.log(`Fixed ${count} students history keys.`);

    // 3. Fix Attendance Records termKey field
    const attSnaps = await getDocs(collection(db, 'attendance'));
    let attCount = 0;
    for (const d of attSnaps.docs) {
        const data = d.data();
        let termKey = data.termKey || '';
        let newTermKey = termKey;
        if (termKey.endsWith('OddOdd')) newTermKey = termKey.replace('OddOdd', 'Odd');
        if (termKey.endsWith('EvenEven')) newTermKey = termKey.replace('EvenEven', 'Even');
        
        if (newTermKey !== termKey) {
            await setDoc(d.ref, { termKey: newTermKey }, { merge: true });
            attCount++;
        }
    }
    console.log(`Fixed ${attCount} attendance term keys.`);
}

cleanup().then(() => process.exit(0)).catch(console.error);
