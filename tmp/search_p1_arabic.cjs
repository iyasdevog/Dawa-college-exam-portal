const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

const subjects = backup.subjects || [];
const students = backup.students || [];

console.log('=== SEARCHING ARABIC MARKS FOR P1 / HS2 STUDENTS IN ENTIRE BACKUP ===\n');

const hs2Students = students.filter(s => s.className === 'HS2' || s.className === 'P1' || s.currentClass === 'HS2' || s.currentClass === 'P1');

hs2Students.forEach(st => {
    // Check all history terms and top-level marks
    const history = st.academicHistory || {};
    Object.keys(history).forEach(tk => {
        const marks = history[tk]?.marks || {};
        Object.keys(marks).forEach(subId => {
            const sub = subjects.find(x => x.id === subId);
            const name = (sub?.name || history[tk]?.subjectMetadata?.[subId]?.name || '').toLowerCase();
            if (name.includes('arabic') || name.includes('عرب')) {
                console.log(`Student ${st.adNo} (${st.name}) | Term ${tk} | Sub [${subId}] "${name}" = ${marks[subId]?.total}`);
            }
        });
    });

    const topMarks = st.marks || {};
    Object.keys(topMarks).forEach(subId => {
        const sub = subjects.find(x => x.id === subId);
        const name = (sub?.name || '').toLowerCase();
        if (name.includes('arabic') || name.includes('عرب')) {
            console.log(`Student ${st.adNo} (${st.name}) | Top Marks | Sub [${subId}] "${name}" = ${topMarks[subId]?.total}`);
        }
    });
});

console.log('\nSearch complete.');
