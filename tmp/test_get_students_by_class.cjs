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

function isMatchingTerm(termKeyA, termKeyB) {
    if (!termKeyA || !termKeyB) return false;
    if (termKeyA === termKeyB) return true;
    const normA = termKeyA.replace(/^2025-/, '2025-2026-');
    const normB = termKeyB.replace(/^2025-/, '2025-2026-');
    return normA === normB;
}

function processStudentRecord(data, id, termKey) {
    const activeTerm = termKey || '2026-2027-Odd';
    let academicHistory = { ...(data.academicHistory || {}) };
    const currentClass = data.currentClass || data.className || '';

    let explicitTermEntry = academicHistory[activeTerm];
    const termData = explicitTermEntry || {
        className: currentClass,
        semester: (activeTerm.includes('Odd') ? 'Odd' : 'Even'),
        marks: {},
        grandTotal: 0,
        average: 0,
        rank: 0,
        performanceLevel: 'Pending'
    };

    let displayClassName = termData?.className || currentClass || 'Unknown';

    return {
        ...data,
        id,
        className: displayClassName,
        currentClass: data.currentClass || displayClassName,
        academicHistory
    };
}

async function simulateStudentService() {
    console.log('\n=== SIMULATING StudentService.getAllStudents and getStudentsByClass ===\n');

    const activeTerm = '2025-2026-Odd';
    const snapshot = await getDocs(collection(db, 'students'));
    const rawStudents = snapshot.docs.map(doc => processStudentRecord(doc.data(), doc.id, activeTerm)).filter(s => !s.isDeleted);

    console.log(`Total raw students processed: ${rawStudents.length}`);

    // Simulation of getAllStudents filter for historical term (2025-2026-Odd)
    const currentSystemTerm = '2026-2027-Odd';
    const isCurrentTerm = activeTerm === currentSystemTerm;

    const filteredStudents = rawStudents.filter(student => {
        if (student.isDeleted) return false;
        if (activeTerm === 'All') return true;
        if (isCurrentTerm) {
            return student.isActive !== false;
        } else {
            if (!student.academicHistory) return false;
            const hasTermHistory = Object.keys(student.academicHistory).some(tk =>
                tk === activeTerm ||
                tk.replace(/^2025-/, '2025-2026-') === activeTerm.replace(/^2025-/, '2025-2026-')
            );
            return hasTermHistory;
        }
    });

    console.log(`Filtered students for ${activeTerm}: ${filteredStudents.length}`);

    const classes = ['S1', 'S2', 'P1', 'P2', 'D1', 'D2', 'D3', 'PG-F'];

    for (const className of classes) {
        const matchesTargetClass = (candidateClass) => candidateClass && candidateClass.trim() === className.trim();

        const classStudents = filteredStudents.filter(s => {
            const matchingHistoryKey = s.academicHistory 
                ? Object.keys(s.academicHistory).find(tk => isMatchingTerm(tk, activeTerm))
                : undefined;
            const historyClass = matchingHistoryKey ? s.academicHistory?.[matchingHistoryKey]?.className : undefined;

            if (historyClass) return matchesTargetClass(historyClass);
            if (s.className && s.className !== 'Unknown') return matchesTargetClass(s.className);
            return false;
        });

        console.log(`Class "${className}": ${classStudents.length} students found`);
        if (className === 'P2') {
            classStudents.forEach(s => {
                console.log(`  - P2 Student: "${s.name}" | AdNo: ${s.adNo} | Class: ${s.className}`);
            });
        }
    }
}

simulateStudentService().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
