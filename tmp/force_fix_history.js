import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function forceFix() {
    const term = '2025-2026-Odd';
    const snapshot = await getDocs(collection(db, 'students'));
    console.log(`Checking ${snapshot.size} students...`);

    let updated = 0;
    for (const d of snapshot.docs) {
        const data = d.data();
        const history = data.academicHistory?.[term];
        if (history && history.className === 'FS2') {
            console.log(`Fixing student ${data.adNo} (${data.name})...`);
            await updateDoc(d.ref, {
                [`academicHistory.${term}.className`]: 'S1'
            });
            updated++;
        }
    }

    console.log(`✅ Successfully force-fixed ${updated} students to S1.`);
    process.exit(0);
}

forceFix();
