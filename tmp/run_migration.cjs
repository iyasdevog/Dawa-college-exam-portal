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

async function runFullFirebaseMigration() {
    console.log('Starting PERMANENT FIREBASE DATABASE MIGRATION...');
    const result = { migratedStudents: 0, skippedStudents: 0, updatedSubjects: 0, details: [] };

    // 1. Process Students Collection
    console.log('Fetching students from Firestore...');
    const studentsSnap = await getDocs(collection(db, 'students'));
    console.log(`Found ${studentsSnap.docs.length} student records in Firestore.`);

    const studentsToMigrate = [];

    studentsSnap.docs.forEach(docSnap => {
        const data = docSnap.data();
        let needsUpdate = false;
        const academicHistory = { ...(data.academicHistory || {}) };
        
        const rawLegacyTerm = data.termKey || '2025-2026-Odd';
        const legacyTerm = (!rawLegacyTerm || rawLegacyTerm === '2025-Odd' || rawLegacyTerm === '2025') 
            ? '2025-2026-Odd' 
            : (rawLegacyTerm === '2025-Even' ? '2025-2026-Even' : rawLegacyTerm);
            
        const extraUpdates = {};

        // Top-level termKey & class normalization
        if (data.termKey && data.termKey !== legacyTerm) {
            extraUpdates.termKey = legacyTerm;
            needsUpdate = true;
        }

        const currentCls = data.currentClass || data.className || 'Unknown';
        if (!data.currentClass || !data.className || data.currentClass !== currentCls || data.className !== currentCls) {
            extraUpdates.currentClass = currentCls;
            extraUpdates.className = currentCls;
            needsUpdate = true;
        }

        // Migrate non-canonical history term keys (e.g. '2025-Odd' -> '2025-2026-Odd')
        Object.keys(academicHistory).forEach(tk => {
            const canonicalKey = (!tk || tk === '2025-Odd' || tk === '2025') 
                ? '2025-2026-Odd' 
                : (tk === '2025-Even' ? '2025-2026-Even' : tk);

            if (canonicalKey !== tk) {
                academicHistory[canonicalKey] = {
                    ...(academicHistory[canonicalKey] || {}),
                    ...academicHistory[tk]
                };
                delete academicHistory[tk];
                needsUpdate = true;
            }
        });

        // Normalize classNames, totals, and mark keys across all academicHistory entries
        Object.keys(academicHistory).forEach(termKey => {
            const entry = academicHistory[termKey];
            if (!entry) return;

            let entryChanged = false;
            let updatedEntry = { ...entry };

            // Normalize className (e.g. FS2 -> S1 for Odd terms)
            if (entry.className) {
                const normalizedCls = getHistoricalClassName(termKey, entry.className);
                if (normalizedCls !== entry.className) {
                    updatedEntry.className = normalizedCls;
                    entryChanged = true;
                }
            } else {
                updatedEntry.className = getHistoricalClassName(termKey, currentCls);
                entryChanged = true;
            }

            // Trim subject ID keys in marks map
            const marksMap = entry.marks || {};
            const cleanedMarks = {};
            let marksKeyChanged = false;

            Object.entries(marksMap).forEach(([subId, markData]) => {
                const trimmedId = subId.trim();
                cleanedMarks[trimmedId] = markData;
                if (trimmedId !== subId) marksKeyChanged = true;
            });

            if (marksKeyChanged) {
                updatedEntry.marks = cleanedMarks;
                entryChanged = true;
            }

            // Recalculate totals and performanceLevel if totals are 0 but marks exist
            const markValues = Object.values(updatedEntry.marks || {});
            if (markValues.length > 0) {
                let sum = 0;
                let validCount = 0;
                let failCount = 0;

                markValues.forEach(m => {
                    const subTotal = typeof m.total === 'number' ? m.total : ((Number(m.int) || 0) + (Number(m.ext) || 0));
                    sum += subTotal;
                    if (subTotal > 0 || m.int !== undefined || m.ext !== undefined) validCount++;
                    if (m.status === 'Failed') failCount++;
                });

                if ((updatedEntry.grandTotal === undefined || updatedEntry.grandTotal === 0) && sum > 0) {
                    updatedEntry.grandTotal = sum;
                    entryChanged = true;
                }
                if ((updatedEntry.average === undefined || updatedEntry.average === 0) && validCount > 0 && sum > 0) {
                    updatedEntry.average = Math.round((sum / validCount) * 10) / 10;
                    entryChanged = true;
                }
                if ((!updatedEntry.performanceLevel || updatedEntry.performanceLevel === 'Pending' || updatedEntry.performanceLevel === 'Not Assessed') && sum > 0) {
                    updatedEntry.performanceLevel = failCount > 0 ? 'Failed' : 'Passed';
                    entryChanged = true;
                }
            }

            if (entryChanged) {
                academicHistory[termKey] = updatedEntry;
                needsUpdate = true;
            }
        });

        // Migrate legacy top-level marks into academicHistory[legacyTerm]
        if (data.marks && Object.keys(data.marks).length > 0) {
            const existingHistoryEntry = academicHistory[legacyTerm] || {};
            const historyHasMarks = existingHistoryEntry.marks && Object.keys(existingHistoryEntry.marks).length > 0;

            if (!historyHasMarks) {
                const semesterType = legacyTerm.endsWith('-Odd') ? 'Odd' : 'Even';
                const rawClassName = existingHistoryEntry.className || currentCls;
                const resolvedClassName = getHistoricalClassName(legacyTerm, rawClassName);

                const cleanedTopMarks = {};
                Object.entries(data.marks).forEach(([k, v]) => {
                    cleanedTopMarks[k.trim()] = v;
                });

                let calculatedTotal = data.grandTotal || 0;
                let calculatedAverage = data.average || 0;
                let failCount = 0;
                let validCount = 0;

                if (calculatedTotal === 0) {
                    let sum = 0;
                    Object.values(cleanedTopMarks).forEach(m => {
                        const subTotal = typeof m.total === 'number' ? m.total : ((Number(m.int) || 0) + (Number(m.ext) || 0));
                        sum += subTotal;
                        if (subTotal > 0 || m.int !== undefined || m.ext !== undefined) validCount++;
                        if (m.status === 'Failed') failCount++;
                    });
                    calculatedTotal = sum;
                    calculatedAverage = validCount > 0 ? Math.round((sum / validCount) * 10) / 10 : 0;
                }

                const performanceLevel = data.performanceLevel ||
                    (calculatedTotal > 0 ? (failCount > 0 ? 'Failed' : 'Passed') : 'Pending');

                academicHistory[legacyTerm] = {
                    ...existingHistoryEntry,
                    className: resolvedClassName,
                    semester: existingHistoryEntry.semester || semesterType,
                    marks: cleanedTopMarks,
                    grandTotal: calculatedTotal,
                    average: calculatedAverage,
                    rank: existingHistoryEntry.rank || data.rank || 0,
                    performanceLevel,
                };
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            studentsToMigrate.push({ docRef: docSnap.ref, data, legacyTerm, updatedHistory: academicHistory, extraUpdates });
        } else {
            result.skippedStudents++;
        }
    });

    console.log(`Students needing permanent database update: ${studentsToMigrate.length}`);

    if (studentsToMigrate.length > 0) {
        await runBatchedOperation(studentsToMigrate, (batch, item) => {
            batch.update(item.docRef, {
                academicHistory: item.updatedHistory,
                ...item.extraUpdates
            });
            result.migratedStudents++;
            const adNo = item.data.adNo || item.data.id;
            const histCls = item.updatedHistory[item.legacyTerm]?.className || 'Updated';
            result.details.push(`Updated Student ${adNo} (${histCls}) -> ${item.legacyTerm}`);
        });
        console.log(`Updated ${result.migratedStudents} student documents in Firestore.`);
    }

    // 2. Process Subjects Collection
    console.log('Fetching subjects from Firestore...');
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    console.log(`Found ${subjectsSnap.docs.length} subjects in Firestore.`);

    const subjectUpdates = [];
    subjectsSnap.docs.forEach(subDoc => {
        const sub = subDoc.data();
        if (!sub || !sub.targetClasses || sub.targetClasses.length === 0) return;

        const expandedSet = new Set();
        let changed = false;

        sub.targetClasses.forEach(tc => {
            if (!tc) return;
            expandedSet.add(tc);
            const hist = getHistoricalClassName('2025-2026-Odd', tc);
            const dbCls = getDatabaseClassName('2025-2026-Odd', tc);
            if (hist && hist !== tc && !sub.targetClasses.includes(hist)) {
                expandedSet.add(hist);
                changed = true;
            }
            if (dbCls && dbCls !== tc && !sub.targetClasses.includes(dbCls)) {
                expandedSet.add(dbCls);
                changed = true;
            }
        });

        if (changed) {
            subjectUpdates.push({
                docRef: subDoc.ref,
                targetClasses: Array.from(expandedSet),
                id: subDoc.id,
                name: sub.name
            });
        }
    });

    console.log(`Subjects needing targetClasses normalization: ${subjectUpdates.length}`);
    if (subjectUpdates.length > 0) {
        await runBatchedOperation(subjectUpdates, (batch, item) => {
            batch.update(item.docRef, { targetClasses: item.targetClasses });
            result.updatedSubjects++;
            result.details.push(`Normalized Subject: ${item.name} (${item.id}) -> [${item.targetClasses.join(', ')}]`);
        });
        console.log(`Updated ${result.updatedSubjects} subjects in Firestore.`);
    }

    console.log('PERMANENT FIREBASE DATABASE MIGRATION COMPLETED SUCCESSFULLY!');
    console.log(JSON.stringify({
        migratedStudents: result.migratedStudents,
        skippedStudents: result.skippedStudents,
        updatedSubjects: result.updatedSubjects,
        sampleDetails: result.details.slice(0, 15)
    }, null, 2));
}

runFullFirebaseMigration().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
