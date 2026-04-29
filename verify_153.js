
import { initializeApp } from "firebase/app";
import { getFirestore, query, collection, where, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
  authDomain: "my-edumark-portal.firebaseapp.com",
  projectId: "my-edumark-portal",
  storageBucket: "my-edumark-portal.firebasestorage.app",
  messagingSenderId: "445255012917",
  appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c",
  measurementId: "G-LLMWHDTZ1T"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check153() {
    console.log("Checking student 153...");
    const q1 = query(collection(db, "students"), where("adNo", "==", 153));
    const q2 = query(collection(db, "students"), where("adNo", "==", "153"));
    
    const [sn1, sn2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const docs = [...sn1.docs, ...sn2.docs];
    
    if (docs.length === 0) {
        console.log("NOT FOUND AT ALL");
        return;
    }
    
    docs.forEach(d => {
        const data = d.data();
        console.log(`Found: ${data.name} (AdNo: ${data.adNo})`);
        console.log(`Current Class: ${data.currentClass}`);
        console.log(`History KEYS: ${Object.keys(data.academicHistory || {})}`);
        if (data.academicHistory && data.academicHistory['2025-2026-Odd']) {
            console.log(`Odd Term Data:`, JSON.stringify(data.academicHistory['2025-2026-Odd']));
        } else {
            console.log("MISSING ODD TERM IN HISTORY");
        }
    });
}

check153().then(() => process.exit(0)).catch(console.error);
