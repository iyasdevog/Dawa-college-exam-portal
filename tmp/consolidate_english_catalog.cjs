const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, deleteDoc, updateDoc } = require('firebase/firestore');

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

async function consolidateEnglishCatalog() {
    console.log('=== CONSOLIDATING DUPLICATE ENGLISH CATALOG ENTRIES ===\n');

    // 1. RE-MAP ANY MARKS STORED UNDER STUBS
    const studentsSnap = await getDocs(collection(db, 'students'));
    let studentUpdateCount = 0;

    for (const docSnap of studentsSnap.docs) {
        const student = docSnap.data();
        const history = student.academicHistory || {};
        let studentModified = false;

        const newHistory = { ...history };

        Object.entries(newHistory).forEach(([termKey, termData]) => {
            const marks = termData?.marks;
            const metadata = termData?.subjectMetadata;

            if (marks) {
                const newMarks = { ...marks };
                const newMeta = { ...(metadata || {}) };

                if (newMarks['6gZ0p8rH9re48nlfDaWr']) {
                    newMarks['ZT9XwBTEeSP7rOe2x8ik'] = newMarks['6gZ0p8rH9re48nlfDaWr'];
                    delete newMarks['6gZ0p8rH9re48nlfDaWr'];
                    if (newMeta['6gZ0p8rH9re48nlfDaWr']) {
                        newMeta['ZT9XwBTEeSP7rOe2x8ik'] = { ...newMeta['6gZ0p8rH9re48nlfDaWr'], name: 'Basic English' };
                        delete newMeta['6gZ0p8rH9re48nlfDaWr'];
                    }
                    studentModified = true;
                }

                if (newMarks['ZJ10NiJMiV8nGZ4qx0g4']) {
                    newMarks['t34laHHb8z8OsOGje6fl'] = newMarks['ZJ10NiJMiV8nGZ4qx0g4'];
                    delete newMarks['ZJ10NiJMiV8nGZ4qx0g4'];
                    if (newMeta['ZJ10NiJMiV8nGZ4qx0g4']) {
                        newMeta['t34laHHb8z8OsOGje6fl'] = { ...newMeta['ZJ10NiJMiV8nGZ4qx0g4'], name: 'Communicative English' };
                        delete newMeta['ZJ10NiJMiV8nGZ4qx0g4'];
                    }
                    studentModified = true;
                }

                newHistory[termKey] = {
                    ...termData,
                    marks: newMarks,
                    subjectMetadata: newMeta
                };
            }
        });

        if (studentModified) {
            await updateDoc(docSnap.ref, { academicHistory: newHistory });
            studentUpdateCount++;
            console.log(`  Re-mapped marks for Student Adm [${student.adNo}] ${student.name}`);
        }
    }

    console.log(`Re-mapped marks for ${studentUpdateCount} student documents.`);

    // 2. DELETE DUPLICATE CATALOG STUBS
    const stubsToDelete = ['6gZ0p8rH9re48nlfDaWr', 'ZJ10NiJMiV8nGZ4qx0g4'];
    for (const stubId of stubsToDelete) {
        try {
            await deleteDoc(doc(db, 'subjects', stubId));
            console.log(`  Deleted catalog stub [${stubId}]`);
        } catch (e) {
            console.warn(`  Could not delete stub [${stubId}]:`, e.message);
        }
    }

    // 3. ENSURE MAIN CATALOG ENTRIES ARE FULLY CONFIGURED
    await updateDoc(doc(db, 'subjects', 'ZT9XwBTEeSP7rOe2x8ik'), {
        name: 'Basic English',
        subjectType: 'elective',
        activeSemester: 'Both',
        targetClasses: ['FS1', 'FS2', 'FS3', 'HS1', 'HS2', 'HS3', 'S1', 'S2', 'P1', 'P2']
    });

    await updateDoc(doc(db, 'subjects', 't34laHHb8z8OsOGje6fl'), {
        name: 'Communicative English',
        subjectType: 'elective',
        activeSemester: 'Both',
        targetClasses: ['FS1', 'FS2', 'FS3', 'HS1', 'HS2', 'HS3', 'S1', 'S2', 'P1', 'P2']
    });

    console.log('✅ Catalog consolidation complete! Main Basic English & Communicative English entries updated.');
}

consolidateEnglishCatalog().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
