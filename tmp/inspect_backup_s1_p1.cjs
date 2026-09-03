const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '../public/AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

const students = backupData.students || [];

console.log('=== INSPECTING MAY 23 BACKUP JSON FILE DIRECTLY ===');
console.log(`Total students in backup: ${students.length}`);

const backupClassesTop = new Set();
const backupClassesHist = new Set();

students.forEach(s => {
    if (s.className) backupClassesTop.add(s.className);
    if (s.currentClass) backupClassesTop.add(s.currentClass);

    if (s.academicHistory) {
        Object.entries(s.academicHistory).forEach(([tk, h]) => {
            if (h && h.className) {
                backupClassesHist.add(`${tk} -> ${h.className}`);
            }
        });
    }
});

console.log('\nTop-level className/currentClass in backup:');
console.log(Array.from(backupClassesTop).sort());

console.log('\nacademicHistory className entries in backup:');
console.log(Array.from(backupClassesHist).sort());

// Search for S1, S2, P1, P2 anywhere in the backup JSON!
const jsonStr = fs.readFileSync(backupPath, 'utf8');
['S1', 'S2', 'P1', 'P2'].forEach(name => {
    const matches = (jsonStr.match(new RegExp(`"${name}"`, 'g')) || []).length;
    console.log(`Occurrences of "${name}" in backup JSON: ${matches}`);
});
