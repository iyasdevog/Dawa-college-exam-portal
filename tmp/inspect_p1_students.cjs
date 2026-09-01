const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

async function inspectP1Students() {
    console.log('Inspecting P1 students in Firestore...');
    const studentsSnap = await getDocs(collection(db, 'students'));
    
    const p1Students = [];
    studentsSnap.docs.forEach(d => {
        const data = d.data();
        const currentCls = data.currentClass || data.className;
        const historyKeys = Object.keys(data.academicHistory || {});
        const isP1 = currentCls === 'P1' || currentCls === 'HS2' || historyKeys.some(k => data.academicHistory[k]?.className === 'P1' || data.academicHistory[k]?.className === 'HS2');
        
        if (isP1) {
            p1Students.push({
                id: d.id,
                adNo: data.adNo,
                name: data.name,
                currentClass: data.currentClass,
                className: data.className,
                termKey: data.termKey,
                topLevelMarksKeys: Object.keys(data.marks || {}),
                academicHistoryKeys: historyKeys,
                academicHistoryContent: data.academicHistory
            });
        }
    });

    console.log(`Found ${p1Students.length} P1/HS2 students in Firestore.`);
    p1Students.slice(0, 6).forEach(s => {
        console.log(`\n--- Student: ${s.adNo} - ${s.name} ---`);
        console.log(`currentClass: ${s.currentClass}, className: ${s.className}, termKey: ${s.termKey}`);
        console.log(`topLevelMarksCount: ${s.topLevelMarksKeys.length}`);
        console.log(`academicHistoryKeys:`, s.academicHistoryKeys);
        if (s.academicHistoryKeys.length > 0) {
            s.academicHistoryKeys.forEach(k => {
                const entry = s.academicHistoryContent[k];
                console.log(`  History[${k}]: className=${entry.className}, marksCount=${Object.keys(entry.marks || {}).length}, grandTotal=${entry.grandTotal}`);
            });
        }
    });
}

inspectP1Students().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
