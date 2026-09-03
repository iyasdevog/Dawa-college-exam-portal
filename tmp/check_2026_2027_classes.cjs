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

async function checkClasses() {
    console.log('\n=== CHECKING ACTIVE CLASSES IN 2026-2027-Odd ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const termKey = '2026-2027-Odd';

    const classes2026 = {};
    allStudents.forEach(s => {
        const hist = s.academicHistory ? s.academicHistory[termKey] : null;
        if (hist) {
            const cls = hist.className || 'NONE';
            classes2026[cls] = (classes2026[cls] || 0) + 1;
        }
    });

    console.log('1. Active student classes in 2026-2027-Odd:');
    console.table(classes2026);

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);
    const sub2026 = allSubjects.filter(s => s.academicYear === '2026-2027' && s.activeSemester === 'Odd');

    console.log(`\n2. 2026-2027-Odd subjects count: ${sub2026.length}`);

    // Check subjects that target S1, S2, HS3, D1, P1, P2
    const targetClassesToRemove = ['S1', 'S2', 'HS3', 'D1', 'P1', 'P2'];
    
    const affectedSubjects = [];
    sub2026.forEach(s => {
        const targets = s.targetClasses || [];
        const hasToRemove = targets.some(tc => targetClassesToRemove.includes(tc));
        if (hasToRemove) {
            affectedSubjects.push({
                id: s.id,
                name: s.name,
                targetClasses: targets,
                onlyHasRemovedClasses: targets.every(tc => targetClassesToRemove.includes(tc))
            });
        }
    });

    console.log(`\n3. Subjects targeting [${targetClassesToRemove.join(', ')}]: ${affectedSubjects.length}`);
    const toDeleteCompletely = affectedSubjects.filter(s => s.onlyHasRemovedClasses);
    const toUpdateTargets = affectedSubjects.filter(s => !s.onlyHasRemovedClasses);

    console.log(`   - Subjects to delete completely (ONLY target removed classes): ${toDeleteCompletely.length}`);
    console.log(`   - Subjects to update (target multiple classes, remove specified ones): ${toUpdateTargets.length}`);

    console.log('\nSample to delete completely:');
    toDeleteCompletely.slice(0, 10).forEach(s => console.log(`   [${s.id}] "${s.name}" -> [${s.targetClasses.join(', ')}]`));

    console.log('\nSample to update targets:');
    toUpdateTargets.slice(0, 10).forEach(s => console.log(`   [${s.id}] "${s.name}" -> [${s.targetClasses.join(', ')}]`));
}

checkClasses().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
