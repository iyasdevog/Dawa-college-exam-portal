import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from project root
dotenv.config({ path: join(__dirname, '../../.env') });

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

async function diagnose() {
    console.log('--- Database Diagnostics ---');
    if (!firebaseConfig.apiKey) {
        console.error('Missing Firebase configuration. Check .env file.');
        return;
    }

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const studentsCol = collection(db, 'students');
    const snapshot = await getDocs(studentsCol);
    
    const classCounts: Record<string, number> = {};
    const studentsWithS1: any[] = [];
    
    snapshot.forEach(doc => {
        const data = doc.data();
        const cls = data.currentClass || 'None';
        classCounts[cls] = (classCounts[cls] || 0) + 1;
        
        if (cls === 'S1') {
            studentsWithS1.push({ id: doc.id, name: data.name });
        }
    });

    console.log('\nStudent counts by currentClass:');
    console.table(classCounts);

    console.log(`\nFound ${studentsWithS1.length} students still assigned to "S1"`);
    
    const settingsCol = collection(db, 'settings');
    const settingsSnap = await getDoc(doc(db, 'settings', 'global_admin_settings'));
    if (settingsSnap.exists()) {
        const settings = settingsSnap.data();
        console.log('\nGlobal Settings:');
        console.log('Custom Classes:', settings.customClasses);
        console.log('Disabled Classes:', settings.disabledClasses);
    }
}

diagnose().catch(console.error);
