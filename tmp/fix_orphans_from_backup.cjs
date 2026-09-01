/**
 * DEFINITIVE ORPHAN FIX USING BACKUP FILE
 * Uses the April 4th master backup to get the original subject names for orphaned IDs,
 * then rebuilds the exact idRedirectMap that the dedup script used,
 * and finally properly remaps all student marks.
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

async function fix() {
    console.log('=== DEFINITIVE ORPHAN FIX (using backup) ===\n');

    // Load backup file
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-04-04T04-11-10.json');
    if (!fs.existsSync(backupPath)) {
        console.error('Backup file not found at:', backupPath);
        return;
    }

    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    // Find subjects in backup - try different keys
    let backupSubjects = null;
    for (const key of Object.keys(backup)) {
        const val = backup[key];
        if (Array.isArray(val) && val.length > 0 && val[0].name && (val[0].targetClasses || val[0].subjectType)) {
            backupSubjects = val;
            console.log(`Found subjects under key: "${key}" (${val.length} subjects)`);
            break;
        }
    }

    if (!backupSubjects) {
        console.log('Backup keys:', Object.keys(backup).map(k => `${k}: ${Array.isArray(backup[k]) ? backup[k].length + ' items' : typeof backup[k]}`));
        
        // Try to find subjects nested differently
        for (const key of Object.keys(backup)) {
            if (key.toLowerCase().includes('subject')) {
                console.log(`Checking key "${key}":`, JSON.stringify(backup[key]).slice(0, 200));
            }
        }
        return;
    }

    console.log(`Backup subjects: ${backupSubjects.length}\n`);

    // Build normName -> best canonical ID map (same logic as dedup script)
    // Load current canonical subjects
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const currentSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const currentSubjectById = new Map(currentSubjects.map(s => [s.id, s]));
    const currentIdSet = new Set(currentSubjectById.keys());

    // Group backup subjects by normalized name (same as dedup script)
    const nameToBackupGroup = new Map();
    backupSubjects.forEach(s => {
        const n = normName(s.name);
        if (!n) return;
        if (!nameToBackupGroup.has(n)) nameToBackupGroup.set(n, []);
        nameToBackupGroup.get(n).push(s);
    });

    // Build the idRedirectMap: for each group, find which backup IDs were "deleted" 
    // (i.e., not in current canonical set) -> those map to the surviving canonical
    const idRedirectMap = new Map(); // orphanedId -> canonicalId

    nameToBackupGroup.forEach((records, normN) => {
        if (records.length <= 1) return; // No duplicates in backup for this name

        // Find which record survived (is still in current DB)
        const survivors = records.filter(r => r.id && currentIdSet.has(r.id));
        const orphans = records.filter(r => r.id && !currentIdSet.has(r.id));

        if (survivors.length === 0) {
            // No survivor found from backup IDs... the current DB might have a different ID
            // Try to match by name
            const matchingCurrent = currentSubjects.find(cs => normName(cs.name) === normN);
            if (matchingCurrent) {
                orphans.forEach(r => {
                    if (r.id) idRedirectMap.set(r.id, matchingCurrent.id);
                });
            }
        } else {
            // Use the best survivor (prefer activeSemester: 'Both')
            let bestSurvivor = survivors[0];
            survivors.forEach(s => { if (s.activeSemester === 'Both') bestSurvivor = s; });
            
            orphans.forEach(r => {
                if (r.id) idRedirectMap.set(r.id, bestSurvivor.id);
            });
        }
    });

    // Also handle orphaned IDs that appear in student marks but aren't in any backup group
    // (these might be from another source)
    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ ref: d.ref, ...d.data() }));

    // Collect all orphaned IDs actually in use
    const allOrphanedInUse = new Set();
    students.forEach(s => {
        Object.values(s.academicHistory || {}).forEach(term => {
            Object.keys(term?.marks || {}).forEach(k => {
                if (!currentIdSet.has(k)) allOrphanedInUse.add(k);
            });
        });
    });

    console.log(`Orphaned IDs in student marks: ${allOrphanedInUse.size}`);
    console.log(`Resolved via backup: ${[...allOrphanedInUse].filter(id => idRedirectMap.has(id)).length}`);
    
    const stillUnresolved = [...allOrphanedInUse].filter(id => !idRedirectMap.has(id));
    if (stillUnresolved.length > 0) {
        console.log(`Still unresolved: ${stillUnresolved.length} IDs`);
        // Try matching by the backup subject that has matching ID directly
        stillUnresolved.forEach(orphanId => {
            const inBackup = backupSubjects.find(s => s.id === orphanId);
            if (inBackup) {
                console.log(`  Found in backup: [${orphanId}] = "${inBackup.name}"`);
                const canonMatch = currentSubjects.find(cs => normName(cs.name) === normName(inBackup.name));
                if (canonMatch) {
                    idRedirectMap.set(orphanId, canonMatch.id);
                    console.log(`    -> Mapped to canonical: "${canonMatch.name}" [${canonMatch.id}]`);
                } else {
                    console.log(`    -> No canonical match found for "${inBackup.name}"`);
                }
            } else {
                console.log(`  NOT in backup: [${orphanId}] - completely unknown`);
            }
        });
    }

    console.log('\nFull redirect map:');
    idRedirectMap.forEach((canonId, orphanId) => {
        const canonName = currentSubjectById.get(canonId)?.name || '???';
        console.log(`  [${orphanId}] -> "${canonName}" [${canonId}]`);
    });

    const finalResolvedCount = [...allOrphanedInUse].filter(id => idRedirectMap.has(id)).length;
    console.log(`\nFinal resolution: ${finalResolvedCount}/${allOrphanedInUse.size} orphaned IDs resolved`);

    if (idRedirectMap.size === 0) {
        console.log('Nothing to fix.');
        return;
    }

    // Apply remappings to all students
    console.log('\nApplying remappings...');
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
                const canonId = idRedirectMap.get(subId) || subId;
                if (canonId !== subId) {
                    changed = true;
                    totalFixed++;
                    // Merge: keep higher total if canonical already exists
                    if (!newMarks[canonId] || (marks[subId]?.total || 0) > (newMarks[canonId]?.total || 0)) {
                        newMarks[canonId] = marks[subId];
                    }
                } else {
                    if (!newMarks[subId]) newMarks[subId] = marks[subId];
                }
            });

            history[termKey] = { ...history[termKey], marks: newMarks };
        });

        if (changed) {
            updates.push({ ref: s.ref, payload: { academicHistory: history }, adNo: s.adNo });
        }
    });

    console.log(`Students to update: ${updates.length}, mark entries to remap: ${totalFixed}`);

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
            }
        }
        console.log(`\n✅ Done! Fixed ${totalFixed} mark entries across ${updates.length} student documents.`);
    }
}

fix().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
