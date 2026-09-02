const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, getDoc } = require('firebase/firestore');

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

const TARGET_IDS = ['ho0E0KjbSGybbkr2NakY', '4ILHgiGPtvR0TBQwpMpv'];

async function inspectTargets() {
    console.log('=== INSPECTING TARGET SUBJECTS ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const studentsSnap = await getDocs(collection(db, 'students'));

    TARGET_IDS.forEach(id => {
        const subDoc = subjectsSnap.docs.find(d => d.id === id);
        if (subDoc) {
            console.log(`📌 Subject ID [${id}]:`);
            console.log(`   Name: "${subDoc.data().name}"`);
            console.log(`   Arabic Name: "${subDoc.data().arabicName || ''}"`);
            console.log(`   Subject Type: "${subDoc.data().subjectType}"`);
            console.log(`   Active Semester: "${subDoc.data().activeSemester}"`);
            console.log(`   Target Classes: [${(subDoc.data().targetClasses || []).join(', ')}]`);
            console.log(`   Max Marks: Total=${subDoc.data().maxTotal || 100}, Int=${subDoc.data().maxINT}, Ext=${subDoc.data().maxEXT}`);
        } else {
            console.log(`❌ Subject ID [${id}] NOT FOUND in subjects collection.`);
        }
        console.log('');
    });

    console.log('=== STUDENT MARKS USAGE ===\n');
    studentsSnap.docs.forEach(d => {
        const st = d.data();
        const history = st.academicHistory || {};

        Object.entries(history).forEach(([termKey, termData]) => {
            const marks = termData?.marks || {};
            TARGET_IDS.forEach(id => {
                if (marks[id] !== undefined) {
                    console.log(`Student [${st.adNo}] ${st.name} (${st.currentClass || st.className}) in term "${termKey}":`);
                    console.log(`   Has mark for [${id}]: total=${marks[id].total}, ext=${marks[id].ext}, int=${marks[id].int}`);
                }
            });
        });
    });
}

inspectTargets().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
