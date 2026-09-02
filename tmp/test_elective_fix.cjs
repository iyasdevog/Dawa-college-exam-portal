const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

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

function normalizeSubjectName(name) {
    if (!name) return '';
    return String(name).toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

async function testElectiveFix() {
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const subMap = new Map(subjects.map(s => [s.id, s]));

    const studentsSnap = await getDocs(collection(db, 'students'));
    const students = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const activeTerm = '2025-2026-Even';

    ['FS3', 'FS2'].forEach(className => {
        console.log(`=== TESTING ELECTIVE RESOLUTION FOR CLASS "${className}" (${activeTerm}) ===`);
        const classStudents = students.filter(s => (s.className || s.currentClass) === className);

        classStudents.forEach(st => {
            const history = st.academicHistory || {};
            const termData = history[activeTerm] || {};
            const marksObj = termData.marks || {};
            const metaMap = termData.subjectMetadata || {};

            // Unfailable elective mark resolution
            let electiveInfo = null;

            for (const subId of Object.keys(marksObj)) {
                const mark = marksObj[subId];
                if (!mark) continue;

                const liveSub = subMap.get(subId);
                const meta = metaMap[subId];

                const isElective = (liveSub?.subjectType === 'elective') ||
                                   (meta?.subjectType === 'elective') ||
                                   ['ZT9XwBTEeSP7rOe2x8ik', 't34laHHb8z8OsOGje6fl', '6gZ0p8rH9re48nlfDaWr', 'ZJ10NiJMiV8nGZ4qx0g4'].includes(subId);

                if (isElective) {
                    const name = meta?.displayName || meta?.name || liveSub?.name || subId;
                    electiveInfo = { mark, name, subId };
                    break;
                }
            }

            if (electiveInfo) {
                console.log(`  St [${st.adNo}] ${st.name.padEnd(25)} | ELECTIVE: "${electiveInfo.name}" = ${electiveInfo.mark.total} (${electiveInfo.mark.ext}+${electiveInfo.mark.int}) [SubID: ${electiveInfo.subId}]`);
            } else {
                console.log(`  St [${st.adNo}] ${st.name.padEnd(25)} | ELECTIVE: NONE / NO MARK`);
            }
        });
        console.log('');
    });
}

testElectiveFix().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
