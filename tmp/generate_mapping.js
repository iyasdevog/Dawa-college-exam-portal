import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BACKUP_PATH = 'public/AIC_Dawa_Portal_Master_Backup_2026-04-04T04-11-10.json';
const TARGET_TERM = '2025-2026-Odd';

async function mapRenames() {
    console.log('--- GENERATING MAPPING ---');
    const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
    const liveStudentsSnap = await getDocs(collection(db, 'students'));
    
    const mapping = {}; // modernName -> historicalName
    
    const backupStudents = backup.students || [];
    liveStudentsSnap.forEach(ldoc => {
        const live = ldoc.data();
        const back = backupStudents.find(b => b.adNo === live.adNo);
        if (back && back.academicHistory?.[TARGET_TERM]) {
            const histName = back.academicHistory[TARGET_TERM].className;
            const liveName = live.className; // current class
            if (histName !== liveName) {
                mapping[liveName] = histName;
            }
        }
    });

    console.log('Detected Mappings:', JSON.stringify(mapping, null, 2));
    process.exit(0);
}

mapRenames();
