const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, writeBatch } = require('firebase/firestore');
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

async function fixP2ArabicAndMalayalam() {
    console.log('=== FIXING P2 ARABIC MARKS AND S1/S2 MALAYALAM ===\n');

    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const bkStudents = backup.students || [];

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ ref: d.ref, id: d.id, ...d.data() }));

    let batch = writeBatch(db);
    let count = 0;

    // 1. Copy ARABIC WRITING (0sqxyIEy00893p01q14D) mark into 2025-2026-Odd for ALL P2 (HS3) students
    console.log('1. Copying ARABIC WRITING (0sqxyIEy00893p01q14D) mark into 2025-2026-Odd for ALL P2 students...');
    const p2Students = students.filter(s => ['HS3', 'P2'].includes(s.className || s.currentClass));

    p2Students.forEach(st => {
        const bkSt = bkStudents.find(s => s.adNo === st.adNo);
        const history = JSON.parse(JSON.stringify(st.academicHistory || {}));

        if (!history['2025-2026-Odd']) history['2025-2026-Odd'] = { marks: {} };
        if (!history['2025-2026-Odd'].marks) history['2025-2026-Odd'].marks = {};

        const evenArabicWrite = history['2025-2026-Even']?.marks?.['0sqxyIEy00893p01q14D'];
        const bkArabicWrite = bkSt?.academicHistory?.['2025-2026-Even']?.marks?.['0sqxyIEy00893p01q14D'] || bkSt?.academicHistory?.['2025-2026-Odd']?.marks?.['0sqxyIEy00893p01q14D'];

        const markToUse = history['2025-2026-Odd'].marks['0sqxyIEy00893p01q14D'] || evenArabicWrite || bkArabicWrite;

        if (markToUse) {
            history['2025-2026-Odd'].marks['0sqxyIEy00893p01q14D'] = markToUse;
            batch.update(st.ref, { academicHistory: history });
            count++;
            console.log(`  Updated P2 Student ${st.adNo} (${st.name}): ARABIC WRITING = ${markToUse.total}`);
        }
    });

    // 2. Ensure S1 (FS2) students have Malayalam under D5ZEMWpBGGhGvESByu4l
    // and S2 (FS3) students have Malayalam under Kogdr0NtmlAEQR6WiUCw
    console.log('\n2. Ensuring Malayalam IDs for S1 (FS2) vs S2 (FS3)...');
    
    const s1Students = students.filter(s => ['FS2', 'S1', 'FS1'].includes(s.className || s.currentClass));
    s1Students.forEach(st => {
        const bkSt = bkStudents.find(s => s.adNo === st.adNo);
        const history = JSON.parse(JSON.stringify(st.academicHistory || {}));

        let changed = false;
        Object.keys(history).forEach(tk => {
            const marks = history[tk]?.marks;
            if (marks) {
                // If S1 student has Kogdr0NtmlAEQR6WiUCw (S2 Malayalam) or bk mark D5ZEMWpBGGhGvESByu4l
                const s2MalMark = marks['Kogdr0NtmlAEQR6WiUCw'];
                const bkMalMark = bkSt?.academicHistory?.[tk]?.marks?.['D5ZEMWpBGGhGvESByu4l'];
                const malMark = s2MalMark || bkMalMark;

                if (malMark) {
                    marks['D5ZEMWpBGGhGvESByu4l'] = malMark;
                    changed = true;
                }
            }
        });

        if (changed) {
            batch.update(st.ref, { academicHistory: history });
            count++;
            console.log(`  Updated S1 Student ${st.adNo} (${st.name}): Malayalam mapped to D5ZEMWpBGGhGvESByu4l`);
        }
    });

    const s2Students = students.filter(s => ['FS3', 'S2', 'Hifz'].includes(s.className || s.currentClass));
    s2Students.forEach(st => {
        const bkSt = bkStudents.find(s => s.adNo === st.adNo);
        const history = JSON.parse(JSON.stringify(st.academicHistory || {}));

        let changed = false;
        Object.keys(history).forEach(tk => {
            const marks = history[tk]?.marks;
            if (marks) {
                const s1MalMark = marks['D5ZEMWpBGGhGvESByu4l'];
                const bkMalMark = bkSt?.academicHistory?.[tk]?.marks?.['Kogdr0NtmlAEQR6WiUCw'];
                const malMark = s1MalMark || bkMalMark;

                if (malMark) {
                    marks['Kogdr0NtmlAEQR6WiUCw'] = malMark;
                    changed = true;
                }
            }
        });

        if (changed) {
            batch.update(st.ref, { academicHistory: history });
            count++;
            console.log(`  Updated S2 Student ${st.adNo} (${st.name}): Malayalam mapped to Kogdr0NtmlAEQR6WiUCw`);
        }
    });

    if (count > 0) {
        await batch.commit();
        console.log(`\n✅ Successfully committed ${count} updates to Firestore.`);
    }
}

fixP2ArabicAndMalayalam().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
