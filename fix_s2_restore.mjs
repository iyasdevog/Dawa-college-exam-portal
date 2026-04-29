import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";

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
const ODD_TERM = '2025-2026-Odd';
const EVEN_TERM = '2025-2026-Even';

async function diagnoseAndFix() {
    const snapshot = await getDocs(collection(db, 'students'));
    const students = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const targets = students.filter(s => s.adNo === '152' || s.adNo === '153' || s.adNo === 152 || s.adNo === 153);
    
    console.log('=== DIAGNOSE: Students 152 & 153 ===');
    targets.forEach(s => {
        const oddRecord = s.academicHistory?.[ODD_TERM];
        const evenRecord = s.academicHistory?.[EVEN_TERM];
        console.log(`\n[${s.adNo}] ${s.name}`);
        console.log(`  currentClass: ${s.currentClass}`);
        console.log(`  Odd record className: ${oddRecord?.className ?? 'MISSING'}`);
        console.log(`  Even record className: ${evenRecord?.className ?? 'MISSING'}`);
        console.log(`  Odd marks count: ${Object.keys(oddRecord?.marks || {}).length}`);
    });

    console.log('\n=== DIAGNOSE: Classes in Odd term ===');
    const oddClassMap = {};
    students.forEach(s => {
        const r = s.academicHistory?.[ODD_TERM];
        if (r?.className) {
            oddClassMap[r.className] = (oddClassMap[r.className] || 0) + 1;
        }
    });
    console.log('Class breakdown for 2025-2026-Odd:');
    Object.entries(oddClassMap).sort().forEach(([cls, count]) => console.log(`  ${cls}: ${count} students`));

    console.log('\n=== FIX: Restoring 152 & 153 to FS3 (S2) in Odd term ===');
    for (const s of targets) {
        const oddRecord = s.academicHistory?.[ODD_TERM];
        if (!oddRecord) {
            console.log(`[${s.adNo}] ${s.name}: NO odd term record! Creating minimal record.`);
            await updateDoc(doc(db, 'students', s.id), {
                [`academicHistory.${ODD_TERM}`]: {
                    className: 'FS3',
                    semester: 'Odd',
                    marks: {},
                    grandTotal: 0,
                    average: 0,
                    rank: 0,
                    performanceLevel: 'Pending'
                }
            });
        } else if (oddRecord.className !== 'FS3') {
            console.log(`[${s.adNo}] ${s.name}: className was "${oddRecord.className}" -> fixing to "FS3"`);
            await updateDoc(doc(db, 'students', s.id), {
                [`academicHistory.${ODD_TERM}.className`]: 'FS3',
                [`academicHistory.${ODD_TERM}.semester`]: 'Odd'
            });
            console.log(`  ✅ Fixed.`);
        } else {
            console.log(`[${s.adNo}] ${s.name}: Already FS3 ✓`);
        }
    }
    
    console.log('\nDone.');
    process.exit(0);
}

diagnoseAndFix().catch(err => {
    console.error(err);
    process.exit(1);
});
