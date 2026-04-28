import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs, writeBatch, updateDoc, query, where } from 'firebase/firestore';

async function repairNomenclature() {
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

    console.log('Starting Batch Repair...');

    // 1. Find all students with any class containing "FS2" or starting with space
    const snapshot = await getDocs(collection(db, 'students'));
    const batch = writeBatch(db);
    let updatedCount = 0;

    snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        let needsUpdate = false;
        const update = {};

        // Trim currentClass
        if (data.currentClass && data.currentClass !== data.currentClass.trim()) {
            update.currentClass = data.currentClass.trim();
            needsUpdate = true;
        }

        // Rename FS2 to S1 (trim-safe)
        const currentClassFixed = (update.currentClass || data.currentClass || '').trim();
        if (currentClassFixed === 'FS2' || currentClassFixed === 'FS1') {
            update.currentClass = 'S1';
            needsUpdate = true;
        }

        // History
        if (data.academicHistory) {
            const newHistory = { ...data.academicHistory };
            let historyChanged = false;
            Object.entries(newHistory).forEach(([term, termData]) => {
                const oldClass = (termData.className || '').trim();
                let newClass = oldClass;
                
                if (oldClass !== termData.className) {
                    newClass = oldClass;
                    historyChanged = true;
                }
                
                if (newClass === 'FS2' || newClass === 'FS1') {
                    newClass = 'S1';
                    historyChanged = true;
                }

                if (historyChanged) {
                    newHistory[term] = { ...termData, className: newClass };
                }
            });

            if (historyChanged) {
                update.academicHistory = newHistory;
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            batch.update(docSnap.ref, update);
            updatedCount++;
        }
    });

    console.log(`Committing updates for ${updatedCount} students...`);
    await batch.commit();

    // 2. Clean up settings
    const settingsRef = doc(db, 'settings', 'global_admin_settings');
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
        const custom = settingsSnap.data().customClasses || [];
        const cleaned = Array.from(new Set(custom.map(c => c.trim()).map(c => (c === 'FS2' || c === 'FS1') ? 'S1' : c)))
            .filter(c => !['FS2', 'FS1', 'S1'].includes(c)); // S1 is a system class
        await updateDoc(settingsRef, { customClasses: cleaned });
        console.log('Settings cleaned.');
    }

    console.log('REPAIR COMPLETE.');
    process.exit(0);
}

repairNomenclature().catch(console.error);
