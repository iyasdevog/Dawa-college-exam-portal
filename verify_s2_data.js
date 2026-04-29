
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, getDoc, doc } = require('firebase/firestore');
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

// Mock getHistoricalClassName logic for 2025-2026-Odd
function getHistoricalClassName(termKey, className) {
    if (termKey === '2025-2026-Odd') {
        const reverseMappings = {
            'FS2': 'S1',
            'FS3': 'S2',
            'HS2': 'P1',
            'HS3': 'P2'
        };
        return reverseMappings[className] || className;
    }
    return className;
}

function processStudentRecord(data, id, termKey) {
    let rawClassName = data.currentClass || data.className || 'Unknown';
    if (termKey && data.academicHistory?.[termKey]) {
        rawClassName = data.academicHistory[termKey].className || rawClassName;
    }
    
    const normalizedClassName = getHistoricalClassName(termKey, rawClassName);
    return {
        ...data,
        id,
        className: normalizedClassName
    };
}

async function verifyS2() {
    const termKey = '2025-2026-Odd';
    console.log(`Checking students in term ${termKey} for class S2...`);
    
    const snapshot = await getDocs(collection(db, 'students'));
    const allStudents = snapshot.docs.map(d => processStudentRecord(d.data(), d.id, termKey));
    
    const s2Students = allStudents.filter(s => s.className === 'S2');
    
    console.log(`Found ${s2Students.length} students in S2:`);
    s2Students.forEach(s => {
        console.log(`- ${s.adNo}: ${s.name} (Resolved Class: ${s.className})`);
    });

    const student153 = allStudents.find(s => s.adNo === '153');
    if (student153) {
        console.log('\nStudent 153 Detailed Data:');
        console.log(`Name: ${student153.name}`);
        console.log(`Resolved Class: ${student153.className}`);
        console.log(`Current Class: ${student153.currentClass}`);
        console.log(`History for ${termKey}:`, JSON.stringify(student153.academicHistory?.[termKey]));
    } else {
        console.log('\nStudent 153 not found!');
    }

    process.exit(0);
}

verifyS2().catch(err => {
    console.error(err);
    process.exit(1);
});
