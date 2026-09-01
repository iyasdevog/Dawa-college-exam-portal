const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, writeBatch } = require('firebase/firestore');

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

async function fixSpecificData() {
    console.log('=== EXECUTING SPECIFIC MARKS RESTORATION ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ ref: d.ref, id: d.id, ...d.data() }));

    const batch = writeBatch(db);
    let updatesCount = 0;

    // 1. Fix Missing Electives for D3 students: Adm 22, 32, 34
    console.log('1. Restoring missing electives for Adm No 22, 32, 34...');
    
    // Adm 22 (M. Arifudheen P): FNvcco4gBpKSr4PZvWAF (أسرار ألفاظ القرآن) = 65
    const st22 = students.find(s => s.adNo === '22');
    if (st22) {
        const history = JSON.parse(JSON.stringify(st22.academicHistory || {}));
        if (!history['2025-2026-Odd']) history['2025-2026-Odd'] = { marks: {} };
        if (!history['2025-2026-Odd'].marks) history['2025-2026-Odd'].marks = {};
        history['2025-2026-Odd'].marks['FNvcco4gBpKSr4PZvWAF'] = { ext: 65, int: 0, total: 65, status: 'Passed' };
        batch.update(st22.ref, { academicHistory: history });
        updatesCount++;
        console.log('  Updated Adm 22: restored أسرار ألفاظ القرآن = 65');
    }

    // Adm 32 (Ajmal Rahman): b7i4ktKfIjDUcpH43Qyb (URDU BASICS) = 48
    const st32 = students.find(s => s.adNo === '32');
    if (st32) {
        const history = JSON.parse(JSON.stringify(st32.academicHistory || {}));
        if (!history['2025-2026-Odd']) history['2025-2026-Odd'] = { marks: {} };
        if (!history['2025-2026-Odd'].marks) history['2025-2026-Odd'].marks = {};
        history['2025-2026-Odd'].marks['b7i4ktKfIjDUcpH43Qyb'] = { ext: 48, int: 0, total: 48, status: 'Passed' };
        batch.update(st32.ref, { academicHistory: history });
        updatesCount++;
        console.log('  Updated Adm 32: restored URDU BASICS = 48');
    }

    // Adm 34 (Ibraheem): b7i4ktKfIjDUcpH43Qyb (URDU BASICS) = 43
    const st34 = students.find(s => s.adNo === '34');
    if (st34) {
        const history = JSON.parse(JSON.stringify(st34.academicHistory || {}));
        if (!history['2025-2026-Odd']) history['2025-2026-Odd'] = { marks: {} };
        if (!history['2025-2026-Odd'].marks) history['2025-2026-Odd'].marks = {};
        history['2025-2026-Odd'].marks['b7i4ktKfIjDUcpH43Qyb'] = { ext: 43, int: 0, total: 43, status: 'Passed' };
        batch.update(st34.ref, { academicHistory: history });
        updatesCount++;
        console.log('  Updated Adm 34: restored URDU BASICS = 43');
    }

    // 2. Fix P1 / HS2 Arabic marks for all P1 students
    console.log('\n2. Copying Optional Arabic (9p3liMeHUuuMMxoCRG60) marks into 2025-2026-Odd for P1 students...');
    const p1Students = students.filter(s => ['HS2', 'P1'].includes(s.className || s.currentClass));
    
    p1Students.forEach(st => {
        const history = JSON.parse(JSON.stringify(st.academicHistory || {}));
        const evenArabicMark = history['2025-2026-Even']?.marks?.['9p3liMeHUuuMMxoCRG60'];
        const currentOddArabicMark = history['2025-2026-Odd']?.marks?.['9p3liMeHUuuMMxoCRG60'];

        const markToUse = currentOddArabicMark || evenArabicMark;
        if (markToUse) {
            if (!history['2025-2026-Odd']) history['2025-2026-Odd'] = { marks: {} };
            if (!history['2025-2026-Odd'].marks) history['2025-2026-Odd'].marks = {};
            history['2025-2026-Odd'].marks['9p3liMeHUuuMMxoCRG60'] = markToUse;
            batch.update(st.ref, { academicHistory: history });
            updatesCount++;
            console.log(`  Updated P1 Student ${st.adNo} (${st.name}): Optional Arabic = ${markToUse.total}`);
        }
    });

    // 3. Fix Student MUHAMMED JUNAID (Adm No 213)
    console.log('\n3. Restoring full marks for MUHAMMED JUNAID (Adm No 213)...');
    const junaidList = students.filter(s => s.adNo === '213');
    junaidList.forEach(st => {
        const history = JSON.parse(JSON.stringify(st.academicHistory || {}));
        if (!history['2025-2026-Odd']) history['2025-2026-Odd'] = { marks: {} };
        history['2025-2026-Odd'].marks = {
            'rYDaCyK2vLsj8LxMMI6a': { ext: 93, int: 0, total: 93, status: 'Passed' }, // SARF
            'yehe4gkz6bD6XbxofAXU': { ext: 49, int: 0, total: 49, status: 'Passed' }, // Doura
            'zPTnqG80jqeClZtRXXOh': { ext: 84, int: 0, total: 84, status: 'Passed' }, // NAHV
            'g9P8vGMSRy0cYdUcoFr3': { ext: 85, int: 0, total: 85, status: 'Passed' }, // THAJWEED
            'q89Hvjls2oxeLIH0KPP7': { ext: 91, int: 0, total: 91, status: 'Passed' }, // FIQH
            'wfsl5eUpE4E6nn0G1oqb': { ext: 60, int: 0, total: 60, status: 'Passed' }, // English
            'k3syQ8J209hZJ0rHDgqn': { ext: 96, int: 0, total: 96, status: 'Passed' }, // MOTIVATION
            'gfruq2d6apOpKs4K4oAr': { ext: 69, int: 0, total: 69, status: 'Passed' }, // ICT
            'U5h7b4ayJ4TXYPe3RK3U': { ext: 99, int: 0, total: 99, status: 'Passed' }, // LIFE SKILLS
            '9p3liMeHUuuMMxoCRG60': { ext: 64, int: 0, total: 64, status: 'Passed' }  // Optional Arabic
        };
        batch.update(st.ref, {
            className: 'HS2',
            currentClass: 'HS2',
            academicHistory: history
        });
        updatesCount++;
        console.log(`  Restored JUNAID (Adm 213) with 10 complete marks!`);
    });

    if (updatesCount > 0) {
        await batch.commit();
        console.log(`\n✅ Successfully committed ${updatesCount} updates to Firestore.`);
    }
}

fixSpecificData().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
