
const { dataService } = require('./dist/infrastructure/services/dataService');
const { initializeApp } = require('firebase/app');
const { getFirestore } = require('firebase/firestore');
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

async function checkS2() {
    console.log('Fetching students for S2 in 2025-2026-Odd...');
    const students = await dataService.getStudentsByClass('S2', '2025-2026-Odd');
    console.log(`Found ${students.length} students:`);
    students.forEach(s => {
        console.log(`- ${s.adNo}: ${s.name} (Class: ${s.className}, Current: ${s.currentClass})`);
    });

    console.log('\nFetching active classes for 2025-2026-Odd...');
    const classes = await dataService.getClassesByTerm('2025-2026-Odd');
    console.log('Available classes:', classes);
    
    process.exit(0);
}

checkS2().catch(err => {
    console.error(err);
    process.exit(1);
});
