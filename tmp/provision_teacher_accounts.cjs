/**
 * BULK TEACHER ACCOUNT PROVISIONER
 * ─────────────────────────────────────────────────────────────────────────
 * This script:
 *  1. Reads every unique facultyName from all subjects in Firestore
 *  2. Reads existing teacherAccounts to skip already-provisioned teachers
 *  3. For each new teacher, creates a default account:
 *       username : normalized full name (e.g. "dr_ahmad_usthad")
 *       password : dawa@2025   (teachers must change after first login)
 *       mobile   : 0000000000  (placeholder – teacher updates it)
 *
 * Run with:
 *   node tmp/provision_teacher_accounts.cjs
 * ─────────────────────────────────────────────────────────────────────────
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
    apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
    authDomain: "my-edumark-portal.firebaseapp.com",
    projectId: "my-edumark-portal",
    storageBucket: "my-edumark-portal.firebasestorage.app",
    messagingSenderId: "445255012917",
    appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c",
    measurementId: "G-LLMWHDTZ1T"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ── Helpers ───────────────────────────────────────────────────────────────

function nameToUsername(fullName) {
    return fullName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')   // strip non-alphanumeric
        .replace(/\s+/g, '_')           // spaces → underscores
        .replace(/^_+|_+$/g, '');       // trim underscores
}

function uniqueUsername(base, usedSet) {
    let candidate = base;
    let counter = 2;
    while (usedSet.has(candidate)) {
        candidate = `${base}_${counter}`;
        counter++;
    }
    usedSet.add(candidate);
    return candidate;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function provisionTeacherAccounts() {
    console.log('\n═══════════════════════════════════════════════');
    console.log('  BULK TEACHER ACCOUNT PROVISIONER');
    console.log('═══════════════════════════════════════════════\n');

    // 1. Load all subjects – extract unique faculty names
    console.log('📚 Reading subjects collection…');
    const subjectsSnap = await getDocs(collection(db, 'subjects'));
    const allFacultyNames = new Set();

    subjectsSnap.docs.forEach(d => {
        const data = d.data();
        const name = (data.facultyName || '').trim();
        if (name && name.length > 1) {
            allFacultyNames.add(name);
        }
    });

    console.log(`   → Found ${allFacultyNames.size} unique faculty names across ${subjectsSnap.docs.length} subjects.\n`);

    // 2. Load existing teacher accounts – build lookup by name (lowercase)
    console.log('👤 Reading existing teacherAccounts…');
    const accountsSnap = await getDocs(collection(db, 'teacherAccounts'));
    const existingByName = new Map();
    const usedUsernames = new Set();

    accountsSnap.docs.forEach(d => {
        const data = d.data();
        const lowerName = (data.name || '').trim().toLowerCase();
        existingByName.set(lowerName, { id: d.id, ...data });
        if (data.username) usedUsernames.add(data.username.trim().toLowerCase());
    });

    console.log(`   → ${existingByName.size} teacher accounts already in DB.\n`);

    // 3. Determine who needs provisioning
    const toProvision = [];
    for (const facultyName of allFacultyNames) {
        const lowerName = facultyName.toLowerCase();
        if (!existingByName.has(lowerName)) {
            toProvision.push(facultyName);
        }
    }

    if (toProvision.length === 0) {
        console.log('✅ All teachers already have accounts. Nothing to do.\n');
        return;
    }

    console.log(`⚙️  Provisioning ${toProvision.length} new teacher account(s):\n`);

    const DEFAULT_PASSWORD = 'dawa@2025';
    const DEFAULT_MOBILE   = '0000000000';
    const now = Date.now();

    const created = [];
    const skipped = [];

    for (const facultyName of toProvision.sort()) {
        const usernameBase = nameToUsername(facultyName);
        if (!usernameBase) {
            console.log(`   ⚠️  Skipping "${facultyName}" – could not generate a valid username.`);
            skipped.push(facultyName);
            continue;
        }

        const username = uniqueUsername(usernameBase, usedUsernames);
        const id = `teacher_${now}_${Math.random().toString(36).substr(2, 6)}`;

        const account = {
            id,
            name: facultyName,
            username,
            mobileNumber: DEFAULT_MOBILE,
            password: DEFAULT_PASSWORD,
            assignedClasses: [],
            isActive: true,
            isDefaultCredentials: true,   // flag: portal will prompt them to update
            createdAt: now,
            updatedAt: now
        };

        try {
            await setDoc(doc(db, 'teacherAccounts', id), account);
            console.log(`   ✅  "${facultyName}"`);
            console.log(`       username : ${username}`);
            console.log(`       password : ${DEFAULT_PASSWORD}`);
            console.log(`       mobile   : ${DEFAULT_MOBILE} (placeholder)\n`);
            created.push({ name: facultyName, username, password: DEFAULT_PASSWORD });
        } catch (err) {
            console.error(`   ❌  Failed to provision "${facultyName}":`, err.message);
            skipped.push(facultyName);
        }

        // small delay to avoid Firestore rate limits
        await new Promise(r => setTimeout(r, 120));
    }

    // ── Summary ────────────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════════════');
    console.log(`  DONE  –  ${created.length} created, ${skipped.length} skipped`);
    console.log('═══════════════════════════════════════════════\n');

    if (created.length > 0) {
        console.log('📋 CREDENTIAL SHEET (share with teachers; they MUST update after first login):');
        console.log('─────────────────────────────────────────────────────────────────────────────');
        console.log(` ${'NAME'.padEnd(35)} ${'USERNAME'.padEnd(30)} PASSWORD`);
        console.log('─────────────────────────────────────────────────────────────────────────────');
        created.forEach(t => {
            console.log(` ${t.name.padEnd(35)} ${t.username.padEnd(30)} ${t.password}`);
        });
        console.log('─────────────────────────────────────────────────────────────────────────────\n');
        console.log('⚠️  Default password is:  dawa@2025');
        console.log('   Teachers log in → Faculty Portal → "Edit Mobile & Credentials" to set their own.\n');
    }
}

provisionTeacherAccounts()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('\n💥 Fatal error:', err);
        process.exit(1);
    });
