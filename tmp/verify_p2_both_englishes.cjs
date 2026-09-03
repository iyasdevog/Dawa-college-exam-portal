const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

function normalizeSubjectName(name) {
    if (!name) return '';
    return name.toString().trim().toLowerCase()
        .replace(/['"’`]/g, '')
        .replace(/[^a-z0-9\u0600-\u06FF\s]/gi, ' ')
        .replace(/\s+/g, ' ');
}

function getMarkForSubject(marksObj, subject, metadataObj) {
    if (!marksObj || !subject) return undefined;
    if (marksObj[subject.id] !== undefined) return marksObj[subject.id];

    const sId = (subject.id || '').toLowerCase().trim();
    if (sId) {
        const idKey = Object.keys(marksObj).find(k => k.toLowerCase().trim() === sId);
        if (idKey) return marksObj[idKey];
    }

    const sNameNorm = normalizeSubjectName(subject.name || '');
    const sArabicNorm = normalizeSubjectName(subject.arabicName || '');

    const foundKey = Object.keys(marksObj).find(k => {
        const kNorm = normalizeSubjectName(k);
        if (sNameNorm && kNorm === sNameNorm) return true;
        if (sArabicNorm && kNorm === sArabicNorm) return true;

        const snap = metadataObj?.[k];
        if (snap) {
            const snapNameNorm = normalizeSubjectName(snap.name || '');
            const snapArabicNorm = normalizeSubjectName(snap.arabicName || '');
            if (sNameNorm && snapNameNorm === sNameNorm) return true;
            if (sArabicNorm && snapArabicNorm === sArabicNorm) return true;
        }

        return false;
    });

    if (foundKey) return marksObj[foundKey];
    return undefined;
}

async function verifyP2BothEnglishes() {
    console.log('\n=== VERIFYING P2 BOTH GENERAL ENGLISH AND ELECTIVE ENGLISH ===\n');

    const activeTerm = '2025-2026-Odd';
    const selectedClass = 'P2';

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const studentsSnap = await getDocs(collection(db, 'students'));
    const rawStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const classStudents = rawStudents.filter(s => {
        const hist = s.academicHistory ? s.academicHistory[activeTerm] : null;
        return hist && hist.className && (hist.className.trim().toLowerCase() === 'p2' || hist.className.trim().toLowerCase() === 'hs3');
    });

    console.log(`Class P2 Students Count: ${classStudents.length}`);

    const genEnglishSub = subjects.find(s => s.id === 'GW0CyD9buC4kQZFoDRq0');
    const elecEnglishSub = subjects.find(s => s.id === 'L2k1CmbHyJ4uQE8IXMRG');

    console.log(`General English Sub: [${genEnglishSub?.id}] "${genEnglishSub?.name}" (type: ${genEnglishSub?.subjectType})`);
    console.log(`Elective English Sub: [${elecEnglishSub?.id}] "${elecEnglishSub?.name}" (type: ${elecEnglishSub?.subjectType})\n`);

    classStudents.forEach(st => {
        const termData = st.academicHistory[activeTerm];
        const genMark = getMarkForSubject(termData.marks, genEnglishSub, termData.subjectMetadata);
        const elecMark = getMarkForSubject(termData.marks, elecEnglishSub, termData.subjectMetadata);

        console.log(`Student "${st.name}" (AdNo: ${st.adNo}):`);
        console.log(`  - General English : ${genMark ? `${genMark.total} (${genMark.ext}+${genMark.int})` : 'MISSING'}`);
        console.log(`  - Elective English: ${elecMark ? `${elecMark.total} (${elecMark.ext}+${elecMark.int})` : '-'}`);
    });
}

verifyP2BothEnglishes().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
