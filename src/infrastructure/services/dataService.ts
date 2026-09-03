import { BaseDataService } from './modules/BaseDataService';
import { StudentService } from './modules/StudentService';
import { AcademicService } from './modules/AcademicService';
import { SupplementaryService } from './modules/SupplementaryService';
import { SettingsService } from './modules/SettingsService';
import { AttendanceService } from './modules/AttendanceService';
import { AdministrativeService } from './modules/AdministrativeService';
import { CurriculumService } from './modules/CurriculumService';
import { SemesterMigrationService } from './modules/SemesterMigrationService';

import { 
    StudentRecord, 
    SubjectConfig, 
    GlobalSettings, 
    StudentApplication,
    SupplementaryExam,
    AttendanceRecord,
    AcademicCalendarEntry,
    ApplicationStatus,
    PerformanceLevel,
    SubjectMarks,
    ClassReleaseSettings,
    CurriculumEntry
} from '../../domain/entities/types';

export class DataService extends BaseDataService {
    private studentService: StudentService;
    private academicService: AcademicService;
    private supplementaryService: SupplementaryService;
    private settingsService: SettingsService;
    private attendanceService: AttendanceService;
    private administrativeService: AdministrativeService;
    private curriculumService: CurriculumService;
    private migrationService: SemesterMigrationService;

    constructor() {
        super();
        this.studentService = new StudentService();
        this.academicService = new AcademicService(this.studentService);
        this.supplementaryService = new SupplementaryService(this.studentService, this.academicService);
        this.settingsService = new SettingsService(this.studentService);
        this.attendanceService = new AttendanceService(this.academicService);
        this.administrativeService = new AdministrativeService(this.supplementaryService, this.studentService);
        this.curriculumService = new CurriculumService();
        this.migrationService = new SemesterMigrationService();
    }

    /**
     * Override invalidateCache to cascade to ALL child services.
     * This is the critical fix: TermContext calls dataService.invalidateCache()
     * on term switch, but without this override only the base DataService cache
     * is cleared — the child service caches (studentService, academicService, etc.)
     * remain stale, causing stale/empty data to appear in the UI.
     */
    public override invalidateCache(): void {
        super.invalidateCache();
        this.studentService.invalidateCache();
        this.academicService.invalidateCache();
        this.supplementaryService.invalidateCache();
        this.settingsService.invalidateCache();
        this.attendanceService.invalidateCache();
        this.administrativeService.invalidateCache();
        this.curriculumService.invalidateCache();
    }

    // --- Curriculum Domain ---
    async getAllCurriculum(termKey?: string): Promise<CurriculumEntry[]> {
        return this.curriculumService.getAllCurriculum(termKey);
    }

    async addCurriculumEntry(entry: Omit<CurriculumEntry, 'id'>): Promise<string> {
        return this.curriculumService.addCurriculumEntry(entry);
    }

    async updateCurriculumEntry(id: string, updates: Partial<CurriculumEntry>): Promise<void> {
        return this.curriculumService.updateCurriculumEntry(id, updates);
    }

    async deleteCurriculumEntry(id: string): Promise<void> {
        return this.curriculumService.deleteCurriculumEntry(id);
    }

    // --- Student Domain ---
    async getAllStudents(termKey?: string): Promise<StudentRecord[]> {
        return this.studentService.getAllStudents(termKey);
    }

    async getRawAllStudents(): Promise<StudentRecord[]> {
        return this.studentService.getAllStudents('All');
    }

    async getStudentByAdNo(adNo: string, termKey?: string): Promise<StudentRecord | null> {
        const student = await this.studentService.getStudentByAdNo(adNo, termKey);
        if (student) {
            const suppExams = await this.supplementaryService.getSupplementaryExamsByStudent(student.id);
            return {
                ...student,
                supplementaryExams: suppExams
            } as any;
        }
        return null;
    }

    async getStudentById(id: string): Promise<StudentRecord | null> {
        const student = await this.studentService.getStudentById(id);
        if (student) {
            const suppExams = await this.supplementaryService.getSupplementaryExamsByStudent(student.id);
            return {
                ...student,
                supplementaryExams: suppExams
            } as any;
        }
        return null;
    }

    async getStudentsByClass(className: string, termKey?: string): Promise<StudentRecord[]> {
        return this.studentService.getStudentsByClass(className, termKey);
    }

