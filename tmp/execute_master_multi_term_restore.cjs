const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, getDocs, writeBatch } = require('firebase/firestore');

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

// Class mapping for 2025-2026-Odd -> 2025-2026-Even
const oddToEvenClassMap = {
    'S1': 'FS2',
    'S2': 'FS3',
    'P1': 'HS2',
    'P2': 'HS3',
    'FS1': 'FS1',
    'FS2': 'FS2',
    'FS3': 'FS3',
    'HS1': 'HS1',
    'HS2': 'HS2',
    'HS3': 'HS3',
    'D1': 'D1',
    'D2': 'D2',
    'D3': 'D3',
    'PG1': 'PG1',
    'Hifz': 'Hifz',
    'PG-F': 'PG-F',
    'UG-F': 'UG-F'
};

async function executeRestore() {
    console.log('=== STARTING MASTER MULTI-TERM DATABASE INITIALIZATION ===\n');

    const backupPath = path.join(__dirname, '../public/AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const backupStudents = backupData.students || [];
    const backupSubjects = backupData.subjects || [];

    console.log(`Backup loaded: ${backupStudents.length} students, ${backupSubjects.length} subjects.`);

    // 1. Fetch current live students to preserve any 2026-2027 promotions or custom additions
    const liveStudentsSnap = await getDocs(collection(db, 'students'));
    const liveStudentsMap = new Map();
    liveStudentsSnap.docs.forEach(d => {
        liveStudentsMap.set(d.id, { id: d.id, ...d.data() });
    });

    console.log(`Current live students: ${liveStudentsMap.size}`);

    // Batch write subjects
    console.log('\nStep 1: Restoring and term-tagging Subjects...');
    let subBatches = [];
    let currentSubBatch = writeBatch(db);
    let subOpCount = 0;

    backupSubjects.forEach((sub) => {
        const subRef = doc(db, 'subjects', sub.id);
        const { id, ...subData } = sub;

        // Clean targetClasses: trim and remove redundant aliases if present
        const rawTargetClasses = subData.targetClasses || [];
        const cleanTargets = Array.from(new Set(rawTargetClasses.map(c => typeof c === 'string' ? c.trim() : c))).filter(Boolean);

        const updatedSub = {
            ...subData,
            targetClasses: cleanTargets,
            isDeleted: false,
            updatedAt: Date.now()
        };

        currentSubBatch.set(subRef, updatedSub, { merge: true });
        subOpCount++;

        if (subOpCount === 450) {
            subBatches.push(currentSubBatch);
            currentSubBatch = writeBatch(db);
            subOpCount = 0;
        }
    });
    if (subOpCount > 0) subBatches.push(currentSubBatch);

    for (let i = 0; i < subBatches.length; i++) {
        await subBatches[i].commit();
        console.log(`Committed subject batch ${i + 1}/${subBatches.length}`);
    }

    // Batch write students
    console.log('\nStep 2: Restoring Multi-Term Student Records (2025-2026-Odd, 2025-2026-Even, 2026-2027-Odd)...');
    let studBatches = [];
    let currentStudBatch = writeBatch(db);
    let studOpCount = 0;

    backupStudents.forEach((bkStudent) => {
        const sRef = doc(db, 'students', bkStudent.id);
        const liveStudent = liveStudentsMap.get(bkStudent.id) || {};

        const academicHistory = { ...(liveStudent.academicHistory || {}), ...(bkStudent.academicHistory || {}) };

        // Ensure 2025-2026-Odd is pristine from backup
        if (bkStudent.academicHistory && bkStudent.academicHistory['2025-2026-Odd']) {
            academicHistory['2025-2026-Odd'] = bkStudent.academicHistory['2025-2026-Odd'];
        } else if (bkStudent.marks && Object.keys(bkStudent.marks).length > 0) {
            academicHistory['2025-2026-Odd'] = {
                className: bkStudent.className || bkStudent.currentClass || 'S1',
                semester: 'Odd',
                marks: bkStudent.marks,
                grandTotal: bkStudent.grandTotal || 0,
                average: bkStudent.average || 0,
                rank: bkStudent.rank || 0,
                performanceLevel: bkStudent.performanceLevel || 'Not Assessed'
            };
        }

        // Initialize 2025-2026-Even history entry if not existing
        if (!academicHistory['2025-2026-Even']) {
            const oddClass = academicHistory['2025-2026-Odd']?.className || bkStudent.className || bkStudent.currentClass || 'S1';
            const evenClass = oddToEvenClassMap[oddClass] || oddClass;
            academicHistory['2025-2026-Even'] = {
                className: evenClass,
                semester: 'Even',
                marks: {},
                grandTotal: 0,
                average: 0,
                rank: 0,
                performanceLevel: 'Pending'
            };
        }

        // Initialize 2026-2027-Odd history entry if not existing
        if (!academicHistory['2026-2027-Odd']) {
            const currClass = liveStudent.currentClass || bkStudent.currentClass || bkStudent.className || 'S1';
            academicHistory['2026-2027-Odd'] = {
                className: currClass,
                semester: 'Odd',
                marks: {},
                grandTotal: 0,
                average: 0,
                rank: 0,
                performanceLevel: 'Pending'
            };
        }

        const mergedStudent = {
            ...bkStudent,
            ...liveStudent,
            name: bkStudent.name || liveStudent.name,
            adNo: bkStudent.adNo || liveStudent.adNo,
            currentClass: liveStudent.currentClass || bkStudent.currentClass || bkStudent.className,
            academicHistory,
            isActive: bkStudent.isActive !== false,
            isDeleted: false,
            updatedAt: Date.now()
        };

        currentStudBatch.set(sRef, mergedStudent, { merge: true });
        studOpCount++;

        if (studOpCount === 450) {
            studBatches.push(currentStudBatch);
            currentStudBatch = writeBatch(db);
            studOpCount = 0;
        }
    });
    if (studOpCount > 0) studBatches.push(currentStudBatch);

    for (let i = 0; i < studBatches.length; i++) {
        await studBatches[i].commit();
        console.log(`Committed student batch ${i + 1}/${studBatches.length}`);
    }

    // Step 3: Update global settings
    console.log('\nStep 3: Updating Global Settings for available terms...');
    const settingsRef = doc(db, 'settings', 'global_admin_settings');
    await setDoc(settingsRef, {
        currentAcademicYear: '2026-2027',
        currentSemester: 'Odd',
        availableYears: ['2025-2026', '2026-2027'],
        updatedAt: Date.now()
    }, { merge: true });

    console.log('\n=== MASTER MULTI-TERM INITIALIZATION COMPLETE ===');
}

executeRestore().then(() => process.exit(0)).catch(err => {
    console.error('Error during master restore execution:', err);
    process.exit(1);
});
