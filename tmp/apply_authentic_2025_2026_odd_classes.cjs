const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, getDocs, writeBatch } = require('firebase/firestore');

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

const evenToOddClassMap = {
    'FS2': 'S1',
    'FS3': 'S2',
    'HS2': 'P1',
    'HS3': 'P2',
    'PG1': 'PG-F',
    'FS1': 'FS1',
    'HS1': 'HS1',
    'D1': 'D1',
    'D2': 'D2',
    'D3': 'D3',
    'Hifz': 'Hifz'
};

async function applyAuthenticOddClasses() {
    console.log('=== APPLYING AUTHENTIC 2025-2026-Odd CLASS NAMES (S1, S2, P1, P2, PG-F) ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let batch = writeBatch(db);
    let count = 0;
    let totalUpdated = 0;

    for (const student of students) {
        if (!student.academicHistory || !student.academicHistory['2025-2026-Odd']) continue;

        const currentOddHist = student.academicHistory['2025-2026-Odd'];
        const currentDbClass = currentOddHist.className || '';
        const authenticOddClass = evenToOddClassMap[currentDbClass] || currentDbClass;

        if (authenticOddClass && authenticOddClass !== currentDbClass) {
            const studentRef = doc(db, 'students', student.id);
            const updatedAcademicHistory = {
                ...student.academicHistory,
                '2025-2026-Odd': {
                    ...currentOddHist,
                    className: authenticOddClass
                }
            };

            batch.update(studentRef, {
                academicHistory: updatedAcademicHistory,
                updatedAt: Date.now()
            });

            count++;
            totalUpdated++;

            if (count === 450) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
            }
        }
    }

    if (count > 0) {
        await batch.commit();
    }

    console.log(`Successfully updated ${totalUpdated} student records with authentic 2025-2026-Odd class names (S1, S2, P1, P2, PG-F)!`);

    // Step 2: Ensure 2025-2026-Odd Subjects list S1, S2, P1, P2, PG-F in targetClasses where appropriate
    console.log('\nUpdating 2025-2026-Odd Subject targetClasses...');
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let subBatch = writeBatch(db);
    let subCount = 0;
    let subUpdated = 0;

    for (const sub of subjects) {
        if (!sub.targetClasses || sub.targetClasses.length === 0) continue;

        let hasChange = false;
        const newTargets = new Set();

        sub.targetClasses.forEach(c => {
            newTargets.add(c);
            const mapped = evenToOddClassMap[c];
            if (mapped && mapped !== c) {
                newTargets.add(mapped);
                hasChange = true;
            }
        });

        if (hasChange) {
            const subRef = doc(db, 'subjects', sub.id);
            subBatch.update(subRef, {
                targetClasses: Array.from(newTargets),
                updatedAt: Date.now()
            });

            subCount++;
            subUpdated++;

            if (subCount === 450) {
                await subBatch.commit();
                subBatch = writeBatch(db);
                subCount = 0;
            }
        }
    }

    if (subCount > 0) {
        await subBatch.commit();
    }

    console.log(`Successfully updated ${subUpdated} subject targetClasses to support authentic S1, S2, P1, P2, PG-F class filters!`);
}

applyAuthenticOddClasses().then(() => process.exit(0)).catch(err => {
    console.error('Error applying authentic odd classes:', err);
    process.exit(1);
});
