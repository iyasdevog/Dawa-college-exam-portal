const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

const students = backup.students || [];

console.log('=== CHECKING MARKS & METADATA FOR KEY kbGr9LuXzpvE3Ws0PiE5 ===\n');

students.forEach(st => {
    const history = st.academicHistory || {};
    Object.keys(history).forEach(tk => {
        const marks = history[tk]?.marks || {};
        if (marks['kbGr9LuXzpvE3Ws0PiE5'] !== undefined) {
            const meta = history[tk]?.subjectMetadata?.['kbGr9LuXzpvE3Ws0PiE5'];
            console.log(`Student ${st.adNo} (${st.name}, class=${st.className}):`);
            console.log(`  Term: ${tk} | Mark total: ${marks['kbGr9LuXzpvE3Ws0PiE5']?.total}`);
            console.log(`  Metadata:`, meta);
        }
    });
});
