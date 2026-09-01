const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, writeBatch } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

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

async function fixAllReportedData() {
    console.log('=== EXECUTING COMPLETE MARKS & ELECTIVES RESTORATION FOR P1, P2, D3 ===\n');

    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const bkSubjects = backup.subjects || [];
    const bkStudents = backup.students || [];

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ ref: d.ref, id: d.id, ...d.data() }));

    let batch = writeBatch(db);
    let batchCount = 0;
    let totalUpdated = 0;

    // Helper to commit batch
    const checkCommit = async () => {
        batchCount++;
        totalUpdated++;
        if (batchCount >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
        }
    };

    // ──────────────────────────────────────────────────────────────────────────
    // 1. Ensure English Elective (xd6INM4khNcQM4PHVehF / L2k1CmbHyJ4uQE8IXMRG)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('1. Configuring English Elective in subjects collection...');
    await setDoc(doc(db, 'subjects', 'xd6INM4khNcQM4PHVehF'), {
        name: 'ENGLISH',
        subjectType: 'elective',
        activeSemester: 'Odd',
        targetClasses: ['D1', 'D2', 'D3', 'P2', 'HS3', 'P1', 'HS2'],
        createdAt: Date.now()
    }, { merge: true });

    await setDoc(doc(db, 'subjects', 'L2k1CmbHyJ4uQE8IXMRG'), {
        name: 'ENGLISH',
        subjectType: 'elective',
        activeSemester: 'Odd',
        targetClasses: ['D1', 'D2', 'D3', 'P2', 'HS3'],
        createdAt: Date.now()
    }, { merge: true });

    // ──────────────────────────────────────────────────────────────────────────
    // 2. Fix D3 Missing Electives (Adm 22, 32, 34)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('2. Restoring electives for D3 students (Adm 22, 32, 34)...');
    
    // Adm 22 (M. Arifudheen P): FNvcco4gBpKSr4PZvWAF (أسرار ألفاظ القرآن) = 65
    const st22 = students.find(s => s.adNo === '22');
    if (st22) {
        const history = JSON.parse(JSON.stringify(st22.academicHistory || {}));
        if (!history['2025-2026-Odd']) history['2025-2026-Odd'] = { marks: {} };
        if (!history['2025-2026-Odd'].marks) history['2025-2026-Odd'].marks = {};
        history['2025-2026-Odd'].marks['FNvcco4gBpKSr4PZvWAF'] = { ext: 65, int: 0, total: 65, status: 'Passed' };
        batch.update(st22.ref, { academicHistory: history });
        await checkCommit();
        console.log('   Updated Adm 22: restored أسرار ألفاظ القرآن = 65');
    }

    // Adm 32 (Ajmal Rahman): b7i4ktKfIjDUcpH43Qyb (URDU BASICS) = 48
    const st32 = students.find(s => s.adNo === '32');
    if (st32) {
        const history = JSON.parse(JSON.stringify(st32.academicHistory || {}));
        if (!history['2025-2026-Odd']) history['2025-2026-Odd'] = { marks: {} };
        if (!history['2025-2026-Odd'].marks) history['2025-2026-Odd'].marks = {};
        history['2025-2026-Odd'].marks['b7i4ktKfIjDUcpH43Qyb'] = { ext: 48, int: 0, total: 48, status: 'Passed' };
        batch.update(st32.ref, { academicHistory: history });
        await checkCommit();
        console.log('   Updated Adm 32: restored URDU BASICS = 48');
    }

    // Adm 34 (Ibraheem): b7i4ktKfIjDUcpH43Qyb (URDU BASICS) = 43
    const st34 = students.find(s => s.adNo === '34');
    if (st34) {
        const history = JSON.parse(JSON.stringify(st34.academicHistory || {}));
        if (!history['2025-2026-Odd']) history['2025-2026-Odd'] = { marks: {} };
        if (!history['2025-2026-Odd'].marks) history['2025-2026-Odd'].marks = {};
        history['2025-2026-Odd'].marks['b7i4ktKfIjDUcpH43Qyb'] = { ext: 43, int: 0, total: 43, status: 'Passed' };
        batch.update(st34.ref, { academicHistory: history });
        await checkCommit();
        console.log('   Updated Adm 34: restored URDU BASICS = 43');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. Fix P1 / HS2 Arabic Marks & Restore MUHAMMED JUNAID (Adm 213)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n3. Restoring P1 (HS2) Arabic marks and Junaid (Adm 213)...');
    const p1Students = students.filter(s => ['HS2', 'P1'].includes(s.className || s.currentClass));
    
    p1Students.forEach(st => {
        const bkSt = bkStudents.find(s => s.adNo === st.adNo);
        const history = JSON.parse(JSON.stringify(st.academicHistory || {}));
        
        // Ensure 2025-2026-Odd term object exists
        if (!history['2025-2026-Odd']) history['2025-2026-Odd'] = { marks: {} };
        if (!history['2025-2026-Odd'].marks) history['2025-2026-Odd'].marks = {};

        // Copy Optional Arabic mark from Even semester or from backup if present
        const evenArabicMark = history['2025-2026-Even']?.marks?.['9p3liMeHUuuMMxoCRG60'];
        const bkArabicMark = bkSt?.academicHistory?.['2025-2026-Even']?.marks?.['9p3liMeHUuuMMxoCRG60'] || bkSt?.academicHistory?.['2025-2026-Odd']?.marks?.['9p3liMeHUuuMMxoCRG60'];
        const arabicMark = history['2025-2026-Odd'].marks['9p3liMeHUuuMMxoCRG60'] || evenArabicMark || bkArabicMark;

        if (arabicMark) {
            history['2025-2026-Odd'].marks['9p3liMeHUuuMMxoCRG60'] = arabicMark;
        }

        // Specific fix for Junaid (Adm 213)
        if (st.adNo === '213') {
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
        }

        batch.update(st.ref, {
            className: 'HS2',
            currentClass: 'HS2',
            academicHistory: history
        });
        batchCount++;
        totalUpdated++;
    });
    console.log(`   Updated ${p1Students.length} P1 (HS2) student documents.`);

    // ──────────────────────────────────────────────────────────────────────────
    // 4. Fix P2 / HS3 Arabic & Elective Marks for all P2 students
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n4. Restoring P2 (HS3) Arabic and Elective marks for all P2 students...');
    const p2Students = students.filter(s => ['HS3', 'P2'].includes(s.className || s.currentClass));

    p2Students.forEach(st => {
        const bkSt = bkStudents.find(s => s.adNo === st.adNo);
        const history = JSON.parse(JSON.stringify(st.academicHistory || {}));

        if (!history['2025-2026-Odd']) history['2025-2026-Odd'] = { marks: {} };
        if (!history['2025-2026-Odd'].marks) history['2025-2026-Odd'].marks = {};

        // Copy Optional Arabic mark if present in Even or in May 23 backup
        const evenArabicMark = history['2025-2026-Even']?.marks?.['9p3liMeHUuuMMxoCRG60'];
        const bkArabicMark = bkSt?.academicHistory?.['2025-2026-Even']?.marks?.['9p3liMeHUuuMMxoCRG60'] || bkSt?.academicHistory?.['2025-2026-Odd']?.marks?.['9p3liMeHUuuMMxoCRG60'];
        const arabicMark = history['2025-2026-Odd'].marks['9p3liMeHUuuMMxoCRG60'] || evenArabicMark || bkArabicMark;

        if (arabicMark) {
            history['2025-2026-Odd'].marks['9p3liMeHUuuMMxoCRG60'] = arabicMark;
        }

        // Remap English Elective (L2k1CmbHyJ4uQE8IXMRG in backup) for P2 students
        const bkEnglishElective = bkSt?.academicHistory?.['2025-2026-Odd']?.marks?.['L2k1CmbHyJ4uQE8IXMRG'];
        if (bkEnglishElective) {
            history['2025-2026-Odd'].marks['xd6INM4khNcQM4PHVehF'] = bkEnglishElective;
        } else if (history['2025-2026-Odd'].marks['wfsl5eUpE4E6nn0G1oqb']) {
            // Also map general English mark to English elective if student has it
            const engMark = history['2025-2026-Odd'].marks['wfsl5eUpE4E6nn0G1oqb'];
            history['2025-2026-Odd'].marks['xd6INM4khNcQM4PHVehF'] = engMark;
        }

        batch.update(st.ref, {
            className: 'HS3',
            currentClass: 'HS3',
            academicHistory: history
        });
        batchCount++;
        totalUpdated++;
    });
    console.log(`   Updated ${p2Students.length} P2 (HS3) student documents.`);

    if (batchCount > 0) {
        await batch.commit();
    }

    console.log(`\n✅ Successfully completed restoration for ${totalUpdated} student records!`);
}

fixAllReportedData().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
