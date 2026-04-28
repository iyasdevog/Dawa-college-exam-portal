import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';

async function repairSubjects() {
    const firebaseConfig = {
        apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
        authDomain: "my-edumark-portal.firebaseapp.com",
        projectId: "my-edumark-portal",
        storageBucket: "my-edumark-portal.firebasestorage.app",
        messagingSenderId: "445255012917",
        appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c"
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    console.log('Starting Subject TargetClass Repair...');
    const snapshot = await getDocs(collection(db, 'subjects'));
    const batch = writeBatch(db);
    let updatedCount = 0;

    snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const targetClasses = data.targetClasses || [];
        let changed = false;

        const newTargetClasses = targetClasses.map(c => {
            const trimmed = c.trim();
            if (trimmed === 'FS2' || trimmed === 'FS1') {
                changed = true;
                return 'S1';
            }
            if (trimmed !== c) {
                changed = true;
                return trimmed;
            }
            return c;
        });

        // Deduplicate
        const finalClasses = Array.from(new Set(newTargetClasses));
        if (finalClasses.length !== targetClasses.length) changed = true;

        if (changed) {
            batch.update(docSnap.ref, { targetClasses: finalClasses });
            updatedCount++;
            console.log(`Updated subject: ${data.name} -> ${finalClasses.join(', ')}`);
        }
    });

    if (updatedCount > 0) {
        console.log(`Committing ${updatedCount} subject updates...`);
        await batch.commit();
    } else {
        console.log('No subjects needed repair.');
    }

    process.exit(0);
}

repairSubjects().catch(console.error);