    async updateStudent(id: string, updates: Partial<StudentRecord>, termKey?: string): Promise<void> {
        return this.studentService.updateStudent(id, updates, termKey);
    }

    async addStudent(studentData: Omit<StudentRecord, 'id'>): Promise<string> {
        return this.studentService.addStudent(studentData);
    }

    async bulkCloneStudentsToSemester(targetTermKey: string, semesterType: 'Odd' | 'Even'): Promise<number> {
        return this.studentService.bulkCloneStudentsToSemester(targetTermKey, semesterType);
    }

    async deleteStudent(id: string): Promise<void> {
        return this.studentService.deleteStudent(id);
    }

    async promoteStudents(studentIds: string[], targetClass: string, targetYear: string, targetSemester: 'Odd' | 'Even'): Promise<void> {
        return this.studentService.promoteStudents(studentIds, targetClass, targetYear, targetSemester);
    }

    async promoteClass(fromClass: string, toClass: string, termKey: string): Promise<void> {
        return this.studentService.promoteClass(fromClass, toClass, termKey);
    }

    async isEligibleForHallTicket(studentId: string, className: string, termKey: string): Promise<{ eligible: boolean; percentage: number; required: number }> {
        const student = await this.studentService.getStudentById(studentId);
        const percentage = await this.attendanceService.getOverallAttendance(studentId, className, termKey);
        const settings = await this.getGlobalSettings();
        const required = settings.minAttendancePercentage || 75; // Use dynamic setting, fallback to 75
        const isCondoned = student?.condonedTerms?.[termKey] === true;
        return {
            eligible: isCondoned || percentage >= required,
            percentage,
            required
        };
    }

    async initializeNewSemester(fromTermKey: string, toTermKey: string): Promise<{ subjectsCloned: number; curriculumCloned: number }> {
        return this.migrationService.initializeNewSemester(fromTermKey, toTermKey);
    }

    async migrateLegacyStudentMarks(): Promise<{ migrated: number; skipped: number; errors: number; details: string[] }> {
        return this.migrationService.migrateLegacyStudentMarks();
    }

    async repairHistoricalClassNames(): Promise<number> {
        return this.migrationService.repairHistoricalClassNames();
    }

    // --- Academic Domain ---
    async getAllSubjects(termKey?: string): Promise<SubjectConfig[]> {
        return this.academicService.getAllSubjects(termKey);
    }

    async getRawSubjects(): Promise<SubjectConfig[]> {
        return this.academicService.getRawSubjects();
    }

    async getSubjectsByClass(className: string, termKey?: string): Promise<SubjectConfig[]> {
        return this.academicService.getSubjectsByClass(className, termKey);
    }

    async addSubject(subjectData: Omit<SubjectConfig, 'id'>, termKey?: string): Promise<string> {
        return this.academicService.addSubject(subjectData, termKey);
    }

    async standardizeSubjectNames(): Promise<number> {
        return this.academicService.standardizeSubjectNames();
    }

    async applySubjectNameSubstitutions(): Promise<{ updated: number; previews: string[] }> {
        return this.academicService.applySubjectNameSubstitutions();
    }

    async updateSubject(id: string, updates: Partial<SubjectConfig>): Promise<void> {
        await this.academicService.updateSubject(id, updates);

        // Auto-sync Curriculum when Subject Details are updated
        if (updates.details) {
            await this.curriculumService.syncSubjectToCurriculum(id, updates);
        }
    }

    async deleteSubject(id: string): Promise<void> {
        return this.academicService.deleteSubject(id);
    }

    async updateMarks(studentId: string, subjectId: string, marks: Partial<SubjectMarks>, termKey?: string): Promise<void> {
        return this.academicService.updateMarks(studentId, subjectId, marks, termKey);
    }

    async getRankings(className: string, termKey?: string): Promise<any[]> {
        return this.academicService.getRankings(className, termKey);
    }
    
    // --- Supplementary Domain ---
    async getAllSupplementaryExams(termKey?: string): Promise<SupplementaryExam[]> {
        return this.supplementaryService.getAllSupplementaryExams(termKey);
    }

    async syncApplicationToSupplementary(application: StudentApplication): Promise<void> {
        return this.supplementaryService.syncApplicationToSupplementary(application);
    }

