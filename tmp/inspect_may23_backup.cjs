const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

console.log('=== MAY 23 BACKUP STRUCTURE ===');
console.log('Keys in backup:', Object.keys(backup));

const students = backup.students || [];
const subjects = backup.subjects || [];

console.log(`\nStudents count in backup: ${students.length}`);
console.log(`Subjects count in backup: ${subjects.length}`);

console.log('\n--- SUBJECTS LIST IN MAY 23 BACKUP ---');
subjects.forEach((s, i) => {
    console.log(`${i+1}. [${s.id}] "${s.name}" | type=${s.subjectType} | sem=${s.activeSemester} | classes=${(s.targetClasses||[]).join(',')}`);
});

console.log('\n--- CHECKING SPECIFIC CLASSES IN BACKUP ---');

// Check D3 students (English / Communicative Arabic electives)
const d3Students = students.filter(s => s.className === 'D3' || s.currentClass === 'D3');
console.log(`\nD3 students count: ${d3Students.length}`);
if (d3Students.length > 0) {
    const s = d3Students[0];
    console.log(`Sample D3 Student ${s.adNo} - ${s.name}:`);
    const history = s.academicHistory || {};
    Object.keys(history).forEach(tk => {
        const marks = history[tk]?.marks || {};
        console.log(`  Term ${tk}: ${Object.keys(marks).length} marks`);
        Object.keys(marks).forEach(subId => {
            const sub = subjects.find(x => x.id === subId);
            console.log(`    [${subId}] -> "${sub ? sub.name : 'UNKNOWN'}" (${sub ? sub.subjectType : '?'}) total=${marks[subId]?.total}`);
        });
    });
}

// Check P1 / HS2 students
const p1Students = students.filter(s => s.className === 'P1' || s.className === 'HS2' || s.currentClass === 'P1' || s.currentClass === 'HS2');
console.log(`\nP1 / HS2 students count: ${p1Students.length}`);
if (p1Students.length > 0) {
    const s = p1Students[0];
    console.log(`Sample P1 Student ${s.adNo} - ${s.name}:`);
    const history = s.academicHistory || {};
    Object.keys(history).forEach(tk => {
        const marks = history[tk]?.marks || {};
        console.log(`  Term ${tk}: ${Object.keys(marks).length} marks`);
        Object.keys(marks).forEach(subId => {
            const sub = subjects.find(x => x.id === subId);
            console.log(`    [${subId}] -> "${sub ? sub.name : 'UNKNOWN'}" (${sub ? sub.subjectType : '?'}) total=${marks[subId]?.total}`);
        });
    });
}

// Check S1 / FS2 students (Malayalam)
const s1Students = students.filter(s => s.className === 'S1' || s.className === 'FS2' || s.currentClass === 'S1' || s.currentClass === 'FS2');
console.log(`\nS1 / FS2 students count: ${s1Students.length}`);
if (s1Students.length > 0) {
    const s = s1Students[0];
    console.log(`Sample S1 Student ${s.adNo} - ${s.name}:`);
    const history = s.academicHistory || {};
    Object.keys(history).forEach(tk => {
        const marks = history[tk]?.marks || {};
        console.log(`  Term ${tk}: ${Object.keys(marks).length} marks`);
        Object.keys(marks).forEach(subId => {
            const sub = subjects.find(x => x.id === subId);
            console.log(`    [${subId}] -> "${sub ? sub.name : 'UNKNOWN'}" (${sub ? sub.subjectType : '?'}) total=${marks[subId]?.total}`);
        });
    });
}
