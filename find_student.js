const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');

// Since I can't easily import the project config in a scratch script without build issues,
// I will try to read it from the environment or a known file if possible.
// Or I can use a simpler approach: use grep to find the student in the last terminal output if it had it.
// BUT, I'll try to use the project's firebase config which I can find in src/infrastructure/config/firebase.ts

const fs = require('fs');
const path = require('path');

async function findStudent() {
    const configContent = fs.readFileSync('src/infrastructure/config/firebase.ts', 'utf8');
    const apiKeyMatch = configContent.match(/apiKey:\s*['"](.+?)['"]/);
    const projectIdMatch = configContent.match(/projectId:\s*['"](.+?)['"]/);
    
    if (!apiKeyMatch || !projectIdMatch) {
        console.error('Could not find Firebase config');
        return;
    }

    const firebaseConfig = {
        apiKey: apiKeyMatch[1],
        projectId: projectIdMatch[1],
        // Add other fields if needed, but these are usually enough for reading
        authDomain: `${projectIdMatch[1]}.firebaseapp.com`,
        storageBucket: `${projectIdMatch[1]}.appspot.com`,
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    console.log('Searching for Athif Abdul Azeez...');
    const q = collection(db, 'students');
    const snapshot = await getDocs(q);
    
    let found = false;
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.name && data.name.toLowerCase().includes('athif')) {
            console.log('FOUND:', {
                id: doc.id,
                name: data.name,
                currentClass: data.currentClass,
                isActive: data.isActive,
                academicHistoryKeys: Object.keys(data.academicHistory || {})
            });
            console.log('S1 History:', data.academicHistory?.['2025-2026-Odd'] || 'N/A');
            found = true;
        }
    });

    if (!found) console.log('Student not found in database.');
    process.exit(0);
}

findStudent();
