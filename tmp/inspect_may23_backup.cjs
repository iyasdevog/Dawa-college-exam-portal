const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '../public/AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
console.log('Reading backup file:', backupPath);

const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

console.log('Backup Root Keys:', Object.keys(data));

const students = data.students || [];
const subjects = data.subjects || [];

console.log(`Students in Backup: ${students.length}`);
console.log(`Subjects in Backup: ${subjects.length}`);

// Sample student
if (students.length > 0) {
    console.log('\nSample Student in Backup:');
    console.log(JSON.stringify(students[0], null, 2));
}

// Sample subject
if (subjects.length > 0) {
    console.log('\nSample Subject in Backup:');
    console.log(JSON.stringify(subjects[0], null, 2));
}

// Class breakdown of students in backup
const classDist = {};
students.forEach(s => {
    const cls = s.currentClass || s.className || 'Unknown';
    classDist[cls] = (classDist[cls] || 0) + 1;
});
console.log('\nStudent Class Distribution in Backup:', classDist);