    async updateSupplementaryExamMarks(
        examId: string, 
        marks: any, 
        previousMarks?: any, 
        attemptNumber?: number, 
        originalTerm?: string
    ): Promise<void> {
        return this.supplementaryService.updateSupplementaryExamMarks(examId, marks, previousMarks, attemptNumber, originalTerm);
    }

    async addSupplementaryExam(exam: Omit<SupplementaryExam, 'id'>): Promise<string> {
        return this.supplementaryService.addSupplementaryExam(exam);
    }

    async deleteSupplementaryExam(examId: string): Promise<void> {
        return this.supplementaryService.deleteSupplementaryExam(examId);
    }

    async getSupplementaryExamHistory(studentId: string, subjectId: string): Promise<SupplementaryExam[]> {
        return this.supplementaryService.getSupplementaryExamHistory(studentId, subjectId);
    }

    // --- Settings & Configurations ---
    async getGlobalSettings(): Promise<GlobalSettings> {
        return this.settingsService.getGlobalSettings();
    }

    async updateGlobalSettings(updates: Partial<GlobalSettings>): Promise<void> {
        return this.settingsService.updateGlobalSettings(updates);
    }

    async getReleaseSettings(termKey?: string): Promise<ClassReleaseSettings> {
        return this.settingsService.getReleaseSettings(termKey);
    }

    async updateReleaseSettings(settings: ClassReleaseSettings, termKey?: string): Promise<void> {
        return this.settingsService.updateReleaseSettings(settings, termKey);
    }

    async getAvailableTerms(): Promise<string[]> {
        return this.settingsService.getAvailableTerms();
    }

    async repairGlobalSettings(): Promise<any> {
        return this.settingsService.repairGlobalSettings();
    }

    async getGeneratorConfig(className: string, semester: string): Promise<any> {
        return this.administrativeService.getGeneratorConfig(className, semester);
    }

    async saveGeneratorConfig(config: any): Promise<void> {
        return this.administrativeService.saveGeneratorConfig(config);
    }

    // --- Attendance & Calendar ---
    async getOverallAttendance(studentId: string, className: string, termKey?: string): Promise<number> {
        return this.attendanceService.getOverallAttendance(studentId, className, termKey);
    }

    async getAttendanceForStudent(studentId: string, subjectId: string, termKey?: string): Promise<AttendanceRecord[]> {
        return this.attendanceService.getAttendanceForStudent(studentId, subjectId, termKey);
    }

    async getAttendanceForSubject(subjectId: string, termKey?: string, className?: string): Promise<AttendanceRecord[]> {
        return this.attendanceService.getAttendanceForSubject(subjectId, termKey || '', className);
    }

    async saveAttendanceRecord(record: any): Promise<string> {
        return this.attendanceService.saveAttendanceRecord(record);
    }

    async getAcademicCalendar(termKey?: string): Promise<AcademicCalendarEntry[]> {
        return this.attendanceService.getAcademicCalendar(termKey);
    }

    /**
     * Transfer a student from one optional subject to another within the same class/term.
     * Migrates both marks (AcademicService) and attendance records (AttendanceService).
     * Also updates subject enrollment arrays so the student appears on future attendance sheets.
     */
    async transferStudentSubject(
        studentId: string,
        className: string,
        oldSubjectId: string,
        newSubjectId: string,
        termKey?: string
    ): Promise<void> {
        const activeTerm = termKey || this.getCurrentTermKey();
        // Step 1: Migrate marks & re-enroll in subjects
        await this.academicService.transferStudentSubjectMarks(studentId, oldSubjectId, newSubjectId, activeTerm);
        // Step 2: Migrate attendance records
        await this.attendanceService.transferStudentSubjectAttendance(studentId, className, oldSubjectId, newSubjectId, activeTerm);
    }

    // --- Administrative ---
    async getAllApplications(termKey?: string): Promise<StudentApplication[]> {
        return this.administrativeService.getAllApplications(termKey);
    }

    async getApplicationsByAdNo(adNo: string): Promise<StudentApplication[]> {
        return this.administrativeService.getApplicationsByAdNo(adNo);
    }

    async updateApplicationStatus(id: string, status: ApplicationStatus, adminComment?: string): Promise<void> {
        return this.administrativeService.updateApplicationStatus(id, status, adminComment);
    }

    async deleteApplication(id: string): Promise<void> {
        return this.administrativeService.deleteApplication(id);
    }

