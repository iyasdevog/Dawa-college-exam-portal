const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch, doc } = require('firebase/firestore');

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

async function runBatchedOperation(items, operation, batchSize = 400) {
    let currentBatch = writeBatch(db);
    let count = 0;
    for (let i = 0; i < items.length; i++) {
        operation(currentBatch, items[i]);
        count++;
        if (count >= batchSize || i === items.length - 1) {
            await currentBatch.commit();
            currentBatch = writeBatch(db);
            count = 0;
        }
    }
}

async function deduplicateSubjectsInFirestore() {
    console.log('Starting PERMANENT SUBJECT DEDUPLICATION in Firestore...');
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    console.log(`Loaded ${subjectsSnap.docs.length} subjects from Firestore.`);

    const subjectGroups = new Map();

    subjectsSnap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const normName = (data.name || '').trim().toLowerCase();
        if (!normName) return;

        if (!subjectGroups.has(normName)) {
            subjectGroups.set(normName, []);
        }
        subjectGroups.get(normName).push({ docRef: docSnap.ref, id: docSnap.id, data });
    });

    const updates = [];
    const deletes = [];
    const idRedirectMap = new Map(); // oldId -> newId

    subjectGroups.forEach((records, name) => {
        if (records.length <= 1) return;

        // Multiple subjects with the exact same normalized name!
        // Prefer record with activeSemester: 'Both', or most targetClasses
        let bestRecord = records[0];
        records.forEach(r => {
            if (r.data.activeSemester === 'Both') {
                bestRecord = r;
            }
        });

        const mergedTargetClasses = new Set(bestRecord.data.targetClasses || []);
        const mergedEnrolledStudents = new Set(bestRecord.data.enrolledStudents || []);

        records.forEach(r => {
            (r.data.targetClasses || []).forEach(tc => mergedTargetClasses.add(tc));
            (r.data.enrolledStudents || []).forEach(stId => mergedEnrolledStudents.add(stId));

            if (r.id !== bestRecord.id) {
                idRedirectMap.set(r.id, bestRecord.id);
                deletes.push(r.docRef);
            }
        });

        updates.push({
            docRef: bestRecord.docRef,
            payload: {
                targetClasses: Array.from(mergedTargetClasses),
                enrolledStudents: Array.from(mergedEnrolledStudents),
                activeSemester: 'Both' // Ensure it's active across both terms
            }
        });
    });

    console.log(`SUBJECT DEDUPLICATION STATS:`);
    console.log(`- Canonical subject documents to update: ${updates.length}`);
    console.log(`- Duplicate subject documents to delete from Firestore: ${deletes.length}`);

    if (updates.length > 0) {
        await runBatchedOperation(updates, (batch, item) => {
            batch.update(item.docRef, item.payload);
        });
        console.log(`Updated ${updates.length} subject documents in Firestore.`);
    }

    if (deletes.length > 0) {
        await runBatchedOperation(deletes, (batch, docRef) => {
            batch.delete(docRef);
        });
        console.log(`Deleted ${deletes.length} duplicate subject documents from Firestore.`);
    }

    // Update any student mark references that were pointing to deleted subject IDs
    if (idRedirectMap.size > 0) {
        console.log('Redirecting student marks referencing deleted subject IDs...');
        const studentsSnap = await getDocs(collection(db, 'students'));
        const studentUpdates = [];

        studentsSnap.docs.forEach(docSnap => {
            const data = docSnap.data();
            let changed = false;

            const updateMarksMap = (marksMap) => {
                if (!marksMap) return marksMap;
                const newMarks = {};
                Object.entries(marksMap).forEach(([subId, val]) => {
                    const targetId = idRedirectMap.get(subId) || subId;
                    newMarks[targetId] = val;
                    if (targetId !== subId) changed = true;
                });
                return newMarks;
            };

            const academicHistory = { ...(data.academicHistory || {}) };
            Object.keys(academicHistory).forEach(tk => {
                if (academicHistory[tk]?.marks) {
                    academicHistory[tk].marks = updateMarksMap(academicHistory[tk].marks);
                }
            });

            const topMarks = updateMarksMap(data.marks);

            if (changed) {
                const payload = { academicHistory };
                if (topMarks && Object.keys(topMarks).length > 0) {
                    payload.marks = topMarks;
                }
                studentUpdates.push({
                    docRef: docSnap.ref,
                    payload
                });
            }
        });

        if (studentUpdates.length > 0) {
            await runBatchedOperation(studentUpdates, (batch, item) => {
                batch.update(item.docRef, item.payload);
            });
            console.log(`Redirected subject IDs for ${studentUpdates.length} student records.`);
        }
    }

    console.log('PERMANENT SUBJECT DEDUPLICATION COMPLETED SUCCESSFULLY!');
}

deduplicateSubjectsInFirestore().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
