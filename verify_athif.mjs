import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

async function verifyStudent() {
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

    const studentId = 'T6iXhrnzzP6NAaLYPapC';
    console.log(`Checking Student ID: ${studentId}...`);
    
    const docRef = doc(db, 'students', studentId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        console.log('STUDENT FOUND BY ID:', {
            name: data.name,
            currentClass: data.currentClass,
            isActive: data.isActive,
            historyKeys: Object.keys(data.academicHistory || {})
        });
        if (data.academicHistory) {
            Object.entries(data.academicHistory).forEach(([k, v]) => {
                console.log(`History for ${k}:`, v.className);
            });
        }
    } else {
        console.log('Student ID not found in live database.');
        const q = query(collection(db, 'students'), where('adNo', '==', '191'));
        const qSnap = await getDocs(q);
        if (qSnap.empty) {
            console.log('Searching for any student with "Athif" in name...');
            const allSnap = await getDocs(collection(db, 'students'));
            allSnap.forEach(d => {
                const name = d.data().name || '';
                if (name.toLowerCase().includes('athif')) {
                    console.log('Found similar name:', d.id, d.data().name, d.data().currentClass);
                }
            });
        } else {
            qSnap.forEach(d => console.log('STUDENT FOUND BY ADNO:', d.id, d.data().name, d.data().currentClass));
        }
    }
    process.exit(0);
}

verifyStudent().catch(console.error);
