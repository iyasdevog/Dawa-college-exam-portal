/**
 * FINAL PASS: Map remaining 19 unknown orphaned IDs.
 * These IDs were NOT in the April 4th backup — they are subjects added AFTER that backup.
 * Strategy: For each orphaned ID, look at the class context of affected students,
 * then find which canonical subject for that class is underrepresented in their marks.
 * 
 * These 19 IDs are:
 * KBXPOtrBVu3jLWaJrZte -> D2 students (16)
 * DJNcLCbws7PxXSalIpn2 -> FS2 students (22)
 * 6gZ0p8rH9re48nlfDaWr -> FS2 students (11)
 * mlydwG0sUYlgkuCS8lmm -> FS3 students (17)
 * DWxOlk9Ou3P0PprN7R87 -> FS3 students (17)
 * q9cNijWYCAvvqfCWraZx -> FS3+D3 students (37)
 * v1eqpVhe9zwBenNqz5nL -> 1 D2 student
 * CP73DIkL4tGuX8pgH6JU -> 1 D2 student
 * isD46zCmRaYAd39HY0Mn -> PG1 students (9)
 * zjfIw4gLzhZUwNgljmsa -> PG-F+D3 students (5)
 * V9xt5WnO1bSvKLoW112r -> HS3 students (14)
 * AlbtqudvSom1OmhpBhnU -> HS2 students (11)
 * ogRtcFJD6xHPPvmyyGfb -> HS2 students (20)
 * qONeFnfq8xP7dXSUlboO -> FS2 students (5)
 * hXwj90u3pLUzQh5pkhcS -> D3+FS3 students (4)
 * kbGr9LuXzpvE3Ws0PiE5 -> HS2+HS3 students (2)
 * qPqFCSR8H6Gvx9nQbacG -> 1 FS2 student
 * 48Y8E2bjeFlypuIjaFfY -> 1 HS1 student
 * XZ8Sl65cKfzW03J4YhPg -> 1 HS3 student
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, writeBatch } = require('firebase/firestore');

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

function normName(n) { return (n||'').trim().toLowerCase().replace(/\s+/g,' '); }

async function finalFix() {
    console.log('=== FINAL PASS: Map remaining 19 orphaned IDs ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const canonicals = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const subjectById = new Map(canonicals.map(s => [s.id, s]));
    const canonicalIds = new Set(subjectById.keys());

    // Build class->canonical subjects map
    const classToSubjects = new Map();
    canonicals.forEach(s => {
        (s.targetClasses || []).forEach(cls => {
            if (!classToSubjects.has(cls)) classToSubjects.set(cls, []);
            classToSubjects.get(cls).push(s);
        });
    });

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ ref: d.ref, ...d.data() }));

    // ANALYSIS: For each orphaned ID, find the "most missing" canonical subject
    // across all students that have this orphan.
    // The most missing = the canonical subject that appears LEAST often as a valid key
    // in the marks of students who ALSO have this orphan key.
    
    const remainingOrphans = [
        'KBXPOtrBVu3jLWaJrZte','DJNcLCbws7PxXSalIpn2','6gZ0p8rH9re48nlfDaWr',
        'mlydwG0sUYlgkuCS8lmm','DWxOlk9Ou3P0PprN7R87','q9cNijWYCAvvqfCWraZx',
        'v1eqpVhe9zwBenNqz5nL','CP73DIkL4tGuX8pgH6JU','isD46zCmRaYAd39HY0Mn',
        'zjfIw4gLzhZUwNgljmsa','V9xt5WnO1bSvKLoW112r','AlbtqudvSom1OmhpBhnU',
        'ogRtcFJD6xHPPvmyyGfb','qONeFnfq8xP7dXSUlboO','hXwj90u3pLUzQh5pkhcS',
        'kbGr9LuXzpvE3Ws0PiE5','qPqFCSR8H6Gvx9nQbacG','48Y8E2bjeFlypuIjaFfY',
        'XZ8Sl65cKfzW03J4YhPg'
    ];
    const remainingSet = new Set(remainingOrphans);

    // For each orphan, find which canonical subjects appear ZERO times in students with this orphan
    const orphanToCanonical = new Map();

    remainingOrphans.forEach(orphanId => {
        // Find all students with this orphan and their terms
        const affectedStudentTerms = [];
        students.forEach(s => {
            Object.keys(s.academicHistory || {}).forEach(termKey => {
                const marks = s.academicHistory[termKey]?.marks || {};
                if (marks[orphanId] !== undefined) {
                    affectedStudentTerms.push({
                        student: s,
                        termKey,
                        validMarkKeys: new Set(Object.keys(marks).filter(k => canonicalIds.has(k)))
                    });
                }
            });
        });

        if (affectedStudentTerms.length === 0) return;

        // Get primary class of affected students
        const classCounts = {};
        affectedStudentTerms.forEach(({ student }) => {
            const cls = student.className || student.currentClass || '?';
            classCounts[cls] = (classCounts[cls] || 0) + 1;
        });
        const primaryClass = Object.entries(classCounts).sort((a,b) => b[1]-a[1])[0][0];
        const primaryTerm = affectedStudentTerms[0].termKey;
        const termSem = primaryTerm.split('-').pop();

        // Get class subjects for that class+semester
        const classSubjects = (classToSubjects.get(primaryClass) || []).filter(s => {
            return !s.activeSemester || s.activeSemester === 'Both' || s.activeSemester === termSem;
        });

        // For each class subject, count how many affected students DON'T have it as a valid key
        const absenceCount = new Map();
        classSubjects.forEach(s => absenceCount.set(s.id, 0));

        affectedStudentTerms.forEach(({ validMarkKeys }) => {
            classSubjects.forEach(s => {
                if (!validMarkKeys.has(s.id)) {
                    absenceCount.set(s.id, (absenceCount.get(s.id) || 0) + 1);
                }
            });
        });

        // The canonical subject that is MOST absent = the one that the orphan represents
        let maxAbsence = -1;
        let bestCanonical = null;
        absenceCount.forEach((absence, canonId) => {
            // Only consider subjects that are missing from MOST affected students
            if (absence > maxAbsence) {
                maxAbsence = absence;
                bestCanonical = canonId;
            }
        });

        // Confidence: maxAbsence should be high relative to affectedStudentTerms.length
        const confidence = maxAbsence / affectedStudentTerms.length;
        const canonName = bestCanonical ? subjectById.get(bestCanonical)?.name : '???';
        
        if (bestCanonical && confidence >= 0.7) {
            orphanToCanonical.set(orphanId, bestCanonical);
            console.log(`✅ [${orphanId}] -> "${canonName}" [${bestCanonical}]`);
            console.log(`   class=${primaryClass}, affected=${affectedStudentTerms.length}, absence=${maxAbsence} (${(confidence*100).toFixed(0)}%)`);
        } else if (bestCanonical && confidence >= 0.4) {
            orphanToCanonical.set(orphanId, bestCanonical);
            console.log(`⚠️  [${orphanId}] -> "${canonName}" [${bestCanonical}] (medium confidence: ${(confidence*100).toFixed(0)}%)`);
            console.log(`   class=${primaryClass}, affected=${affectedStudentTerms.length}`);
        } else {
            console.log(`❌ [${orphanId}] -> UNRESOLVED (best="${canonName}", conf=${(confidence*100).toFixed(0)}%)`);
            console.log(`   class=${primaryClass}, affected=${affectedStudentTerms.length}`);
            // Show top candidates
            const top5 = [...absenceCount.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
            top5.forEach(([id, abs]) => console.log(`     candidate: "${subjectById.get(id)?.name}" absence=${abs}`));
        }
    });

    console.log(`\nResolved: ${orphanToCanonical.size}/${remainingOrphans.length}`);

    if (orphanToCanonical.size === 0) {
        console.log('No automatic resolutions. Need manual review.');
        return;
    }

    // Apply
    console.log('\nApplying...');
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
                const canonId = orphanToCanonical.get(subId) || subId;
                if (canonId !== subId) {
                    changed = true;
                    totalFixed++;
                    if (!newMarks[canonId] || (marks[subId]?.total||0) > (newMarks[canonId]?.total||0)) {
                        newMarks[canonId] = marks[subId];
                    }
                } else {
                    if (!newMarks[subId]) newMarks[subId] = marks[subId];
                }
            });
            history[termKey] = { ...history[termKey], marks: newMarks };
        });

        if (changed) updates.push({ ref: s.ref, payload: { academicHistory: history }, adNo: s.adNo });
    });

    console.log(`Updating ${updates.length} students, ${totalFixed} mark entries...`);
    
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
    console.log(`\n✅ Fixed ${totalFixed} mark entries across ${updates.length} students.`);
}

finalFix().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