    async submitApplication(application: Omit<StudentApplication, 'id' | 'status' | 'createdAt'>): Promise<string> {
        return this.administrativeService.submitApplication(application);
    }

    async backfillApprovedApplications(): Promise<number> {
        return this.administrativeService.backfillApprovedApplications();
    }

    async downloadFullSystemBackup(): Promise<void> {
        return this.administrativeService.downloadFullSystemBackup();
    }

    public async normalizeAllFacultyNames(): Promise<number> {
        try {
            const count = await this.academicService.normalizeAllFacultyNames();
            // Self-heal: ensure active classes exist in customClasses
            const students = await this.studentService.getAllStudents('All');
            const activeCustomClasses = new Set<string>();
            students.forEach(s => {
                if (s.currentClass && s.currentClass.match(/^[A-Z0-9- ]+$/i)) activeCustomClasses.add(s.currentClass);
            });
            
            await this.settingsService.healStrandedClasses(activeCustomClasses);
            return count;
        } catch (e) {
            console.error('Error in optimization/heal:', e);
            return 0;
        }
    }

    public calculateTermMetrics(marks: Record<string, SubjectMarks>, subjects: SubjectConfig[], supplementaryMarks?: Record<string, SubjectMarks>): { grandTotal: number; average: number; performanceLevel: PerformanceLevel } {
        return this.academicService.calculateTermMetrics(marks, subjects, supplementaryMarks);
    }

    public async restoreFullSystemFromBackup(backupJson: Record<string, any[]>): Promise<any> {
        return this.administrativeService.restoreFullSystemFromBackup(backupJson);
    }

    public async restoreTermFromBackup(backupJson: Record<string, any[]>, termKey: string, forceOverwrite = false): Promise<{ 
        processed: number; 
        studentsRestored: number; 
        subjectsRestored: number;
        attendanceRestored: number;
        applicationsRestored: number;
        suppRestored: number;
        examTTRestored: number;
        specialDaysRestored: number;
        calendarRestored: number;
        genConfigsRestored: number;
        skipped: number;
    }> {
        return this.administrativeService.restoreTermFromBackup(backupJson, termKey, forceOverwrite);
    }

    // --- New Facade Mappings ---

    async exportMarksToExcel(className: string, termKey: string): Promise<void> {
        return this.academicService.exportMarksToExcel(className, termKey);
    }

    async importMarksFromExcel(file: File, termKey: string): Promise<{ updated: number; errors: string[] }> {
        return this.academicService.importMarksFromExcel(file, termKey);
    }

    async archiveStudent(id: string): Promise<void> {
        return this.studentService.archiveStudent(id);
    }

    async importStudentsFromExcel(file: File): Promise<{ success: number; errors: string[] }> {
        const results = await this.studentService.importStudentsFromExcel(file);
        return {
            success: results.updated + results.created,
            errors: results.errors
        };
    }

    async bulkImportStudents(students: any[]): Promise<{ success: number; errors: string[] }> {
        const results = await this.studentService.bulkImportStudents(students);
        return {
            success: results.updated + results.created,
            errors: results.errors
        };
    }

    async parseStudentCSV(input: File | string): Promise<{ students: any[], errors: string[] }> {
        return this.studentService.parseStudentCSV(input);
    }

