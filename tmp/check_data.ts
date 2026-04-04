import { dataService } from '../infrastructure/services/dataService';

async function checkApps() {
    console.log('--- FETCHING ALL APPLICATIONS ---');
    const apps = await dataService.getAllApplications();
    const approved = apps.filter(a => a.status === 'approved');
    console.log(`Total Apps: ${apps.length}`);
    console.log(`Approved Apps: ${approved.length}`);
    
    if (approved.length > 0) {
        console.log('Sample Approved App:', JSON.stringify(approved[0], null, 2));
    }
    
    // Check types
    const types = approved.reduce((acc, a) => {
        acc[a.type] = (acc[a.type] || 0) + 1;
        return acc;
    }, {});
    console.log('Types of Approved Apps:', types);
}

checkApps().catch(console.error);
