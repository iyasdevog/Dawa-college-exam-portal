const fs = require('fs');
const path = require('path');

async function inspectBackupBasicEnglish() {
    console.log('=== INSPECTING MASTER BACKUP FOR BASIC ENGLISH MARKS ===\n');
    const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    const englishSubjects = (backup.subjects || []).filter(s => (s.name || '').toLowerCase().includes('english'));
    console.log('English subjects in Master Backup:');
    englishSubjects.forEach(s => console.log(`  [${s.id}] "${s.name}" | activeSem: ${s.activeSemester} | classes:`, s.targetClasses));

    const engSubMap = new Map(englishSubjects.map(s => [s.id, s.name]));

    let backupOddMarks = 0;
    let backupEvenMarks = 0;

    (backup.students || []).forEach(st => {
        const history = st.academicHistory || {};
        const cls = st.className || st.currentClass || 'UNKNOWN';

        Object.entries(history).forEach(([termKey, termData]) => {
            const marks = termData?.marks || {};
            Object.entries(marks).forEach(([subId, mark]) => {
                if (engSubMap.has(subId)) {
                    console.log(`Student [${st.adNo}] ${st.name} (${cls}) | Term: ${termKey} | Sub: "${engSubMap.get(subId)}" (${subId}) | Total: ${mark.total}`);
                }
            });
        });
    });
}

inspectBackupBasicEnglish();