    async getSemesterSummaries(): Promise<any[]> {
        const summaries = await this.academicService.getSemesterSummaries();
        const settings = await this.getGlobalSettings();
        const currentTermKey = this.getCurrentTermKey();

        // Fetch all subjects at once to compute per-term counts efficiently
        const allSubjects = await this.academicService.getRawAllSubjects();
        const subjectsByTerm: Record<string, { subjects: Set<string>; teachers: Set<string>; classes: Set<string> }> = {};
        allSubjects.forEach(sub => {
            const rawSub = sub as any;
            const termKey = rawSub.academicYear
                ? `${rawSub.academicYear}-${rawSub.semester || settings.currentSemester || 'Odd'}`
                : currentTermKey;
            if (!subjectsByTerm[termKey]) {
                subjectsByTerm[termKey] = { subjects: new Set(), teachers: new Set(), classes: new Set() };
            }
            subjectsByTerm[termKey].subjects.add(sub.id);
            if (sub.facultyName) subjectsByTerm[termKey].teachers.add(sub.facultyName.trim().toLowerCase());
            // targetClasses is an array of class names the subject covers
            (sub.targetClasses || []).forEach((cls: string) => subjectsByTerm[termKey].classes.add(cls));
        });

        // For the active term, count students by currentClass (enrolled students, not just historical)
        let currentTermStudentCount = 0;
        let currentTermClassCount = 0;
        try {
            const allStudents = await this.getAllStudents();
            const activeStudents = allStudents.filter(s =>
                s.academicHistory?.[currentTermKey] || s.currentClass
            );
            currentTermStudentCount = activeStudents.length;
            const currentClasses = new Set(activeStudents.map(s => s.currentClass || s.className).filter(Boolean));
            currentTermClassCount = currentClasses.size;
        } catch { /* fallback to history-based count */ }

        let hasCurrent = false;

        const mapped = summaries.map(s => {
            const isCurrent = s.termKey === currentTermKey;
            if (isCurrent) hasCurrent = true;
            const termSubData = subjectsByTerm[s.termKey];
            return {
                ...s,
                isCurrent,
                subjectCount: termSubData?.subjects.size ?? 0,
                teacherCount: termSubData?.teachers.size ?? 0,
                classCount: isCurrent ? currentTermClassCount : (termSubData?.classes.size ?? 0),
                studentCount: isCurrent ? currentTermStudentCount : s.studentCount,
                attendanceCount: 0,
            };
        });

        if (!hasCurrent && settings.currentAcademicYear) {
            const parts = currentTermKey.split('-');
            let academicYear = '';
            let semester = '';
            if (parts.length >= 3) {
                academicYear = `${parts[0]}-${parts[1]}`;
                semester = parts[2];
            } else if (parts.length === 2) {
                academicYear = parts[0];
                semester = parts[1];
            } else {
                academicYear = currentTermKey;
            }
            const termSubData = subjectsByTerm[currentTermKey];
            mapped.unshift({
                termKey: currentTermKey,
                academicYear,
                semester,
                studentCount: currentTermStudentCount,
                classCount: currentTermClassCount,
                subjectCount: termSubData?.subjects.size ?? 0,
                teacherCount: termSubData?.teachers.size ?? 0,
                attendanceCount: 0,
                passPercentage: 0,
                averageScore: 0,
                isCurrent: true
            });
        }

        return mapped;
    }

    async recalculateAllMarkStatuses(targetTermKey?: string): Promise<{ updated: number }> {
        return this.academicService.recalculateAllMarkStatuses(targetTermKey);
    }

    async recalculateAllStudentTotals(targetTermKey?: string): Promise<{ updated: number }> {
        return this.academicService.recalculateAllStudentTotals(targetTermKey);
    }

    async recalculateAllStudentPerformanceLevels(targetTermKey?: string): Promise<{ updated: number }> {
        return this.academicService.recalculateAllStudentPerformanceLevels(targetTermKey);
    }

    async syncAllAvailableYears(): Promise<{ updated: boolean }> {
        return this.settingsService.syncAllAvailableYears();
    }

    async repairOrphanedSubjects(targetYear?: string): Promise<{ scanned: number; fixed: number; orphanYears: string[]; targetYear: string }> {
        return this.academicService.repairOrphanedSubjects(targetYear);
    }


    async cleanAndSyncApplications(targetTermKey: string): Promise<{ synced: number; duplicatesDeleted: number; rejectedDeleted: number; notRegistered: number }> {
        return this.administrativeService.cleanAndSyncApplications(targetTermKey);
    }

    async repairAndAlignSupplementaryExams(targetExamTerm?: string): Promise<{ updated: number; repaired: number }> {
        return this.administrativeService.repairAndAlignSupplementaryExams(targetExamTerm);
    }

    async clearAllData(collectionName: string): Promise<void> {
        return this.administrativeService.clearAllData(collectionName);
    }

    async clearAllSubjects(): Promise<void> {
        return this.administrativeService.clearAllSubjects();
    }

    async deleteAllSupplementaryExams(): Promise<void> {
        return this.administrativeService.deleteAllSupplementaryExams();
    }

    async alignDataToTerms(): Promise<{ specialDaysFixed: number; calendarFixed: number; leaveFixed: number; curriculumFixed: number }> {
        return this.administrativeService.alignDataToTerms();
    }

