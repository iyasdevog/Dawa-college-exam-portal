const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch, doc } = require('firebase/firestore');

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

async function fixP2EnglishSubjectId() {
    console.log('\n=== STANDARDIZING P2 ENGLISH MARKS TO GENERAL SUBJECT GW0CyD9buC4kQZFoDRq0 ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const p2Students = allStudents.filter(s => {
        const hist = s.academicHistory ? s.academicHistory['2025-2026-Odd'] : null;
        return hist && hist.className && (hist.className.trim().toLowerCase() === 'p2' || hist.className.trim().toLowerCase() === 'hs3');
    });

    console.log(`Found ${p2Students.length} students in Class P2 (2025-2026-Odd):`);

    const targetGeneralEnglishId = 'GW0CyD9buC4kQZFoDRq0';
    const legacyElectiveEnglishId = 'L2k1CmbHyJ4uQE8IXMRG';

    let updatedCount = 0;
    const batch = writeBatch(db);

    p2Students.forEach(st => {
        const hist = st.academicHistory['2025-2026-Odd'];
        if (!hist || !hist.marks) return;

        const marks = { ...hist.marks };
        const meta = { ...(hist.subjectMetadata || {}) };
        let modified = false;

        if (marks[legacyElectiveEnglishId]) {
            const markVal = marks[legacyElectiveEnglishId];
            delete marks[legacyElectiveEnglishId];
            if (meta[legacyElectiveEnglishId]) delete meta[legacyElectiveEnglishId];

            marks[targetGeneralEnglishId] = markVal;
            meta[targetGeneralEnglishId] = {
                name: "ENGLISH",
                arabicName: "",
                maxEXT: 70,
                maxINT: 30,
                passingTotal: 40,
                subjectType: "general"
            };

            modified = true;
            console.log(`  - Re-mapped English for "${st.name}" (AdNo: ${st.adNo}) to general ID GW0CyD9buC4kQZFoDRq0 | total: ${markVal.total}`);
        }

        if (modified) {
            hist.marks = marks;
            hist.subjectMetadata = meta;
            const updatedHistory = {
                ...st.academicHistory,
                '2025-2026-Odd': hist
            };

            const docRef = doc(db, 'students', st.id);
            batch.update(docRef, { academicHistory: updatedHistory });
            updatedCount++;
        }
    });

    if (updatedCount > 0) {
        await batch.commit();
        console.log(`\n✅ Successfully re-mapped English to general core subject for ${updatedCount} students in P2!`);
    } else {
        console.log('All P2 English marks are already standardized.');
    }
}

fixP2EnglishSubjectId().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
