import { dataService } from './src/infrastructure/services/dataService';

async function auditClasses() {
    const settings = await dataService.getGlobalSettings();
    const students = await dataService.getRawAllStudents();
    
    console.log('Custom Classes:', settings.customClasses);
    console.log('Disabled Classes:', settings.disabledClasses);
    
    const studentClasses = Array.from(new Set(students.map(s => s.className || s.currentClass))).filter(Boolean);
    console.log('Classes found in student records:', studentClasses);
}

auditClasses();
