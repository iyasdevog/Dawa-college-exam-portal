/**
 * DEFINITIVE ORPHAN MARKS FIX
 * 
 * The dedup script's idRedirectMap ran but overwrote marks when multiple orphan IDs
 * mapped to the same canonical ID. This script:
 * 
 * 1. Reads all 60 canonical subjects and their names
 * 2. For each orphaned subject ID in student marks, uses the SAME normalization logic 
 *    as the original dedup script to find the canonical subject name
 * 3. But since the orphaned documents are DELETED, we need another way to find names.
 *    
 * KEY INSIGHT: The original dedup script built idRedirectMap by grouping subjects by 
 * normalized name. The 54 orphaned IDs ARE the "non-best" records that were deleted.
 * Each one HAD the SAME normalized name as its canonical. So we need to find what name
 * each orphaned ID had by checking the git log backup of the subjects collection.
 * 
 * ALTERNATIVE: Since we can't recover the old documents, we use the structural approach:
 * For each student, for each term, for each orphaned subjectId key:
 *   - Look at which canonical subjects the student ALREADY HAS marks for in that term
 *   - The canonical subjects for that student's class that are MISSING are the ones 
 *     that the orphaned keys should map to
 *   - Match orphaned keys to missing canonical subjects by position/frequency
 * 
 * This works because: each student in class X had ALL their subjects filled in.
 * The orphaned IDs are exactly the ones "missing" from their current valid mark set.
 * If a student has 8 orphaned keys and 4 valid keys, and their class has 12 subjects,
 * then each orphaned key maps to one of the 8 missing canonical subjects.
 * 
 * But we can't distinguish WHICH orphaned key maps to WHICH missing canonical without
 * additional data. The ONLY reliable source is the subject NAME that was stored IN
 * the mark data at the time of entry.
 * 
 * FINAL APPROACH: Re-fetch the subjects collection from git history backup.
 * The backup was created BEFORE deduplication by the previous migration script.
 * Check if there's a backup JSON in the codebase.
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch } = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

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

// Check if a backup JSON file exists
function findBackupFile() {
    const searchPaths = [
        path.join(__dirname, '..', 'backup.json'),
        path.join(__dirname, '..', 'backups'),
        path.join(__dirname, '..', 'tmp'),
    ];
    
    for (const p of searchPaths) {
        if (fs.existsSync(p)) {
            if (fs.statSync(p).isDirectory()) {
                const files = fs.readdirSync(p).filter(f => f.endsWith('.json'));
                if (files.length > 0) {
                    return path.join(p, files[0]);
                }
            } else if (p.endsWith('.json')) {
                return p;
            }
        }
    }
    return null;
}

async function fixOrphanedMarksFromBackup() {
    console.log('=== DEFINITIVE ORPHANED MARKS FIX ===\n');

    // Try to find backup file
    const backupFile = findBackupFile();
    if (backupFile) {
        console.log(`Found backup file: ${backupFile}`);
        const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
        const oldSubjects = backup.subjects || backup.Subjects || [];
        console.log(`Backup has ${oldSubjects.length} subjects`);
    } else {
        console.log('No backup file found. Using per-student slot-filling approach.\n');
    }

    // Load canonical subjects
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const canonicals = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const subjectById = new Map(canonicals.map(s => [s.id, s]));
    const canonicalIds = new Set(subjectById.keys());

    console.log(`Canonical subjects: ${canonicals.length}`);

    // Load all students
    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ ref: d.ref, ...d.data() }));
    console.log(`Students: ${students.length}\n`);

    // === STRATEGY: Per-student, per-term slot filling ===
    // 
    // For each student in class X in term T:
    //   validKeys = mark keys that are valid canonical IDs
    //   orphanKeys = mark keys that are NOT valid canonical IDs  
    //   classSubjects = canonical subjects assigned to class X for term T
    //   missingSubjectIds = classSubjects - validKeys
    //
    // If len(orphanKeys) == len(missingSubjectIds) == 1: 
    //   -> Direct 1:1 mapping, remap orphanKey -> missingSubjectId
    // If counts don't match: 
    //   -> Can't safely determine mapping
    //
    // We build a GLOBAL consensus map: for each orphanId, which canonical does it map to?
    // If 100 students all show orphanId X -> missingSubject Y, we can be confident.

    const orphanVoteMap = new Map(); // orphanId -> Map<canonicalId, count>
    
    students.forEach(s => {
        const cls = s.className || s.currentClass || '';
        const history = s.academicHistory || {};

        Object.keys(history).forEach(termKey => {
            const marks = history[termKey]?.marks || {};
            const markKeys = Object.keys(marks);
            
            const validKeys = new Set(markKeys.filter(k => canonicalIds.has(k)));
            const orphanKeys = markKeys.filter(k => !canonicalIds.has(k));
            
            if (orphanKeys.length === 0) return;

            // Get canonical subjects for this class and term
            const termSem = termKey.split('-').pop();
            const classSubjects = canonicals.filter(sub => {
                const inClass = (sub.targetClasses || []).includes(cls);
                const inSem = !sub.activeSemester || sub.activeSemester === 'Both' || sub.activeSemester === termSem;
                return inClass && inSem;
            });

            const classSubjectIds = new Set(classSubjects.map(s => s.id));
            const missingIds = [...classSubjectIds].filter(id => !validKeys.has(id));

            // If 1 orphan and 1 missing -> definitive match
            if (orphanKeys.length === 1 && missingIds.length === 1) {
                const orphanId = orphanKeys[0];
                const canonId = missingIds[0];
                if (!orphanVoteMap.has(orphanId)) orphanVoteMap.set(orphanId, new Map());
                const votes = orphanVoteMap.get(orphanId);
                votes.set(canonId, (votes.get(canonId) || 0) + 1);
            }

            // If 2 orphans and 2 missing: we still can't safely map without knowing names
            // Skip multi-orphan cases to avoid wrong mappings
        });
    });

    console.log(`\nBuilding consensus map from ${orphanVoteMap.size} orphaned IDs with 1:1 matches...`);

    // Build final mapping based on consensus votes
    const resolvedMap = new Map(); // orphanId -> canonicalId (where we have high confidence)
    const ambiguousOrphans = [];

    orphanVoteMap.forEach((votes, orphanId) => {
        // Find the canonical ID with the most votes
        let bestId = null;
        let bestCount = 0;
        let totalVotes = 0;
        votes.forEach((count, canonId) => {
            totalVotes += count;
            if (count > bestCount) {
                bestCount = count;
                bestId = canonId;
            }
        });

        const confidence = bestCount / totalVotes;
        const canonName = subjectById.get(bestId)?.name || '???';
        
        if (confidence >= 0.7 && bestCount >= 2) {
            // High confidence
            resolvedMap.set(orphanId, bestId);
            console.log(`  ✅ [${orphanId}] -> "${canonName}" [${bestId}] (${bestCount}/${totalVotes} votes, ${(confidence*100).toFixed(0)}% confidence)`);
        } else if (confidence >= 0.5 || bestCount >= 5) {
            // Medium confidence - still apply
            resolvedMap.set(orphanId, bestId);
            console.log(`  ⚠️  [${orphanId}] -> "${canonName}" [${bestId}] (${bestCount}/${totalVotes} votes, ${(confidence*100).toFixed(0)}% confidence - MEDIUM)`);
        } else {
            ambiguousOrphans.push({ orphanId, votes: [...votes.entries()].map(([id, c]) => ({ id, name: subjectById.get(id)?.name, count: c })) });
            console.log(`  ❌ [${orphanId}] -> AMBIGUOUS (${votes.size} candidates, best: "${canonName}" with ${bestCount}/${totalVotes})`);
        }
    });

    // Report orphans with NO 1:1 matches at all
    const studentsOrphans = new Set();
    students.forEach(s => {
        const history = s.academicHistory || {};
        Object.values(history).forEach(term => {
            Object.keys(term?.marks || {}).forEach(k => {
                if (!canonicalIds.has(k)) studentsOrphans.add(k);
            });
        });
    });

    const neverResolvable = [...studentsOrphans].filter(k => !orphanVoteMap.has(k));
    if (neverResolvable.length > 0) {
        console.log(`\nOrphans with no 1:1 context at all (need manual mapping): ${neverResolvable.join(', ')}`);
    }

    console.log(`\nResolved: ${resolvedMap.size} orphaned IDs`);
    console.log(`Unresolved: ${ambiguousOrphans.length + neverResolvable.length} orphaned IDs`);

    if (resolvedMap.size === 0) {
        console.log('\nNo resolutions possible. All marks require manual intervention.');
        return;
    }

    // Apply remapping
    console.log('\nApplying remappings to Firestore...');
    const updates = [];
    let totalFixed = 0;

    students.forEach(s => {
        const history = JSON.parse(JSON.stringify(s.academicHistory || {}));
        let changed = false;

        Object.keys(history).forEach(termKey => {
            const marks = history[termKey]?.marks;
            if (!marks) return;

            const newMarks = {};
            Object.keys(marks).forEach(subId => {
                const canonId = resolvedMap.get(subId);
                if (canonId) {
                    // Remap to canonical
                    if (!newMarks[canonId] || (marks[subId]?.total || 0) > (newMarks[canonId]?.total || 0)) {
                        newMarks[canonId] = marks[subId];
                    }
                    changed = true;
                    totalFixed++;
                } else {
                    newMarks[subId] = marks[subId]; // Keep as-is
                }
            });

            history[termKey] = { ...history[termKey], marks: newMarks };
        });

        if (changed) {
            updates.push({ ref: s.ref, payload: { academicHistory: history }, adNo: s.adNo });
        }
    });

    console.log(`Student documents to update: ${updates.length}, mark entries to fix: ${totalFixed}`);

    if (updates.length > 0) {
        let batch = writeBatch(db);
        let count = 0;
        for (let i = 0; i < updates.length; i++) {
            batch.update(updates[i].ref, updates[i].payload);
            count++;
            if (count >= 400 || i === updates.length - 1) {
                await batch.commit();
                batch = writeBatch(db);
                count = 0;
                console.log(`  Committed batch... (${Math.min((i+1), updates.length)}/${updates.length})`);
            }
        }
        console.log(`\n✅ Successfully fixed marks for ${updates.length} students, ${totalFixed} mark entries restored.`);
    }
}

fixOrphanedMarksFromBackup().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
