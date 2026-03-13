const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'src', 'infrastructure', 'services', 'dataService.ts');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add imports for GlobalSettings and TermRecord if missing
content = content.replace(
    /import \{ StudentRecord, SubjectConfig, SupplementaryExam, SubjectMarks, PerformanceLevel, ClassReleaseSettings, DouraSubmission, DouraTask, KhatamProgress \} from '\.\.\/\.\.\/domain\/entities\/types';/,
    `import { StudentRecord, SubjectConfig, SupplementaryExam, SubjectMarks, PerformanceLevel, ClassReleaseSettings, DouraSubmission, DouraTask, KhatamProgress, GlobalSettings, TermRecord } from '../../domain/entities/types';`
);

// 2. Add properties to DataService class
if (!content.includes('private currentGlobalSettings: GlobalSettings | null = null;')) {
    content = content.replace(
        /private douraCacheTimestamp: number = 0;/,
        `private douraCacheTimestamp: number = 0;
    private currentGlobalSettings: GlobalSettings | null = null;
    private readonly DEFAULT_ACADEMIC_YEAR = "2024-2025";
    private readonly DEFAULT_SEMESTER = "Odd";`
    );
}

// 3. Add global settings methods
const globalSettingsMethods = `

    // Global Settings Operations
    async getGlobalSettings(): Promise<GlobalSettings> {
        try {
            const docRef = doc(this.db, this.settingsCollection, 'global_admin_settings');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                this.currentGlobalSettings = docSnap.data() as GlobalSettings;
                return this.currentGlobalSettings;
            }
            // Return defaults if not set
            return {
                currentAcademicYear: this.DEFAULT_ACADEMIC_YEAR,
                currentSemester: this.DEFAULT_SEMESTER
            };
        } catch (error) {
            console.error('Error getting global settings:', error);
            return { currentAcademicYear: this.DEFAULT_ACADEMIC_YEAR, currentSemester: this.DEFAULT_SEMESTER };
        }
    }

    async updateGlobalSettings(settings: GlobalSettings): Promise<void> {
        try {
            const docRef = doc(this.db, this.settingsCollection, 'global_admin_settings');
            await setDoc(docRef, settings, { merge: true });
            this.currentGlobalSettings = settings;
            this.invalidateCache();
        } catch (error) {
            console.error('Error updating global settings:', error);
            throw error;
        }
    }

    getCurrentTermKey(settings?: GlobalSettings): string {
        const s = settings || this.currentGlobalSettings || { currentAcademicYear: this.DEFAULT_ACADEMIC_YEAR, currentSemester: this.DEFAULT_SEMESTER };
        return \`$\{s.currentAcademicYear}-$\{s.currentSemester}\`;
    }
`;

if (!content.includes('async getGlobalSettings()')) {
    content = content.replace(
        /async getReleaseSettings\(\)/,
        globalSettingsMethods.substring(1) + "\n    async getReleaseSettings()"
    );
}

// 4. Update processStudentRecord to handle migrations
const newProcessStudentRecord = `    private processStudentRecord(data: any, id: string): StudentRecord {
        const rawMarks = data.marks || {};
        const normalizedMarks: Record<string, SubjectMarks> = {};

        Object.entries(rawMarks).forEach(([subjectId, marks]: [string, any]) => {
            normalizedMarks[subjectId] = {
                int: marks.int !== undefined ? marks.int : (marks.ta !== undefined ? marks.ta : 0),
                ext: marks.ext !== undefined ? marks.ext : (marks.ce !== undefined ? marks.ce : 0),
                total: marks.total || 0,
                status: marks.status || 'Pending',
                isSupplementary: marks.isSupplementary,
                supplementaryYear: marks.supplementaryYear
            };
        });

        // Migration to new structure
        let academicHistory = data.academicHistory || {};
        const currentClass = data.currentClass || data.className || '';
        
        // If they have legacy marks but no history, migrate them to a default term
        if (!data.academicHistory && Object.keys(normalizedMarks).length > 0) {
            const legacyTerm = "2023-2024-Odd"; // Or some default
            academicHistory[legacyTerm] = {
                className: currentClass,
                semester: data.semester || 'Odd',
                marks: normalizedMarks,
                grandTotal: data.grandTotal || 0,
                average: data.average || 0,
                rank: data.rank || 0,
                performanceLevel: data.performanceLevel || 'C (Average)'
            };
        }

        return {
            ...data,
            id,
            currentClass,
            academicHistory,
            // Keep legacy fields populated for backwards compatibility while UI migrates
            className: currentClass,
            marks: normalizedMarks, 
            semester: data.semester || 'Odd',
            grandTotal: data.grandTotal || 0,
            average: data.average || 0,
            rank: data.rank || 0,
            performanceLevel: data.performanceLevel || 'C (Average)'
        } as StudentRecord;
    }`;

content = content.replace(
    /private processStudentRecord\(data: any, id: string\): StudentRecord \{[\s\S]*?\} as StudentRecord;\s*\}/,
    newProcessStudentRecord
);

fs.writeFileSync(targetFile, content);
console.log('Successfully updated dataService.ts');
