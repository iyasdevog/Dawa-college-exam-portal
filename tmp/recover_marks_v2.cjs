/**
 * ORPHANED MARKS RECOVERY SCRIPT
 * 
 * This script identifies what name each orphaned subject ID had (by inspecting 
 * which CURRENT subjects were previously the "duplicate" of those orphaned IDs),
 * then remaps all student marks from orphaned IDs -> canonical IDs.
 * 
 * Strategy: We can reconstruct the ID->Name mapping by looking at what names 
 * the current canonical subjects have AND by reading a backup of the old subject list 
 * from the deduplication script run earlier.
 * 
 * Since we don't have the backup, we instead:
 * 1. For each orphaned ID, we look at which CLASS the affected students belong to
 * 2. We then find the canonical subject that covers that class and has the same/similar name
 * 3. Because the orphaned IDs were DUPLICATES of existing subjects, we can identify them
 *    by cross-referencing: the orphaned ID had mark data for students in class X -> 
 *    find the canonical subject for that class
 * 
 * More direct approach: re-run the name resolution by fetching what 
 * the old duplicate subjects were BEFORE deletion (from git history / backup).
 * Since we saved the backup in tmp/ earlier, let's use that.
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch } = require('firebase/firestore');
const fs = require('fs');

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

function normName(name) {
    return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

async function runBatched(items, opFn, batchSize = 400) {
    if (!items.length) return;
    let batch = writeBatch(db);
    let count = 0;
    for (let i = 0; i < items.length; i++) {
        opFn(batch, items[i]);
        count++;
        if (count >= batchSize || i === items.length - 1) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
        }
    }
}

async function recover() {
    console.log('=== ORPHANED MARKS FULL RECOVERY ===\n');

    // Load canonical subjects
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const canonicals = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const subjectById = new Map(canonicals.map(s => [s.id, s]));
    
    console.log(`Canonical subjects: ${canonicals.length}`);

    // The orphaned IDs — we need to map them to canonical subjects.
    // Strategy: For each orphaned ID, look at which classes its students are in,
    // then find canonical subjects assigned to those same classes.
    // Since each orphaned ID was a duplicate of a canonical subject,
    // there should be a 1:1 mapping based on class context.

    // Step 1: Gather all orphaned IDs and what classes their students belong to
    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ ref: d.ref, ...d.data() }));
    
    console.log(`Students: ${students.length}`);

    // Map: orphanedId -> Map<className, count> 
    // Map: orphanedId -> Map<termKey, count>
    const orphanContext = new Map(); // orphanId -> { classes: {}, terms: {}, markSamples: [] }

    students.forEach(s => {
        const history = s.academicHistory || {};
        Object.keys(history).forEach(termKey => {
            const marks = history[termKey]?.marks || {};
            Object.keys(marks).forEach(subId => {
                if (!subjectById.has(subId)) {
                    if (!orphanContext.has(subId)) {
                        orphanContext.set(subId, { classes: {}, terms: {}, markSamples: [] });
                    }
                    const ctx = orphanContext.get(subId);
                    const cls = s.className || s.currentClass || '?';
                    ctx.classes[cls] = (ctx.classes[cls] || 0) + 1;
                    ctx.terms[termKey] = (ctx.terms[termKey] || 0) + 1;
                    if (ctx.markSamples.length < 2) {
                        ctx.markSamples.push({ adNo: s.adNo, cls, total: marks[subId]?.total });
                    }
                }
            });
        });
    });

    console.log(`\nOrphaned IDs: ${orphanContext.size}`);

    // Step 2: Build a class-level subject mapping
    // For each class, what canonical subjects cover it?
    const classToSubjects = new Map();
    canonicals.forEach(s => {
        (s.targetClasses || []).forEach(cls => {
            if (!classToSubjects.has(cls)) classToSubjects.set(cls, []);
            classToSubjects.get(cls).push(s);
        });
    });

    // Step 3: Try to resolve each orphaned ID to a canonical subject
    // For each orphaned ID:
    //   - Find the most common class associated with that orphan
    //   - Among canonical subjects for that class, try to find one that:
    //     a) Is NOT already covered by another orphan for the same class (to avoid collisions)
    //     b) Has a similar name to the orphan ID (if orphan ID looks like a name)
    // 
    // Since we know the orphans were exact duplicates from the dedup script,
    // we'll use the "per-class, per-term slot" approach:
    // For the students in class X with orphan ID Y, find canonical subject Z for class X
    // that those students DON'T already have marks for in that term -> that's our match.

    const orphanToCanonical = new Map();
    const unresolvable = [];

    orphanContext.forEach((ctx, orphanId) => {
        // Get most common class
        const classByCount = Object.entries(ctx.classes).sort((a, b) => b[1] - a[1]);
        const primaryClass = classByCount[0]?.[0];
        const primaryTerm = Object.entries(ctx.terms).sort((a, b) => b[1] - a[1])[0]?.[0];

        // Get canonical subjects for the primary class
        const classSubjects = classToSubjects.get(primaryClass) || [];

        // Find which canonical subjects these students already have marks for (valid IDs)
        // For the primary term, find students in primaryClass and check which subjects they have marks for
        const coveredCanonicalIds = new Set();
        students
            .filter(s => (s.className === primaryClass || s.currentClass === primaryClass))
            .forEach(s => {
                const marks = s.academicHistory?.[primaryTerm]?.marks || {};
                Object.keys(marks).forEach(k => {
                    if (subjectById.has(k)) coveredCanonicalIds.add(k);
                });
            });

        // The orphaned subject must be one of the class subjects NOT in coveredCanonicalIds
        // OR one that is less common in coveredCanonicalIds
        const uncoveredSubjects = classSubjects.filter(s => !coveredCanonicalIds.has(s.id));
        
        if (uncoveredSubjects.length === 1) {
            orphanToCanonical.set(orphanId, uncoveredSubjects[0]);
            console.log(`  RESOLVED: [${orphanId}] -> "${uncoveredSubjects[0].name}" [${uncoveredSubjects[0].id}] (class=${primaryClass})`);
        } else if (uncoveredSubjects.length > 1) {
            // Multiple candidates - pick by term/semester match
            const termSem = primaryTerm?.split('-').pop(); // Odd/Even
            const semMatch = uncoveredSubjects.filter(s => 
                !s.activeSemester || s.activeSemester === 'Both' || s.activeSemester === termSem
            );
            if (semMatch.length === 1) {
                orphanToCanonical.set(orphanId, semMatch[0]);
                console.log(`  RESOLVED (sem): [${orphanId}] -> "${semMatch[0].name}" [${semMatch[0].id}] (class=${primaryClass})`);
            } else {
                unresolvable.push({ orphanId, ctx, candidates: uncoveredSubjects.map(s => s.name) });
                console.log(`  AMBIGUOUS: [${orphanId}] | class=${primaryClass} | candidates: ${uncoveredSubjects.map(s=>s.name).join(', ')}`);
            }
        } else {
            // All covered - need alternate strategy: find the subject for this class 
            // that is also used as an orphaned ID by other students but not this one
            unresolvable.push({ orphanId, ctx, candidates: classSubjects.map(s => s.name) });
            console.log(`  UNRESOLVED: [${orphanId}] | class=${primaryClass} | all class subjects already covered`);
        }
    });

    console.log(`\nResolved: ${orphanToCanonical.size} / ${orphanContext.size}`);
    console.log(`Unresolvable: ${unresolvable.length}`);

    if (orphanToCanonical.size === 0) {
        console.log('\nNo automatic resolutions possible. Need manual mapping.');
        console.log('Please check the output above and create manual mappings.');
        return;
    }

    // Step 4: Apply the remapping to all student documents
    console.log('\nApplying remappings to student documents...');
    
    const updates = [];
    let totalReplacedKeys = 0;

    students.forEach(s => {
        const history = JSON.parse(JSON.stringify(s.academicHistory || {}));
        let changed = false;

        Object.keys(history).forEach(termKey => {
            if (!history[termKey]?.marks) return;
            const marks = history[termKey].marks;
            const newMarks = {};
            
            Object.keys(marks).forEach(subId => {
                const canonical = orphanToCanonical.get(subId);
                if (canonical) {
                    // Redirect: use canonical ID
                    const canonId = canonical.id;
                    if (!newMarks[canonId]) {
                        // Only add if canonical doesn't already have a mark (avoid overwriting better data)
                        newMarks[canonId] = marks[subId];
                        changed = true;
                        totalReplacedKeys++;
                    } else {
                        // Canonical already exists - keep the one with higher total
                        if ((marks[subId]?.total || 0) > (newMarks[canonId]?.total || 0)) {
                            newMarks[canonId] = marks[subId];
                            changed = true;
                        }
                    }
                } else {
                    // Keep as-is
                    newMarks[subId] = marks[subId];
                }
            });

            history[termKey] = { ...history[termKey], marks: newMarks };
        });

        if (changed) {
            updates.push({ ref: s.ref, payload: { academicHistory: history }, adNo: s.adNo });
        }
    });

    console.log(`Students to update: ${updates.length}, mark entries to remap: ${totalReplacedKeys}`);

    if (updates.length > 0) {
        await runBatched(updates, (batch, item) => {
            batch.update(item.ref, item.payload);
        });
        console.log(`\n✅ Successfully updated ${updates.length} student documents.`);
    } else {
        console.log('\nNo updates needed.');
    }
}

recover().then(() => process.exit(0)).catch(err => { console.error('Error:', err); process.exit(1); });
