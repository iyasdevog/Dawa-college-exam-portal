const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

// Basic manual dotenv loader
function loadDotenv() {
    const envPath = path.resolve(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                process.env[key.trim()] = value.trim().replace(/^"(.*)"$/, '$1');
            }
        });
    }
}

loadDotenv();

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

async function inspectApps() {
    try {
        console.log('--- INSPECTING APPROVED APPLICATIONS ---');
        const colRef = collection(db, 'applications');
        const q = query(colRef, where('status', '==', 'approved'));
        const snapshot = await getDocs(q);
        console.log(`Total Approved Applications: ${snapshot.docs.length}`);
        
        const typeCounts = {};
        snapshot.docs.forEach(d => {
            const data = d.data();
            const type = data.type;
            typeCounts[type] = (typeCounts[type] || 0) + 1;
        });
        console.log('Type Breakdown:', typeCounts);
        
        if (snapshot.docs.length > 0) {
            console.log('Sample App Record:', JSON.stringify(snapshot.docs[0].data(), null, 2));
        }
    } catch (e) {
        console.error(e);
    }
}

inspectApps();
