import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function purgeFS2() {
    console.log('--- Purging FS2 from 2025-2026-Odd Subjects ---');
    const snapshot = await getDocs(collection(db, 'subjects'));
    let updated = 0;

    for (const d of snapshot.docs) {
        const data = d.data();
        if (data.academicYear === '2025-2026' && data.activeSemester === 'Odd') {
            const targets = data.targetClasses || [];
            if (targets.includes('FS2')) {
                const newTargets = targets.filter(c => c !== 'FS2');
                if (!newTargets.includes('S1')) newTargets.push('S1');
                
                await updateDoc(d.ref, { targetClasses: newTargets });
                console.log(`Purged FS2 from subject: ${data.name} (${d.id})`);
                updated++;
            }
        }
    }

    console.log(`✅ Successfully purged ${updated} subjects.`);
    process.exit(0);
}

purgeFS2();
