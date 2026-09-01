const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch } = require('firebase/firestore');

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
    if (items.length === 0) return;
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

function normalizeName(name) {
    return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function recoverOrphanedMarks() {
    console.log('=== ORPHANED MARKS RECOVERY ===\n');

    // 1. Load all current subject documents (canonical set)
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const canonicalSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`Current subjects in Firestore: ${canonicalSubjects.length}`);

    // Build lookup maps
    const subjectById = new Map(canonicalSubjects.map(s => [s.id, s]));
    const subjectByName = new Map(canonicalSubjects.map(s => [normalizeName(s.name), s]));

    console.log('\nCurrent canonical subjects:');
    canonicalSubjects.forEach(s => {
        console.log(`  [${s.id}] "${s.name}"`);
    });

    // 2. Scan all students for orphaned mark keys
    const studentsSnap = await getDocs(collection(db, 'students'));
    console.log(`\nScanning ${studentsSnap.docs.length} student documents for orphaned mark IDs...`);

    let totalOrphanedKeys = 0;
    let totalRedirections = 0;
    let totalUnresolvable = 0;
    const unresolvedKeys = new Set();
    const updates = [];

    studentsSnap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const academicHistory = { ...(data.academicHistory || {}) };
        let changed = false;

        const remapMarks = (marksMap) => {
            if (!marksMap || typeof marksMap !== 'object') return marksMap;
            const newMarks = { ...marksMap };

            Object.keys(marksMap).forEach(subId => {
                const trimmedId = subId.trim();

                // Check if this key exists in canonical subjects
                if (!subjectById.has(trimmedId)) {
                    totalOrphanedKeys++;

                    // Try to find by subject name stored in mark metadata
                    let foundCanonical = null;

                    // Strategy 1: Try to match by name stored in the mark data itself
                    const markData = marksMap[subId];
                    if (markData && markData.subjectName) {
                        foundCanonical = subjectByName.get(normalizeName(markData.subjectName));
                    }

                    // Strategy 2: Try to match by the subject ID itself as a name
                    if (!foundCanonical) {
                        foundCanonical = subjectByName.get(normalizeName(trimmedId));
                    }

                    // Strategy 3: Fuzzy partial name match
                    if (!foundCanonical) {
                        const searchTerm = normalizeName(trimmedId).replace(/subj_/g, '').replace(/_/g, ' ');
                        for (const [canonName, canonSubject] of subjectByName.entries()) {
                            if (canonName.includes(searchTerm) || searchTerm.includes(canonName)) {
                                foundCanonical = canonSubject;
                                break;
                            }
                        }
                    }

                    if (foundCanonical) {
                        const canonicalId = foundCanonical.id;
                        if (canonicalId !== trimmedId) {
                            // Merge: don't overwrite if canonical already has marks
                            if (!newMarks[canonicalId]) {
                                newMarks[canonicalId] = newMarks[subId];
                            }
                            delete newMarks[subId];
                            if (trimmedId !== subId) delete newMarks[subId];
                            changed = true;
                            totalRedirections++;
                        }
                    } else {
                        unresolvedKeys.add(trimmedId);
                        totalUnresolvable++;
                    }
                }
            });
            return newMarks;
        };

        // Remap marks in academicHistory
        Object.keys(academicHistory).forEach(tk => {
            if (academicHistory[tk]?.marks) {
                const remapped = remapMarks(academicHistory[tk].marks);
                if (remapped !== academicHistory[tk].marks) {
                    academicHistory[tk] = { ...academicHistory[tk], marks: remapped };
                    changed = true;
                }
            }
        });

        if (changed) {
            const payload = { academicHistory };
            updates.push({ docRef: docSnap.ref, payload, adNo: data.adNo });
        }
    });

    console.log(`\n=== ANALYSIS RESULTS ===`);
    console.log(`Total orphaned mark keys found: ${totalOrphanedKeys}`);
    console.log(`Successfully resolved redirections: ${totalRedirections}`);
    console.log(`Unresolvable keys (no matching subject): ${totalUnresolvable}`);
    if (unresolvedKeys.size > 0) {
        console.log(`Unresolved subject IDs/names:`, Array.from(unresolvedKeys).slice(0, 20));
    }
    console.log(`Student documents needing update: ${updates.length}`);

    if (updates.length > 0) {
        console.log('\nApplying updates to Firestore...');
        await runBatchedOperation(updates, (batch, item) => {
            batch.update(item.docRef, item.payload);
        });
        console.log(`\n✅ Successfully updated ${updates.length} student documents.`);
        console.log('Sample updated students:');
        updates.slice(0, 10).forEach(u => console.log(`  - Student AdNo: ${u.adNo}`));
    } else {
        console.log('\n✅ No updates needed — all mark keys already point to valid subjects.');
    }
}

recoverOrphanedMarks().then(() => process.exit(0)).catch(err => { console.error('Error:', err); process.exit(1); });
