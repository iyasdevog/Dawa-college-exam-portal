import { dataService } from './src/infrastructure/services/dataService';

// Ensure environment variables are set for the process
process.env.VITE_FIREBASE_API_KEY = "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w";
process.env.VITE_FIREBASE_AUTH_DOMAIN = "my-edumark-portal.firebaseapp.com";
process.env.VITE_FIREBASE_PROJECT_ID = "my-edumark-portal";
process.env.VITE_FIREBASE_STORAGE_BUCKET = "my-edumark-portal.firebasestorage.app";
process.env.VITE_FIREBASE_MESSAGING_SENDER_ID = "445255012917";
process.env.VITE_FIREBASE_APP_ID = "1:445255012917:web:c4ed8b06b6dfa84d84977c";

async function checkSettings() {
    try {
        console.log('--- CONNECTING TO FIREBASE ---');
        const settings = await dataService.getGlobalSettings();
        console.log('--- GLOBAL SETTINGS ---');
        console.log(JSON.stringify(settings, null, 2));
        
        const summaries = await dataService.getSemesterSummaries();
        console.log('--- SEMESTER SUMMARIES ---');
        summaries.forEach(s => {
            console.log(`${s.termKey}: isCurrent=${s.isCurrent}, students=${s.studentCount}`);
        });
    } catch (e) {
        console.error('Error:', e);
    }
}

checkSettings();
