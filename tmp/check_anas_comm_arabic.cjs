const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '..', 'public', 'AIC_Dawa_Portal_Master_Backup_2026-05-23T08-53-51.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

const students = backup.students || [];
const subjects = backup.subjects || [];

const STUDENT_ADM = '152'; // Muhammed Anas K
const COMM_ARABIC_ID = 'Du5idoGnJfvUVsWB3Drg'; // Communicative Arabic

const student = students.find(s => String(s.adNo) === STUDENT_ADM);

if (!student) {
    console.log(`Student [${STUDENT_ADM}] NOT FOUND in backup.`);
    process.exit(0);
}

console.log(`=== BACKUP DATA FOR STUDENT [${student.adNo}] ${student.name} ===`);
console.log(`Class: ${student.className || student.currentClass}`);
console.log('');

const history = student.academicHistory || {};

Object.entries(history).forEach(([termKey, termData]) => {
    const marks = termData?.marks || {};
    console.log(`Term "${termKey}" (${Object.keys(marks).length} marks):`);

    let hasCommArabic = false;
    Object.entries(marks).forEach(([subId, mark]) => {
        const sub = subjects.find(x => x.id === subId);
        const name = sub?.name || termData?.subjectMetadata?.[subId]?.name || subId;
        console.log(`  [${subId}] "${name}" = ${mark.total} (${mark.ext}+${mark.int})`);
        if (subId === COMM_ARABIC_ID) hasCommArabic = true;
    });

    if (hasCommArabic) {
        console.log(`  *** HAS COMMUNICATIVE ARABIC IN BACKUP ***`);
    } else {
        console.log(`  (No Communicative Arabic in backup for this term)`);
    }
    console.log('');
});

// Check if backup has any FS3 students with Communicative Arabic
console.log('=== ALL FS3 STUDENTS WITH COMM ARABIC IN BACKUP ===');
const fs3Students = students.filter(s => (s.className === 'FS3' || s.currentClass === 'FS3'));
let anyFS3CommArabic = false;
fs3Students.forEach(st => {
    const history = st.academicHistory || {};
    Object.entries(history).forEach(([termKey, termData]) => {
        const marks = termData?.marks || {};
        if (marks[COMM_ARABIC_ID]) {
            anyFS3CommArabic = true;
            console.log(`BACKUP: [${st.adNo}] ${st.name} has Comm Arabic in term "${termKey}" = ${marks[COMM_ARABIC_ID].total}`);
        }
    });
});
if (!anyFS3CommArabic) {
    console.log('NO FS3 students had Communicative Arabic in the backup. This is an incorrect mark for this student.');
}
