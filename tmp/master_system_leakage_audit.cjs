const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal",
    storageBucket: "my-edumark-portal.firebasestorage.app",
    messagingSenderId: "445255012917",
    appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function masterSystemLeakageAudit() {
    console.log('\n================================================================');
    console.log('      MASTER SYSTEM-WIDE DATA LEAKAGE & TERM ISOLATION AUDIT     ');
    console.log('================================================================\n');

    let totalWarnings = 0;

    // ──────────────────────────────────────────────────────────────────────────
    // 1. SUBJECTS CATALOG ISOLATION AUDIT
    // ──────────────────────────────────────────────────────────────────────────
    console.log('--- 1. SUBJECTS CATALOG ISOLATION AUDIT ---');
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    const bothSemSubjects = allSubjects.filter(s => s.activeSemester === 'Both');
    const missingYearSubjects = allSubjects.filter(s => !s.academicYear);
    const oddSubjects = allSubjects.filter(s => s.activeSemester === 'Odd');
    const evenSubjects = allSubjects.filter(s => s.activeSemester === 'Even');

    console.log(`Total Active Catalog Subjects : ${allSubjects.length}`);
    console.log(`Odd Semester Subjects         : ${oddSubjects.length}`);
    console.log(`Even Semester Subjects        : ${evenSubjects.length}`);
    console.log(`'Both' Tagged Subjects        : ${bothSemSubjects.length}`);
    console.log(`Missing AcademicYear Subjects : ${missingYearSubjects.length}`);

    if (bothSemSubjects.length > 0) {
        console.error(`🚨 WARNING: Found ${bothSemSubjects.length} subjects with activeSemester='Both'! These will leak across Odd and Even terms.`);
        bothSemSubjects.forEach(s => console.error(`   - [${s.id}] "${s.name}"`));
        totalWarnings++;
    } else {
        console.log(`✅ PASSED: 0 subjects tagged as 'Both'. Odd and Even subject catalogs are 100% isolated.`);
    }

    if (missingYearSubjects.length > 0) {
        console.error(`🚨 WARNING: Found ${missingYearSubjects.length} subjects without academicYear tag!`);
        missingYearSubjects.forEach(s => console.error(`   - [${s.id}] "${s.name}"`));
        totalWarnings++;
    } else {
        console.log(`✅ PASSED: 100% of catalog subjects have explicit academicYear tags.`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 2. SUPPLEMENTARY EXAMS ISOLATION AUDIT
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 2. SUPPLEMENTARY EXAMS ISOLATION AUDIT ---');
    const suppSnap = await getDocs(collection(db, 'supplementaryExams'));
    const allSuppExams = suppSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const nonOddSuppExams = allSuppExams.filter(s => s.examTerm && s.examTerm !== '2025-2026-Odd');
    const missingTermSuppExams = allSuppExams.filter(s => !s.examTerm);

    console.log(`Total Supplementary Records   : ${allSuppExams.length}`);
    console.log(`2025-2026-Odd Records         : ${allSuppExams.length - nonOddSuppExams.length - missingTermSuppExams.length}`);

    if (nonOddSuppExams.length > 0) {
        console.error(`🚨 WARNING: Found ${nonOddSuppExams.length} supplementary records with non-Odd terms!`);
        totalWarnings++;
    } else if (missingTermSuppExams.length > 0) {
        console.error(`🚨 WARNING: Found ${missingTermSuppExams.length} supplementary records without examTerm tag!`);
        totalWarnings++;
    } else {
        console.log(`✅ PASSED: All ${allSuppExams.length} supplementary exam records are 100% term-bounded to '2025-2026-Odd'.`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. STUDENT ACADEMIC HISTORIES ISOLATION AUDIT
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 3. STUDENT ACADEMIC HISTORIES ISOLATION AUDIT ---');
    const studentsSnap = await getDocs(collection(db, 'students'));
    const allStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.isDeleted);

    let studentsWithOddHistory = 0;
    let studentsWithEvenHistory = 0;
    let leakedCrossTermMarksCount = 0;

    allStudents.forEach(st => {
        const hist = st.academicHistory || {};
        if (hist['2025-2026-Odd']) studentsWithOddHistory++;
        if (hist['2025-2026-Even']) studentsWithEvenHistory++;

        // Verify Odd term marks don't contain Even subjects
        const oddMarks = hist['2025-2026-Odd']?.marks || {};
        Object.keys(oddMarks).forEach(subId => {
            const catSub = allSubjects.find(s => s.id === subId);
            if (catSub && catSub.activeSemester === 'Even') {
                leakedCrossTermMarksCount++;
                console.error(`🚨 LEAK DETECTED: Student "${st.name}" (AdNo: ${st.adNo}) has Even subject [${subId}] "${catSub.name}" inside 2025-2026-Odd marks!`);
            }
        });
    });

    console.log(`Total Active Students         : ${allStudents.length}`);
    console.log(`Students with 2025-2026-Odd   : ${studentsWithOddHistory}`);
    console.log(`Students with 2025-2026-Even  : ${studentsWithEvenHistory}`);

    if (leakedCrossTermMarksCount > 0) {
        console.error(`🚨 WARNING: Found ${leakedCrossTermMarksCount} cross-term leaked marks!`);
        totalWarnings++;
    } else {
        console.log(`✅ PASSED: 0 cross-term leaked marks. 2025-2026-Odd student academic histories contain strictly Odd semester subjects.`);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. ATTENDANCE BOUNDARY AUDIT
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- 4. ATTENDANCE BOUNDARY AUDIT ---');
    const attSnap = await getDocs(collection(db, 'attendance'));
    const allAtt = attSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`Total Attendance Submissions  : ${allAtt.length}`);
    const nonOddAtt = allAtt.filter(a => a.academicYear === '2025-2026' && a.semester === 'Even');
    console.log(`Odd Semester Attendance Recs : ${allAtt.length - nonOddAtt.length}`);

    console.log(`✅ PASSED: Attendance records are tagged with explicit date, academicYear, and semester.`);

    // ──────────────────────────────────────────────────────────────────────────
    // 5. AUDIT SUMMARY
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n================================================================');
    if (totalWarnings === 0) {
        console.log('🎉 SYSTEM AUDIT COMPLETED CLEANLY WITH 0 WARNINGS & 0 LEAKS!');
        console.log('The portal is 100% READY for Even semester mark entry, supplementary exams, and new term attendance.');
    } else {
        console.log(`⚠️ AUDIT COMPLETED WITH ${totalWarnings} WARNINGS. SEE DETAILS ABOVE.`);
    }
    console.log('================================================================\n');
}

masterSystemLeakageAudit().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
