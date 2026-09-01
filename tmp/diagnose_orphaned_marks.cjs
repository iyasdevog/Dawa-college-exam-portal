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

async function diagnose() {
    console.log('=== DIAGNOSTIC: ORPHANED MARK KEYS ===\n');

    // 1. Get all current canonical subject IDs
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjectById = new Map();
    const subjectByName = new Map();
    
    subjectsSnap.docs.forEach(d => {
        const data = d.data();
        subjectById.set(d.id, data);
        subjectByName.set((data.name || '').trim().toLowerCase(), { id: d.id, ...data });
    });

    console.log(`Canonical subjects (${subjectById.size}):`);
    subjectsSnap.docs.forEach(d => {
        const data = d.data();
        console.log(`  [${d.id}] "${data.name}" | type=${data.subjectType} | sem=${data.activeSemester} | classes=${(data.targetClasses||[]).join(',')}`);
    });

    // 2. Scan D1 students specifically and show their mark keys
    const studentsSnap = await getDocs(collection(db, 'students'));
    const d1Students = studentsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => s.className === 'D1' || s.currentClass === 'D1');

    console.log(`\n=== D1 STUDENTS (${d1Students.length}) ===`);

    const orphanedIds = new Set();
    const validIds = new Set();

    d1Students.slice(0, 5).forEach(s => {
        console.log(`\nStudent: ${s.adNo} - ${s.name} | class=${s.className}`);
        const termHistory = s.academicHistory || {};
        Object.keys(termHistory).forEach(termKey => {
            const termData = termHistory[termKey];
            const marks = termData?.marks || {};
            const markKeys = Object.keys(marks);
            console.log(`  Term: ${termKey} | ${markKeys.length} mark keys`);
            markKeys.forEach(k => {
                const isValid = subjectById.has(k);
                if (!isValid) orphanedIds.add(k);
                else validIds.add(k);
                const subjectName = subjectById.has(k) ? subjectById.get(k).name : '❌ ORPHANED';
                const mark = marks[k];
                console.log(`    ${isValid ? '✅' : '❌'} [${k}] => "${subjectName}" | total=${mark?.total ?? '?'}`);
            });
        });
    });

    console.log(`\n=== SUMMARY ===`);
    console.log(`Valid subject IDs found in student marks: ${validIds.size}`);
    console.log(`Orphaned subject IDs found in student marks: ${orphanedIds.size}`);
    if (orphanedIds.size > 0) {
        console.log('\nOrphaned IDs (need remapping):');
        orphanedIds.forEach(id => console.log(`  - "${id}"`));

        // Try to match each orphaned ID to a canonical subject
        console.log('\nAttempted canonical matches for orphaned IDs:');
        orphanedIds.forEach(orphanId => {
            const normId = orphanId.trim().toLowerCase();
            let match = subjectByName.get(normId);
            if (!match) {
                // Try partial
                for (const [n, s] of subjectByName.entries()) {
                    if (n.includes(normId) || normId.includes(n)) {
                        match = s;
                        break;
                    }
                }
            }
            console.log(`  "${orphanId}" => ${match ? `✅ "${match.name}" [${match.id}]` : '❌ NO MATCH FOUND'}`);
        });
    }
}

diagnose().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
