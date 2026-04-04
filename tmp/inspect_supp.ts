import { dataService } from '../infrastructure/services/dataService';

async function inspectSupp() {
    console.log('--- INSPECTING SUPPLEMENTARY EXAMS ---');
    const exams = await dataService.getAllSupplementaryExams();
    console.log(`Total Exams fetched: ${exams.length}`);
    
    const types = exams.reduce((acc, e) => {
        const key = `Type:${e.examType} | AppType:${e.applicationType}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    console.log('Breakdown of types in DB:', types);
    
    if (exams.length > 0) {
        console.log('Sample Exam record:', JSON.stringify(exams[0], null, 2));
    }
}

inspectSupp().catch(console.error);
