const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

const subjects = backup.subjects || [];
const students = backup.students || [];

console.log('=== P1 / HS2 MARKS DETAILED BREAKDOWN ===\n');

const hs2Students = students.filter(s => s.className === 'HS2' || s.className === 'P1' || s.currentClass === 'HS2' || s.currentClass === 'P1');

hs2Students.slice(0, 5).forEach(st => {
    console.log(`Student ${st.adNo} - ${st.name} (class=${st.className}):`);
    const history = st.academicHistory || {};
    Object.keys(history).forEach(tk => {
        const marks = history[tk]?.marks || {};
        console.log(`  Term ${tk} (${Object.keys(marks).length} marks):`);
        Object.keys(marks).forEach(subId => {
            const sub = subjects.find(x => x.id === subId);
            const markMeta = history[tk]?.subjectMetadata?.[subId];
            console.log(`    [${subId}] -> "${sub ? sub.name : 'MISSING'}" (metaName=${markMeta?.name || 'none'}) = ${marks[subId]?.total}`);
        });
    });
});
