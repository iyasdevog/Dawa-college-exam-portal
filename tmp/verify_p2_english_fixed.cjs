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

async function verifyP2EnglishFixed() {
    console.log('\n=== VERIFYING P2 ENGLISH MARKS FOR ALL 14 STUDENTS ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    const engSubject = allSubjects.find(s => s.id === 'GW0CyD9buC4kQZFoDRq0');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const p2Students = allStudents.filter(s => {
        const hist = s.academicHistory ? s.academicHistory['2025-2026-Odd'] : null;
        return hist && hist.className && (hist.className.trim().toLowerCase() === 'p2' || hist.className.trim().toLowerCase() === 'hs3');
    });

    console.log(`Class P2 English Subject: [${engSubject.id}] "${engSubject.name}" (type: ${engSubject.subjectType})\n`);

    p2Students.forEach(st => {
        const hist = st.academicHistory['2025-2026-Odd'];
        const mark = getMarkForSubject(hist.marks, engSubject, hist.subjectMetadata);
        console.log(`Student: "${st.name}" (adNo: ${st.adNo}) → ENGLISH: ${mark ? `${mark.total} (${mark.ext}+${mark.int})` : 'MISSING'}`);
    });
}

verifyP2EnglishFixed().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
