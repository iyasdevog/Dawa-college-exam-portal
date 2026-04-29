
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
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
const ODD_TERM = '2025-2026-Odd';
const EVEN_TERM = '2025-2026-Even';

async function diagnoseAndFix() {
    const snapshot = await getDocs(collection(db, 'students'));
    const students = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const targets = students.filter(s => s.adNo === '152' || s.adNo === '153');
    
    console.log('=== DIAGNOSE: Students 152 & 153 ===');
    targets.forEach(s => {
        console.log(`\n[${s.adNo}] ${s.name}`);
        console.log(`  currentClass: ${s.currentClass}`);
        const oddRecord = s.academicHistory?.[ODD_TERM];
        const evenRecord = s.academicHistory?.[EVEN_TERM];
        console.log(`  Odd record: ${JSON.stringify(oddRecord ? { className: oddRecord.className, semester: oddRecord.semester, marks: Object.keys(oddRecord.marks || {}).length + ' subjects' } : null)}`);
        console.log(`  Even record: ${JSON.stringify(evenRecord ? { className: evenRecord.className, semester: evenRecord.semester, marks: Object.keys(evenRecord.marks || {}).length + ' subjects' } : null)}`);
    });

    console.log('\n=== HS1 students in Odd term (should NOT exist) ===');
    const hs1InOdd = students.filter(s => {
        const r = s.academicHistory?.[ODD_TERM];
        return r?.className === 'HS1' || r?.className === 'FS1';
    });
    hs1InOdd.forEach(s => {
        console.log(`  [${s.adNo}] ${s.name} -> Odd className: ${s.academicHistory[ODD_TERM].className}`);
    });

    console.log('\n=== FIX: Restoring 152 & 153 to S2 (FS3) for Odd term ===');
    for (const s of targets) {
        const oddRecord = s.academicHistory?.[ODD_TERM] || {};
        const currentClassName = oddRecord.className;
        console.log(`[${s.adNo}] ${s.name}: Odd className is "${currentClassName}"`);
        
        if (currentClassName !== 'FS3') {
            const updatedOddRecord = {
                ...oddRecord,
                className: 'FS3',
                semester: 'Odd'
            };
            await updateDoc(doc(db, 'students', s.id), {
                [`academicHistory.${ODD_TERM}`]: updatedOddRecord
            });
            console.log(`  ✅ Fixed: Set Odd className to FS3 (S2)`);
        } else {
            console.log(`  ✓ Already correct (FS3)`);
        }
    }
    
    console.log('\nDone.');
    process.exit(0);
}

diagnoseAndFix().catch(err => {
    console.error(err);
    process.exit(1);
});
