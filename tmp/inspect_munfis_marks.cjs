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

async function inspectMunfisMarks() {
    console.log('=== INSPECTING MUNFIS V & KHALEEL MARKS IN FIRESTORE ===\n');

    const studentsSnap = await getDocs(collection(db, 'students'));
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const subMap = new Map(subjectsSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));

    const targetAdNos = ['142', '146', '155', '139', '141'];

    studentsSnap.docs.forEach(doc => {
        const s = doc.data();
        if (targetAdNos.includes(String(s.adNo))) {
            console.log(`Student [${s.adNo}] ${s.name}:`);
            const history = s.academicHistory || {};

            Object.entries(history).forEach(([termKey, termData]) => {
                console.log(`  Term "${termKey}":`);
                const marks = termData?.marks || {};
                const metadata = termData?.subjectMetadata || {};

                Object.entries(marks).forEach(([subId, mark]) => {
                    const liveSub = subMap.get(subId);
                    const meta = metadata[subId];
                    console.log(`    SubID: "${subId}"`);
                    console.log(`      Live Catalog Subject:`, liveSub ? `name="${liveSub.name}", subjectType="${liveSub.subjectType}", activeSem="${liveSub.activeSemester}"` : 'NOT FOUND IN LIVE CATALOG');
                    console.log(`      Stored Metadata:`, meta ? `name="${meta.name}", subjectType="${meta.subjectType}", activeSem="${meta.activeSemester}"` : 'NO METADATA');
                    console.log(`      Mark: total=${mark.total}, int=${mark.int}, ext=${mark.ext}`);
                });
            });
            console.log('');
        }
    });
}

inspectMunfisMarks().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
