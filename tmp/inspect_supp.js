const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
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

async function inspectSupp() {
    try {
        console.log('--- INSPECTING SUPPLEMENTARY EXAMS JS ---');
        console.log(`Project ID: ${firebaseConfig.projectId}`);
        const colRef = collection(db, 'supplementaryExams');
        const snapshot = await getDocs(colRef);
        console.log(`Total Exams: ${snapshot.docs.length}`);
        
        const counts = {};
        snapshot.docs.forEach(d => {
            const data = d.data();
            const key = `Type:${data.examType} | AppType:${data.applicationType}`;
            counts[key] = (counts[key] || 0) + 1;
            
            if (data.applicationType === 'improvement') {
                console.log(`Found Improvement: ID=${d.id}, AppType=[${data.applicationType}], Term=${data.examTerm}`);
            }
        });
        console.log('Breakdown:', counts);
    } catch (e) {
        console.error(e);
    }
}

inspectSupp();
