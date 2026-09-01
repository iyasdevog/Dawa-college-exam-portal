const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, writeBatch } = require('firebase/firestore');

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

async function purgeFS2FS3Malayalam() {
    console.log('=== PURGING MISTAKEN MALAYALAM RECORDS FOR FS2 & FS3 ===\n');

    // 1. Update targetClasses for Malayalam subjects to remove FS2, S1, FS3, S2
    console.log('1. Updating targetClasses for Malayalam subjects...');
    
    // D5ZEMWpBGGhGvESByu4l (previously FS2/FS1) -> set to FS1 only
    await setDoc(doc(db, 'subjects', 'D5ZEMWpBGGhGvESByu4l'), {
        targetClasses: ['FS1']
    }, { merge: true });

    // Kogdr0NtmlAEQR6WiUCw (previously FS3/Hifz) -> set to Hifz only
    await setDoc(doc(db, 'subjects', 'Kogdr0NtmlAEQR6WiUCw'), {
        targetClasses: ['Hifz']
    }, { merge: true });

    console.log('✅ Subject targetClasses updated (removed FS2/S1/FS3/S2).\n');

    // 2. Scan all FS2 (S1) and FS3 (S2) students and remove all Malayalam mark keys from ALL terms
    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ ref: d.ref, id: d.id, ...d.data() }));

    const fs2fs3Students = students.filter(s => ['FS2','S1','FS3','S2'].includes(s.className || s.currentClass));
    console.log(`Scanning ${fs2fs3Students.length} FS2/S1 & FS3/S2 students for Malayalam marks...`);

    let batch = writeBatch(db);
    let count = 0;
    let totalPurged = 0;

    const malayalamSubjectIds = ['D5ZEMWpBGGhGvESByu4l', 'Kogdr0NtmlAEQR6WiUCw', 'VblHptFYytqZ6BOoZ17c'];

    fs2fs3Students.forEach(st => {
        const history = JSON.parse(JSON.stringify(st.academicHistory || {}));
        const topMarks = JSON.parse(JSON.stringify(st.marks || {}));
        let changed = false;

        // Check top-level marks
        malayalamSubjectIds.forEach(subId => {
            if (topMarks[subId] !== undefined) {
                delete topMarks[subId];
                changed = true;
            }
        });

        // Check all history terms
        Object.keys(history).forEach(termKey => {
            const marks = history[termKey]?.marks;
            const meta = history[termKey]?.subjectMetadata;

            if (marks) {
                malayalamSubjectIds.forEach(subId => {
                    if (marks[subId] !== undefined) {
                        delete marks[subId];
                        changed = true;
                    }
                });

                // Also delete by metadata name check
                Object.keys(marks).forEach(subId => {
                    const subName = (meta?.[subId]?.name || '').toLowerCase();
                    if (subName.includes('malayalam')) {
                        delete marks[subId];
                        changed = true;
                    }
                });
            }
        });

        if (changed) {
            batch.update(st.ref, {
                academicHistory: history,
                marks: topMarks
            });
            count++;
            totalPurged++;
            console.log(`  Purged Malayalam marks for Student ${st.adNo} (${st.name}, class=${st.className})`);
        }
    });

    if (count > 0) {
        await batch.commit();
        console.log(`\n✅ Successfully purged Malayalam records from ${totalPurged} FS2/S1 & FS3/S2 student documents!`);
    } else {
        console.log('\nNo FS2/S1 or FS3/S2 student records contained Malayalam marks.');
    }
}

purgeFS2FS3Malayalam().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
