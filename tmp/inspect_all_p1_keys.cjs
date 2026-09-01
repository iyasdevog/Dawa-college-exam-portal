const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

const subjects = backup.subjects || [];
const students = backup.students || [];

const hs2Students = students.filter(s => s.className === 'HS2' || s.className === 'P1' || s.currentClass === 'HS2' || s.currentClass === 'P1');

console.log(`=== ALL P1 (HS2) STUDENTS MARK KEYS IN MAY 23 BACKUP (${hs2Students.length} students) ===\n`);

const allMarkKeys = new Set();
hs2Students.forEach(st => {
    const history = st.academicHistory || {};
    Object.keys(history).forEach(tk => {
        const marks = history[tk]?.marks || {};
        Object.keys(marks).forEach(k => allMarkKeys.add(k));
    });
});

console.log(`Unique mark keys in HS2/P1 students: ${allMarkKeys.size}`);
allMarkKeys.forEach(k => {
    const sub = subjects.find(x => x.id === k);
    console.log(`  Key [${k}] -> Name: "${sub ? sub.name : 'MISSING'}" | type=${sub ? sub.subjectType : '?'}`);
});
