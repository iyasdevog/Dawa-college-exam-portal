import { BaseDataService } from './modules/BaseDataService';
import { StudentService } from './modules/StudentService';
import { AcademicService } from './modules/AcademicService';
import { SupplementaryService } from './modules/SupplementaryService';
import { SettingsService } from './modules/SettingsService';
import { AttendanceService } from './modules/AttendanceService';
import { AdministrativeService } from './modules/AdministrativeService';
import { CurriculumService } from './modules/CurriculumService';
import { SemesterMigrationService } from './modules/SemesterMigrationService';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

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
    SpecialDay,
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
        this.academicService = new AcademicService();
        this.supplementaryService = new SupplementaryService(this.studentService, this.academicService);
        this.settingsService = new SettingsService(this.studentService);
        this.attendanceService = new AttendanceService(this.academicService);
        this.administrativeService = new AdministrativeService(this.supplementaryService, this.studentService);
        this.curriculumService = new CurriculumService();
        this.migrationService = new SemesterMigrationService();
    }

    // --- Curriculum Domain ---
    async getAllCurriculum(): Promise<CurriculumEntry[]> {
        return this.curriculumService.getAllCurriculum();
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
        return this.studentService.getStudentByAdNo(adNo, termKey);
    }

    async getStudentById(id: string): Promise<StudentRecord | null> {
        return this.studentService.getStudentById(id);
    }

    async getStudentsByClass(className: string, termKey?: string): Promise<StudentRecord[]> {
        return this.studentService.getStudentsByClass(className, termKey);
    }

    async updateStudent(id: string, updates: Partial<StudentRecord>): Promise<void> {
        return this.studentService.updateStudent(id, updates);
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
        const percentage = await this.attendanceService.getOverallAttendance(studentId, className, termKey);
        const required = 75; // Minimum required percentage
        return {
            eligible: percentage >= required,
            percentage,
            required
        };
    }

    async initializeNewSemester(fromTermKey: string, toTermKey: string): Promise<{ subjectsCloned: number; curriculumCloned: number }> {
        return this.migrationService.initializeNewSemester(fromTermKey, toTermKey);
    }

    // --- Academic Domain ---
    async getAllSubjects(termKey?: string): Promise<SubjectConfig[]> {
        return this.academicService.getAllSubjects(termKey);
    }

    async getRawSubjects(): Promise<SubjectConfig[]> {
        return this.academicService.getRawAllSubjects();
    }

    async getSubjectsByClass(className: string, termKey?: string): Promise<SubjectConfig[]> {
        return this.academicService.getSubjectsByClass(className, termKey);
    }

    async addSubject(subjectData: Omit<SubjectConfig, 'id'>): Promise<string> {
        return this.academicService.addSubject(subjectData);
    }

    async updateSubject(id: string, updates: Partial<SubjectConfig>): Promise<void> {
        await this.academicService.updateSubject(id, updates);

        // Auto-sync Curriculum when Subject Details are updated
        if (updates.details) {
            try {
                let subjectConfigName = updates.name || '';
                let subjectType = updates.subjectType || 'general';
                if (!subjectConfigName) {
                    const allSubs = await this.getAllSubjects();
                    const sub = allSubs.find(s => s.id === id);
                    if (sub) {
                        subjectConfigName = sub.name;
                        subjectType = sub.subjectType;
                    }
                }

                // Infer curriculum stage & stream
                const stageStr = (updates.details.stage || '').toLowerCase();
                let curStage: 'Foundational' | 'Undergraduate' | 'Post Graduate' = 'Foundational';
                if (stageStr.includes('undergraduate')) curStage = 'Undergraduate';
                else if (stageStr.includes('post')) curStage = 'Post Graduate';

                let stream: '3-Year' | '5-Year' | 'None' = 'None';
                const semText = String(updates.details.semester || '').trim();
                const semNum = parseInt(semText) || 1;

                if (curStage === 'Foundational') {
                    stream = '3-Year';
                    if (stageStr.includes('5') || semText.includes('5') || ['7','8','9','10'].includes(semText)) {
                        stream = '5-Year';
                    }
                }

                // Format curriculum portions from course units
                let portionsStr = (updates.details.courseContent || [])
                    .map(c => `Unit ${c.unit}: ${c.description || ''}`.trim())
                    .filter(c => c !== 'Unit :')
                    .join('\n\n');
                
                if (!portionsStr) {
                    portionsStr = updates.details.summaryAndJustification || 'No syllabus available.';
                }

                const termKey = this.getCurrentTermKey();
                const [targetYear, targetSemester] = termKey.split('-').length === 3 
                    ? [`${termKey.split('-')[0]}-${termKey.split('-')[1]}`, termKey.split('-')[2]]
                    : [termKey.split('-')[0], termKey.split('-')[1]];

                const curriculumData = {
                    stage: curStage,
                    stream: stream,
                    semester: semNum,
                    subjectCode: id, // Typically acts as code
                    subjectName: subjectConfigName || updates.details.courseName || 'Unknown Subject',
                    subjectType: subjectType,
                    learningPeriod: updates.details.totalHours || 'TBD',
                    portions: portionsStr.trim(),
                    academicYear: targetYear,
                    termKey: termKey
                };

                const curricula = await this.getAllCurriculum();
                // Match by name AND term to allow historical versions of the same subject
                const existing = curricula.find(c => 
                    (c.subjectCode === id) || 
                    (c.subjectName === curriculumData.subjectName && (c.termKey === termKey || c.academicYear === targetYear))
                );

                if (existing) {
                    await this.updateCurriculumEntry(existing.id, curriculumData);
                } else {
                    await this.addCurriculumEntry(curriculumData);
                }
            } catch (err) {
                console.error("Auto Sync Curriculum Error:", err);
            }
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

    async getAvailableTerms(): Promise<string[]> {
        return this.settingsService.getAvailableTerms();
    }

    async repairGlobalSettings(): Promise<any> {
        return this.settingsService.repairGlobalSettings();
    }

    // --- Attendance & Calendar ---
    async getOverallAttendance(studentId: string, className: string, termKey?: string): Promise<number> {
        return this.attendanceService.getOverallAttendance(studentId, className, termKey);
    }

    async getAttendanceForStudent(studentId: string, subjectId: string, termKey?: string): Promise<AttendanceRecord[]> {
        return this.attendanceService.getAttendanceForStudent(studentId, subjectId, termKey);
    }

    async saveAttendanceRecord(record: any): Promise<string> {
        return this.attendanceService.saveAttendanceRecord(record);
    }

    async getAcademicCalendar(termKey?: string): Promise<AcademicCalendarEntry[]> {
        return this.attendanceService.getAcademicCalendar(termKey);
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

    async backfillApprovedApplications(): Promise<number> {
        return this.administrativeService.backfillApprovedApplications();
    }

    async downloadFullSystemBackup(): Promise<void> {
        return this.administrativeService.downloadFullSystemBackup();
    }

    public async normalizeAllFacultyNames(): Promise<number> {
        try {
            const count = await this.academicService.normalizeAllFacultyNames();
            // Self-heal: ensure active classes exist in customClasses if they were stranded
            const students = await this.studentService.getAllStudents('All');
            const activeCustomClasses = new Set<string>();
            students.forEach(s => {
                if (s.currentClass && s.currentClass.match(/^[A-Z0-9- ]+$/i)) activeCustomClasses.add(s.currentClass);
            });
            
            if (this.db) {
                // Add them to Settings global customClasses if missing
                const adminSettingsRef = doc(this.db, 'settings', 'global_admin_settings');
                const adminSettingsDoc = await getDoc(adminSettingsRef);
                
                // ALSO fetch the orphaned 'global' doc where disabledClasses might be stuck!
                const orphanedGlobalRef = doc(this.db, 'settings', 'global');
                const orphanedGlobalDoc = await getDoc(orphanedGlobalRef);
                const orphanedDisabledClasses = orphanedGlobalDoc.exists() ? (orphanedGlobalDoc.data().disabledClasses || []) : [];

                if (adminSettingsDoc.exists()) {
                    const settings = adminSettingsDoc.data();
                    const existingCustomClasses: string[] = settings.customClasses || [];
                    let existingDisabledClasses: string[] = settings.disabledClasses || [];
                    
                    let hasChanges = false;
                    
                    // Recover orphaned disabled classes
                    orphanedDisabledClasses.forEach((cls: string) => {
                        if (!existingDisabledClasses.includes(cls)) {
                            existingDisabledClasses.push(cls);
                            hasChanges = true;
                        }
                    });

                    Array.from(activeCustomClasses).forEach(cls => {
                        if (!existingCustomClasses.includes(cls) && cls !== 'All') { // Quick heuristic
                            existingCustomClasses.push(cls);
                            hasChanges = true;
                        }
                    });
                    
                    if (hasChanges) {
                        await updateDoc(adminSettingsRef, {
                            customClasses: Array.from(new Set(existingCustomClasses)),
                            disabledClasses: Array.from(new Set(existingDisabledClasses))
                        });
                        console.log('Self-Healed stranded custom/disabled classes');
                    }
                }
            }
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

    async alignDataToTerms(): Promise<{ specialDaysFixed: number; calendarFixed: number }> {
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

    // Re-expose Base utilities for compatibility
    invalidateCache(): void {
        super.invalidateCache();
        this.studentService.invalidateCache();
        this.academicService.invalidateCache();
        this.supplementaryService.invalidateCache();
        this.settingsService.invalidateCache();
        this.attendanceService.invalidateCache();
        this.administrativeService.invalidateCache();
        this.curriculumService.invalidateCache();
    }

    async getReleaseSettings(): Promise<ClassReleaseSettings> {
        return this.settingsService.getReleaseSettings();
    }

    async updateReleaseSettings(settings: ClassReleaseSettings): Promise<void> {
        return this.settingsService.updateReleaseSettings(settings);
    }

    async getEnrolledStudentsForSubject(subjectId: string, termKey?: string): Promise<StudentRecord[]> {
        const [subject, allStudents] = await Promise.all([
            this.academicService.getSubjectById(subjectId),
            this.studentService.getAllStudents(termKey)
        ]);
        
        if (!subject) return [];

        if (subject.subjectType === 'elective') {
            // Elective: only those explicitly enrolled
            const studentIds = subject.enrolledStudents || [];
            return allStudents.filter(s => studentIds.includes(s.id));
        } else {
            // General: All students who were in the target classes at that time
            const targetClasses = subject.targetClasses || [];
            return allStudents.filter(s => {
                // s.className is already resolved to the term's class in processStudentRecord
                return targetClasses.includes(s.className || '');
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
        return this.academicService.updateStudentINTMarks(studentId, subjectId, marks, termKey);
    }

    async bulkUpdateEXTMarks(updates: any[], termKey?: string): Promise<void> {
        return this.academicService.bulkUpdateEXTMarks(updates, termKey);
    }

    // --- Timetable & Scheduling ---
    async getAllTimetables(termKey?: string): Promise<any[]> {
        return this.administrativeService.getAllTimetables(termKey);
    }

    async getTimetableByClass(className: string, termKey?: string): Promise<any[]> {
        return this.administrativeService.getTimetableByClass(className, termKey);
    }

    async saveTimetableEntries(entries: any[]): Promise<void> {
        return this.administrativeService.saveTimetableEntries(entries);
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
        return this.academicService.getSupplementaryExamsByStudent(studentId);
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
}

export const dataService = new DataService();