const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

const bkSubjects = backup.subjects || [];
const bkStudents = backup.students || [];

console.log('=== FS2 (S1) ALL MARKS IN EVEN SEMESTER (MAY 23 BACKUP) ===\n');

const fs2Students = bkStudents.filter(s => ['FS2','S1'].includes(s.className || s.currentClass));
console.log(`Found ${fs2Students.length} FS2 students in backup.`);

fs2Students.slice(0, 10).forEach(st => {
    console.log(`Student Adm ${st.adNo} (${st.name}):`);
    const history = st.academicHistory || {};
    Object.keys(history).forEach(tk => {
        const marks = history[tk]?.marks || {};
        console.log(`  Term ${tk} (${Object.keys(marks).length} marks):`);
        Object.keys(marks).forEach(subId => {
            const sub = bkSubjects.find(x => x.id === subId);
            console.log(`    [${subId}] "${sub ? sub.name : 'MISSING'}" (type=${sub ? sub.subjectType : '?'}) = ${marks[subId]?.total}`);
        });
    });
});
