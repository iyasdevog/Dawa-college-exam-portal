const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
const subjects = backup.subjects || [];

const TARGET_IDS = ['ho0E0KjbSGybbkr2NakY', '4ILHgiGPtvR0TBQwpMpv'];

console.log('=== TARGET SUBJECTS IN MAY BACKUP ===\n');

TARGET_IDS.forEach(id => {
    const sub = subjects.find(s => s.id === id);
    if (sub) {
        console.log(`[${id}] "${sub.name}":`);
        console.log(`   subjectType: ${sub.subjectType}`);
        console.log(`   activeSemester: ${sub.activeSemester}`);
        console.log(`   targetClasses: [${(sub.targetClasses || []).join(', ')}]`);
    } else {
        console.log(`[${id}] NOT FOUND in backup subjects list by exact ID.`);
        // Search by name
        const match = subjects.filter(s => s.name && (s.name.includes('Balaga') || s.name.includes('Linguistics')));
        match.forEach(m => {
            console.log(`   Name match [${m.id}] "${m.name}" | sem: ${m.activeSemester} | classes: [${(m.targetClasses || []).join(', ')}]`);
        });
    }
    console.log('');
});
