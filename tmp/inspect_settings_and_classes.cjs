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

async function inspectSettings() {
    console.log('=== GLOBAL SETTINGS & CURRENT TERM ===\n');

    const settingsSnap = await getDoc(doc(db, 'settings', 'global_admin_settings'));
    if (settingsSnap.exists()) {
        const s = settingsSnap.data();
        console.log(`currentAcademicYear: "${s.currentAcademicYear}"`);
        console.log(`currentSemester:     "${s.currentSemester}"`);
        console.log(`activeTerm:          "${s.currentAcademicYear}-${s.currentSemester}"`);
        console.log(`disabledClasses:     [${(s.disabledClasses || []).join(', ')}]`);
        console.log(`customClasses:       [${(s.customClasses || []).join(', ')}]`);
    } else {
        console.log('No settings document found.');
    }

    console.log('\n=== STUDENTS CURRENT CLASSES & ACADEMIC HISTORY TERMS ===\n');
    const studentsSnap = await getDocs(collection(db, 'students'));
    const termClassCounts = {}; // termKey -> { className -> count }

    studentsSnap.docs.forEach(d => {
        const st = d.data();
        const history = st.academicHistory || {};

        Object.entries(history).forEach(([termKey, termData]) => {
            const cls = termData?.className || 'NO_CLASS';
            if (!termClassCounts[termKey]) termClassCounts[termKey] = {};
            if (!termClassCounts[termKey][cls]) termClassCounts[termKey][cls] = 0;
            termClassCounts[termKey][cls]++;
        });
    });

    console.log('Class distribution per term in student records:');
    Object.entries(termClassCounts).forEach(([termKey, classCounts]) => {
        console.log(`\nTerm "${termKey}":`);
        Object.entries(classCounts).forEach(([cls, count]) => {
            console.log(`   ${cls}: ${count} students`);
        });
    });
}

inspectSettings().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
