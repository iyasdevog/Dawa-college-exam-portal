import { dataService } from '../infrastructure/services/dataService';

async function diagnoseMissing() {
    console.log('--- DIAGNOSING MISSING SYNC ---');
    const apps = await dataService.getAllApplications();
    const students = await dataService.getAllStudents();
    const studentAdNos = new Set(students.map(s => s.adNo.trim().toLowerCase()));
    
    const approved = apps.filter(a => a.status === 'approved');
    const missing = approved.filter(a => !studentAdNos.has(a.adNo.trim().toLowerCase()));
    
    console.log(`Approved Apps: ${approved.length}`);
    console.log(`Apps with NO matching student record: ${missing.length}`);
    
    if (missing.length > 0) {
        console.log('Sample Missing AdNos:', missing.slice(0, 10).map(m => m.adNo));
    }
}

diagnoseMissing().catch(console.error);
