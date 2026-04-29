
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');
require('dotenv').config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Mock implementation based on my changes
const SYSTEM_CLASSES = ['S1', 'S2', 'S3', 'D1', 'D2', 'D3', 'P1', 'P2', 'PG1', 'PG2'];

function getHistoricalClassName(termKey, className) {
    if (termKey === '2025-2026-Odd') {
        const reverseMappings = { 'FS2': 'S1', 'FS3': 'S2', 'HS2': 'P1', 'HS3': 'P2' };
        return reverseMappings[className] || className;
    }
    return className;
}

async function verifyDiscovery() {
    const settingsSnap = await getDoc(doc(db, 'settings', 'global_admin_settings'));
    const settings = settingsSnap.data() || {};
    const custom = settings.customClasses || [];
    const disabled = settings.disabledClasses || [];

    const terms = ['2025-2026-Odd', '2025-2026-Even'];

    for (const termKey of terms) {
        console.log(`\nVerifying Discovery for ${termKey}...`);
        
        // Simulating the new additive logic
        const activeClassesSet = new Set([...SYSTEM_CLASSES, ...custom].filter(c => !disabled.includes(c)));
        
        // Discover from Students
        const studentsSnapshot = await getDocs(collection(db, 'students'));
        studentsSnapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            const termRecord = data.academicHistory?.[termKey];
            if (termRecord?.className) activeClassesSet.add(termRecord.className.trim());
            // ... (rest of logic)
        });

        const discovered = Array.from(new Set(
            Array.from(activeClassesSet)
                .filter(c => c && c !== '-' && !disabled.includes(c))
                .map(c => getHistoricalClassName(termKey, c))
        )).sort();

        console.log(`Visible Classes: ${discovered.join(', ')}`);
        
        if (discovered.includes('D3')) {
            console.log('SUCCESS: D3 is visible.');
        } else {
            console.log('FAILURE: D3 is missing!');
        }

        if (termKey === '2025-2026-Odd' && discovered.includes('HS1')) {
            console.log('SUCCESS: HS1 is visible in Odd term.');
        }
    }

    process.exit(0);
}

verifyDiscovery().catch(err => {
    console.error(err);
    process.exit(1);
});
