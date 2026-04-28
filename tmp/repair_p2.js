import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TERM = '2025-2026-Odd';
const YEAR = '2025-2026';
const SEM = 'Odd';

async function repairP2() {
    console.log(`--- REPAIRING HS3 -> P2 FOR ${TERM} ---`);

    // 1. Subjects
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    for (const d of subjectsSnap.docs) {
        const data = d.data();
        if (data.academicYear === YEAR && data.activeSemester === SEM) {
            const targets = data.targetClasses || [];
            if (targets.includes('HS3') || targets.includes('FS3') || targets.includes('FS2')) {
                const newTargets = targets.map(c => {
                    if (c === 'HS3') return 'P2';
                    if (c === 'FS3') return 'S2';
                    if (c === 'FS2') return 'S1';
                    return c;
                });
                const unique = [...new Set(newTargets)];
                await updateDoc(d.ref, { targetClasses: unique });
                console.log(`Fixed subject: ${data.name}`);
            }
        }
    }

    // 2. Students
    const studentsSnap = await getDocs(collection(db, 'students'));
    for (const d of studentsSnap.docs) {
        const data = d.data();
        const history = data.academicHistory?.[TERM];
        if (history) {
            let needsUpdate = false;
            let newClass = history.className;
            if (newClass === 'HS3') { newClass = 'P2'; needsUpdate = true; }
            if (newClass === 'FS3') { newClass = 'S2'; needsUpdate = true; }
            if (newClass === 'FS2') { newClass = 'S1'; needsUpdate = true; }
            
            if (needsUpdate) {
                await updateDoc(d.ref, { [`academicHistory.${TERM}.className`]: newClass });
                console.log(`Fixed student: ${data.adNo}`);
            }
        }
    }

    // 3. Attendance
    const attSnap = await getDocs(collection(db, 'attendance'));
    for (const d of attSnap.docs) {
        const data = d.data();
        if (data.termKey === TERM) {
            if (data.className === 'HS3' || data.className === 'FS3' || data.className === 'FS2') {
                await deleteDoc(d.ref);
                console.log(`Deleted misaligned attendance: ${d.id}`);
            }
        }
    }

    console.log('✅ REPAIR COMPLETE.');
    process.exit(0);
}

repairP2();