    async renameClass(oldName: string, newName: string): Promise<void> {
        await this.administrativeService.renameClass(oldName, newName);
        this.invalidateCache();
    }

    async renameClassForwardOnly(oldName: string, newName: string): Promise<void> {
        await this.administrativeService.renameClassForwardOnly(oldName, newName);
        this.invalidateCache();
    }

    async reconcileClassNames(): Promise<{ renamed: string[]; totalUpdates: number }> {
        return this.administrativeService.reconcileClassNames();
    }

    async getClassesByTerm(termKey: string): Promise<string[]> {
        return this.administrativeService.getClassesByTerm(termKey);
    }

    async normalizeNomenclature(): Promise<{ studentsUpdated: number; classesNormalized: number }> {
        return this.administrativeService.normalizeNomenclature();
    }

    async mergeClasses(sourceName: string, targetName: string): Promise<void> {
        return this.administrativeService.mergeClasses(sourceName, targetName);
    }

    async getActiveClasses(settings: GlobalSettings): Promise<string[]> {
        return this.administrativeService.getClassesByTerm();
    }

    async getEnrolledStudentsForSubject(subjectId: string, termKey?: string): Promise<StudentRecord[]> {
        const activeTerm = termKey || this.getCurrentTermKey();
        const [subject, allStudents] = await Promise.all([
            this.academicService.getSubjectById(subjectId, activeTerm),
            this.studentService.getAllStudents(activeTerm)
        ]);
        
        if (!subject) return [];

        if (subject.subjectType === 'elective') {
            // Elective: only those explicitly enrolled
            const studentIds = subject.enrolledStudents || [];
            return allStudents.filter(s => studentIds.includes(s.id));
        } else {
            // General: All students who were in the target classes at that time
            const rawTargetClasses = subject.targetClasses || [];
            const expandedTargetClasses = new Set<string>();
            rawTargetClasses.forEach(c => {
                expandedTargetClasses.add(c);
                expandedTargetClasses.add(this.getHistoricalClassName(activeTerm, c));
                expandedTargetClasses.add(this.getDatabaseClassName(activeTerm, c));
            });

            return allStudents.filter(s => {
                const sClass = s.className || s.currentClass || '';
                const histClass = this.getHistoricalClassName(activeTerm, sClass);
                const dbClass = this.getDatabaseClassName(activeTerm, sClass);
                return expandedTargetClasses.has(sClass) || expandedTargetClasses.has(histClass) || expandedTargetClasses.has(dbClass);
            });
        }
    }

    async enrollStudentInSubject(subjectId: string, studentId: string): Promise<void> {
        return this.academicService.enrollStudentInSubject(subjectId, studentId);
    }

    async unenrollStudentFromSubject(subjectId: string, studentId: string): Promise<void> {
        return this.academicService.unenrollStudentFromSubject(subjectId, studentId);
    }

    async calculateAttendancePercentage(studentId: string, subjectId: string, termKey?: string): Promise<number> {
        return this.attendanceService.calculateAttendancePercentage(studentId, subjectId, termKey);
    }

    async clearStudentSubjectMarks(studentId: string, subjectId: string, termKey?: string): Promise<void> {
        return this.academicService.clearStudentSubjectMarks(studentId, subjectId, termKey);
    }

    async clearSubjectMarks(subjectId: string, studentIds: string[], termKey?: string): Promise<void> {
        return this.academicService.clearSubjectMarks(subjectId, studentIds, termKey);
    }

    async clearSubjectINTMarks(subjectId: string, studentIds: string[], termKey?: string): Promise<void> {
        return this.academicService.clearSubjectINTMarks(subjectId, studentIds, termKey);
    }

    async clearSubjectEXTMarks(subjectId: string, studentIds: string[], termKey?: string): Promise<void> {
        return this.academicService.clearSubjectEXTMarks(subjectId, studentIds, termKey);
    }

    async bulkUpdateMarks(updates: any[], termKey?: string): Promise<void> {
        return this.academicService.bulkUpdateMarks(updates, termKey);
    }

    async updateStudentINTMarks(studentId: string, subjectId: string, marks: any, termKey?: string): Promise<void> {
        return this.academicService.updateMarks(studentId, subjectId, { int: marks }, termKey);
    }

    async bulkUpdateEXTMarks(updates: any[], termKey?: string): Promise<void> {
        return this.academicService.bulkUpdateEXTMarks(updates, termKey);
    }

