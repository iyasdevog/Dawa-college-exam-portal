const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

const subjects = backup.subjects || [];
const students = backup.students || [];

console.log('=== VERIFYING MAY 23 MASTER BACKUP DATA ===\n');

// 1. Check ENGLISH elective in D1, D2, D3
console.log('1. ENGLISH ELECTIVES IN MAY 23 BACKUP:');
const engElectives = subjects.filter(s => s.name.toUpperCase().includes('ENGLISH') && s.subjectType === 'elective');
engElectives.forEach(s => {
    console.log(`   [${s.id}] "${s.name}" | type=${s.subjectType} | classes=${(s.targetClasses||[]).join(',')}`);
});

// 2. Check Communicative Arabic / Arabic electives
console.log('\n2. ARABIC SUBJECTS & ELECTIVES IN MAY 23 BACKUP:');
const arabicSubs = subjects.filter(s => s.name.toLowerCase().includes('arabic') || s.name.includes('عرب'));
arabicSubs.forEach(s => {
    console.log(`   [${s.id}] "${s.name}" | type=${s.subjectType} | sem=${s.activeSemester} | classes=${(s.targetClasses||[]).join(',')}`);
});

// 3. Check P1 / HS2 Arabic marks in backup
console.log('\n3. P1 / HS2 ARABIC MARKS IN MAY 23 BACKUP:');
const hs2Students = students.filter(s => s.className === 'HS2' || s.className === 'P1' || s.currentClass === 'HS2' || s.currentClass === 'P1');
let hs2ArabicCount = 0;
hs2Students.forEach(st => {
    const oddMarks = st.academicHistory?.['2025-2026-Odd']?.marks || st.marks || {};
    // Check which Arabic subject keys exist
    Object.keys(oddMarks).forEach(k => {
        const sub = subjects.find(x => x.id === k);
        if (sub && (sub.name.toLowerCase().includes('arabic') || sub.name.includes('عرب'))) {
            hs2ArabicCount++;
            // console.log(`   Student ${st.adNo} (${st.name}): [${k}] "${sub.name}" = ${oddMarks[k]?.total}`);
        }
    });
});
console.log(`   Found ${hs2ArabicCount} Arabic mark entries for ${hs2Students.length} HS2/P1 students!`);

// 4. Check Malayalam in S1 (FS2) vs S2 (FS3) in backup
console.log('\n4. MALAYALAM SUBJECTS IN MAY 23 BACKUP:');
const malSubs = subjects.filter(s => s.name.toLowerCase().includes('malayalam'));
malSubs.forEach(s => {
    console.log(`   [${s.id}] "${s.name}" | type=${s.subjectType} | sem=${s.activeSemester} | classes=${(s.targetClasses||[]).join(',')}`);
});

// 5. Total count of students and subjects to restore
console.log(`\nMaster Backup ready: ${subjects.length} subjects, ${students.length} students.`);
