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

async function inspectS2SubjectsInCatalog() {
    console.log('\n=== INSPECTING ALL SUBJECTS IN CATALOG TARGETING S2 OR WITH MARKS IN S2 ===\n');

    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    console.log(`Total subjects in database: ${allSubjects.length}`);

    // Check targetClasses for S2 in catalog
    const s2TargetSubjects = allSubjects.filter(s => (s.targetClasses || []).includes('S2'));
    console.log(`\nSubjects explicitly having targetClasses=['S2'] (${s2TargetSubjects.length}):`);
    s2TargetSubjects.forEach(s => {
        console.log(`  - [${s.id}] "${s.name}" | arabic:"${s.arabicName}" | year:${s.academicYear} | sem:${s.activeSemester} | targets:[${(s.targetClasses||[]).join(',')}]`);
    });

    // Check Nihal N's 10 mark subject IDs vs the catalog
    const nihalMarkSubjectIds = [
        { id: 'a1DIz7nG2NOscDNHMm4g', name: 'FIQH' },
        { id: 'SumCyUAGD3BlU00sUnX2', name: 'URDU' },
        { id: 'GW0CyD9buC4kQZFoDRq0', name: 'ENGLISH' },
        { id: 'gfruq2d6apOpKs4K4oAr', name: 'INFORMATION AND COMMUNICATION TECHNOLOGY' },
        { id: 'EarvmCeEDnoBQFADEiMY', name: 'NAHV' },
        { id: 'FDpQsjimx20bWQyhVKhb', name: 'DOURA' },
        { id: '8E9XVxkbo11sDKpLvaT5', name: 'MOTIVATION' },
        { id: 'U5h7b4ayJ4TXYPe3RK3U', name: 'LIFE SKILLS' },
        { id: '2a6makFhlDyCRa90FMeN', name: 'SARF (AJNAS)' },
        { id: 'AAepbPj7Llmhm67Th4ML', name: 'THAJWEED' }
    ];

    console.log('\nChecking catalog configuration for each of Nihal N\'s 10 mark subject IDs:');
    nihalMarkSubjectIds.forEach(item => {
        const catSub = allSubjects.find(s => s.id === item.id);
        if (catSub) {
            console.log(`  - ID [${item.id}] ("${item.name}") FOUND in catalog!`);
            console.log(`    academicYear="${catSub.academicYear}", activeSemester="${catSub.activeSemester}", targetClasses=[${(catSub.targetClasses||[]).join(',')}]`);
        } else {
            console.log(`  - ID [${item.id}] ("${item.name}") NOT FOUND in catalog!`);
        }
    });
}

inspectS2SubjectsInCatalog().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