    // --- Timetable & Scheduling ---
    async getAllTimetables(termKey?: string): Promise<any[]> {
        return this.administrativeService.getAllTimetables(termKey);
    }

    async getTimetableByDay(day: string, termKey?: string): Promise<any[]> {
        return this.administrativeService.getTimetableByDay(day, termKey);
    }

    async getTimetableByClass(className: string, termKey?: string): Promise<any[]> {
        return this.administrativeService.getTimetableByClass(className, termKey);
    }

    async saveTimetableEntries(entries: any[], options?: { clearFirst?: boolean; className?: string; termKey?: string }): Promise<void> {
        return this.administrativeService.saveTimetableEntries(entries, options);
    }

    async getExamTimetable(className: string, termKey?: string): Promise<any[]> {
        return this.administrativeService.getExamTimetable(className, termKey);
    }

    async saveExamTimetableEntries(entries: any[]): Promise<void> {
        return this.administrativeService.saveExamTimetableEntries(entries);
    }

    async getSpecialDays(termKey?: string): Promise<any[]> {
        return this.administrativeService.getSpecialDays(termKey);
    }

    async getHallTicketReleaseStatus(termKey?: string): Promise<boolean> {
        return this.administrativeService.getHallTicketReleaseStatus(termKey);
    }

    async getSupplementaryExamsByStudent(studentId: string): Promise<any[]> {
        return this.supplementaryService.getSupplementaryExamsByStudent(studentId);
    }

    async setHallTicketReleaseStatus(isReleased: boolean, termKey?: string): Promise<void> {
        return this.administrativeService.setHallTicketReleaseStatus(isReleased, termKey);
    }

    async deleteSemesterData(termKey: string): Promise<{ studentsAffected: number; subjectsDeleted: number }> {
        const result = await this.administrativeService.deleteSemesterData(termKey);
        await this.settingsService.syncAllAvailableYears();
        return result;
    }

    async normalizeTermKeys(oldKey: string, newKey: string): Promise<{ studentsUpdated: number; subjectsUpdated: number }> {
        const result = await this.administrativeService.normalizeTermKeys(oldKey, newKey);
        await this.settingsService.syncAllAvailableYears();
        return result;
    }

    async getInconsistentTerms(): Promise<string[]> {
        return this.administrativeService.getInconsistentTerms();
    }

    // --- Attendance Domain (new methods) ---
    async markAttendance(record: Omit<AttendanceRecord, 'id'>): Promise<string> {
        return this.attendanceService.markAttendance(record);
    }

    async getAllAttendanceRecords(termKey?: string): Promise<AttendanceRecord[]> {
        return this.attendanceService.getAllAttendanceRecords(termKey);
    }

    async getAttendanceByClassAndDate(className: string, date: string): Promise<AttendanceRecord[]> {
        return this.attendanceService.getAttendanceByClassAndDate(className, date);
    }

    async markSpecialDay(specialDay: { date: string; type: string; note: string; className?: string }): Promise<string> {
        return this.attendanceService.markSpecialDay(specialDay);
    }

    async deleteAttendanceRecord(id: string): Promise<void> {
        return this.attendanceService.deleteAttendanceRecord(id);
    }

    async deleteAttendancePeriod(virtualId: string): Promise<void> {
        return this.attendanceService.deleteAttendancePeriod(virtualId);
    }

    // --- Leave Permissions ---
    async getLeavePermissions(date: string, termKey?: string): Promise<any[]> {
        return this.attendanceService.getLeavePermissions(date, termKey);
    }

    async getAllLeavePermissions(termKey?: string): Promise<any[]> {
        return this.attendanceService.getAllLeavePermissions(termKey);
    }

    async saveLeavePermission(permission: any): Promise<string> {
        return this.attendanceService.saveLeavePermission(permission);
    }

    async deleteLeavePermission(id: string): Promise<void> {
        return this.attendanceService.deleteLeavePermission(id);
    }

    async recoverAbsences(studentId: string, subjectId: string, count: number | 'all', termKey: string): Promise<void> {
        return this.attendanceService.recoverAbsences(studentId, subjectId, count, termKey);
    }

    subscribeToGlobalSettings(callback: (settings: GlobalSettings) => void): () => void {
        return this.settingsService.subscribeToGlobalSettings(callback);
    }
}

export const dataService = new DataService();