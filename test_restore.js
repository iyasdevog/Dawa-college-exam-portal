const fs = require('fs');

const raw = fs.readFileSync('public/FIXED_BACKUP_FOR_RESTORE.json', 'utf-8');
const backupJson = JSON.parse(raw);

const year = '2025-2026';
const sem = 'Odd';

const backupStudents = backupJson.students || [];
const backupClasses = new Set(backupStudents.map(s => s.className || s.currentClass).filter(Boolean));

const backupSubjects = backupJson.subjects || [];

let restored = 0;
let skipped = 0;

for (const sub of backupSubjects) {
    const exactMatch = sub.academicYear === year && (sub.activeSemester === sem || sub.activeSemester === 'Both' || !sub.activeSemester);
    const classMatch = sub.targetClasses?.some(c => backupClasses.has(c));

    if (!exactMatch && !classMatch) {
        skipped++;
        continue;
    }
    restored++;
    
    // Check specific subjects
    if (sub.id === 'qONeFnfq8xP7dXSUlboO') {
        console.log("Found qONe... (English) -> exactMatch:", exactMatch, "classMatch:", classMatch);
    }
}

console.log(`Restored: ${restored}, Skipped: ${skipped}`);
