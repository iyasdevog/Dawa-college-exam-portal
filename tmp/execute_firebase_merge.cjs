const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch, doc, deleteDoc } = require('firebase/firestore');

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

const reverseMappings = {
    'FS2': 'S1',
    'FS3': 'S2',
    'HS2': 'P1',
    'HS3': 'P2',
    'FS1': 'FS1',
    'HS1': 'HS1'
};

const forwardMappings = {
    'S1': 'FS2',
    'S2': 'FS3',
    'P1': 'HS2',
    'P2': 'HS3',
    'Bridge': 'FS1',
    'Prep': 'HS1'
};

function getHistoricalClassName(termKey, dbClass) {
    if (!dbClass) return dbClass;
    const isOddTerm = !termKey || termKey.endsWith('-Odd') || termKey.includes('-Odd') || termKey === '2025-Odd';
    if (isOddTerm) {
        return reverseMappings[dbClass] || dbClass;
    }
    return dbClass;
}

function getDatabaseClassName(termKey, historicalName) {
    if (!historicalName) return historicalName;
    return forwardMappings[historicalName] || historicalName;
}

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

async function executePermanentFirebaseFix() {
    console.log('Starting PERMANENT FIREBASE DATA RESTORATION & DEDUPLICATION...');
    const snapshot = await getDocs(collection(db, 'students'));
    console.log(`Loaded ${snapshot.docs.length} student records from Firestore.`);

    // Group documents by adNo
    const adNoGroups = new Map();
    snapshot.docs.forEach(d => {
        const data = d.data();
        const adNo = (data.adNo || '').toString().trim();
        if (!adNo) return;
        if (!adNoGroups.has(adNo)) adNoGroups.set(adNo, []);
        adNoGroups.get(adNo).push({ docRef: d.ref, id: d.id, data });
    });

    const updates = [];
    const deletes = [];

    adNoGroups.forEach((records, adNo) => {
        if (records.length === 1) {
            // Single record: ensure isDeleted is false if it has marks or is active
            const rec = records[0];
            if (rec.data.isDeleted) {
                updates.push({ docRef: rec.docRef, payload: { isDeleted: false } });
            }
            return;
        }

        // Multiple records for the same admission number
        // Find record with the richest academic history / marks
        let bestRecord = records[0];
        let maxMarks = 0;

        records.forEach(r => {
            let mCount = Object.keys(r.data.marks || {}).length;
            if (r.data.academicHistory) {
                Object.values(r.data.academicHistory).forEach(h => {
                    mCount += Object.keys(h.marks || {}).length;
                });
            }
            if (mCount > maxMarks) {
                maxMarks = mCount;
                bestRecord = r;
            }
        });

        // Merge all academicHistory and marks across all duplicate records into bestRecord
        const mergedHistory = { ...(bestRecord.data.academicHistory || {}) };
        const mergedTopMarks = { ...(bestRecord.data.marks || {}) };

        records.forEach(r => {
            // Copy top-level marks
            if (r.data.marks) {
                Object.assign(mergedTopMarks, r.data.marks);
            }
            // Merge history entries
            if (r.data.academicHistory) {
                Object.entries(r.data.academicHistory).forEach(([tk, hEntry]) => {
                    const canonicalKey = (!tk || tk === '2025-Odd' || tk === '2025') 
                        ? '2025-2026-Odd' 
                        : (tk === '2025-Even' ? '2025-2026-Even' : tk);

                    const existing = mergedHistory[canonicalKey] || {};
                    const historyMarks = { ...(existing.marks || {}), ...(hEntry.marks || {}) };

                    let sum = 0, validCount = 0, failCount = 0;
                    Object.values(historyMarks).forEach((m) => {
                        const subTotal = typeof m.total === 'number' ? m.total : ((Number(m.int) || 0) + (Number(m.ext) || 0));
                        sum += subTotal;
                        if (subTotal > 0 || m.int !== undefined || m.ext !== undefined) validCount++;
                        if (m.status === 'Failed') failCount++;
                    });

                    const rawCls = existing.className || hEntry.className || r.data.currentClass || r.data.className;
                    const histCls = getHistoricalClassName(canonicalKey, rawCls);

                    mergedHistory[canonicalKey] = {
                        ...existing,
                        ...hEntry,
                        className: histCls,
                        semester: canonicalKey.endsWith('-Odd') ? 'Odd' : 'Even',
                        marks: historyMarks,
                        grandTotal: sum > 0 ? sum : (existing.grandTotal || hEntry.grandTotal || 0),
                        average: validCount > 0 ? Math.round((sum / validCount) * 10) / 10 : (existing.average || hEntry.average || 0),
                        performanceLevel: sum > 0 ? (failCount > 0 ? 'Failed' : 'Passed') : (existing.performanceLevel || hEntry.performanceLevel || 'Pending')
                    };
                });
            }
        });

        // Also move top-level legacy marks into academicHistory['2025-2026-Odd'] if missing
        if (Object.keys(mergedTopMarks).length > 0) {
            const legacyTerm = '2025-2026-Odd';
            const existingHist = mergedHistory[legacyTerm] || {};
            if (!existingHist.marks || Object.keys(existingHist.marks).length === 0) {
                let sum = 0, validCount = 0, failCount = 0;
                Object.values(mergedTopMarks).forEach((m) => {
                    const subTotal = typeof m.total === 'number' ? m.total : ((Number(m.int) || 0) + (Number(m.ext) || 0));
                    sum += subTotal;
                    if (subTotal > 0 || m.int !== undefined || m.ext !== undefined) validCount++;
                    if (m.status === 'Failed') failCount++;
                });

                const rawCls = existingHist.className || bestRecord.data.currentClass || bestRecord.data.className;
                const histCls = getHistoricalClassName(legacyTerm, rawCls);

                mergedHistory[legacyTerm] = {
                    ...existingHist,
                    className: histCls,
                    semester: 'Odd',
                    marks: mergedTopMarks,
                    grandTotal: sum > 0 ? sum : (bestRecord.data.grandTotal || 0),
                    average: validCount > 0 ? Math.round((sum / validCount) * 10) / 10 : (bestRecord.data.average || 0),
                    performanceLevel: sum > 0 ? (failCount > 0 ? 'Failed' : 'Passed') : 'Pending'
                };
            }
        }

        const currentCls = bestRecord.data.currentClass || bestRecord.data.className;

        // Keep bestRecord active with merged data
        updates.push({
            docRef: bestRecord.docRef,
            payload: {
                isDeleted: false,
                currentClass: currentCls,
                className: currentCls,
                academicHistory: mergedHistory
            }
        });

        // Delete the redundant duplicate records in Firestore
        records.forEach(r => {
            if (r.id !== bestRecord.id) {
                deletes.push(r.docRef);
            }
        });
    });

    console.log(`PERMANENT FIX STATS:`);
    console.log(`- Student documents to update with merged marks: ${updates.length}`);
    console.log(`- Duplicate/ghost student documents to delete from Firestore: ${deletes.length}`);

    // Run updates in Firestore
    if (updates.length > 0) {
        await runBatchedOperation(updates, (batch, item) => {
            batch.update(item.docRef, item.payload);
        });
        console.log(`Successfully updated ${updates.length} student records in Firestore.`);
    }

    // Run deletes for duplicate records in Firestore
    if (deletes.length > 0) {
        await runBatchedOperation(deletes, (batch, docRef) => {
            batch.delete(docRef);
        });
        console.log(`Successfully deleted ${deletes.length} duplicate/ghost records from Firestore.`);
    }

    console.log('FIRESTORE PERMANENT RESTORATION AND CLEANUP FINISHED SUCCESSFULLY!');
}

executePermanentFirebaseFix().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
