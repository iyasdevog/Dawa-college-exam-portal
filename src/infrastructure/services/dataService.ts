import { BaseDataService } from './modules/BaseDataService';
import { StudentService } from './modules/StudentService';
import { AcademicService } from './modules/AcademicService';
import { SupplementaryService } from './modules/SupplementaryService';
import { SettingsService } from './modules/SettingsService';
import { AttendanceService } from './modules/AttendanceService';
import { AdministrativeService } from './modules/AdministrativeService';

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
    ClassReleaseSettings
} from '../../domain/entities/types';

export class DataService extends BaseDataService {
    private studentService: StudentService;
    private academicService: AcademicService;
    private supplementaryService: SupplementaryService;
    private settingsService: SettingsService;
    private attendanceService: AttendanceService;
    private administrativeService: AdministrativeService;

    constructor() {
        super();
        this.studentService = new StudentService();
        this.academicService = new AcademicService();
        this.supplementaryService = new SupplementaryService(this.studentService, this.academicService);
        this.settingsService = new SettingsService(this.studentService);
        this.attendanceService = new AttendanceService(this.academicService);
        this.administrativeService = new AdministrativeService(this.supplementaryService, this.studentService);
    }

    // --- Student Domain ---
    async getAllStudents(termKey?: string): Promise<StudentRecord[]> {
        return this.studentService.getAllStudents(termKey);
    }

    async getStudentByAdNo(adNo: string): Promise<StudentRecord | null> {
        return this.studentService.getStudentByAdNo(adNo);
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

    async deleteStudent(id: string): Promise<void> {
        return this.studentService.deleteStudent(id);
    }

    async promoteStudents(studentIds: string[], targetClass: string, targetYear: string, targetSemester: 'Odd' | 'Even'): Promise<void> {
        return this.studentService.promoteStudents(studentIds, targetClass, targetYear, targetSemester);
    }

    // --- Academic Domain ---
    async getAllSubjects(termKey?: string): Promise<SubjectConfig[]> {
        return this.academicService.getAllSubjects(termKey);
    }

    async getSubjectsByClass(className: string, termKey?: string): Promise<SubjectConfig[]> {
        return this.academicService.getSubjectsByClass(className, termKey);
    }

    async addSubject(subjectData: Omit<SubjectConfig, 'id'>): Promise<string> {
        return this.academicService.addSubject(subjectData);
    }

    async updateSubject(id: string, updates: Partial<SubjectConfig>): Promise<void> {
        return this.academicService.updateSubject(id, updates);
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

    async updateSupplementaryExamMarks(examId: string, marks: any): Promise<void> {
        return this.supplementaryService.updateSupplementaryExamMarks(examId, marks);
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
    async getAllApplications(): Promise<StudentApplication[]> {
        return this.administrativeService.getAllApplications();
    }

    async getApplicationsByAdNo(adNo: string): Promise<StudentApplication[]> {
        return this.administrativeService.getApplicationsByAdNo(adNo);
    }

    async updateApplicationStatus(id: string, status: ApplicationStatus, adminComment?: string): Promise<void> {
        return this.administrativeService.updateApplicationStatus(id, status, adminComment);
    }

    async downloadFullSystemBackup(): Promise<void> {
        return this.administrativeService.downloadFullSystemBackup();
    }

    public async normalizeAllFacultyNames(): Promise<number> {
        return this.academicService.normalizeAllFacultyNames();
    }

    public calculateTermMetrics(marks: Record<string, SubjectMarks>, subjects: SubjectConfig[], supplementaryMarks?: Record<string, SubjectMarks>): { grandTotal: number; average: number; performanceLevel: PerformanceLevel } {
        return this.academicService.calculateTermMetrics(marks, subjects, supplementaryMarks);
    }

    public async restoreTermFromBackup(backupJson: Record<string, any[]>, termKey: string, forceOverwrite = false): Promise<{ processed: number; students: number; subjects: number }> {
        return this.administrativeService.restoreTermFromBackup(backupJson, termKey, forceOverwrite);
    }

    // --- New Facade Mappings ---

    async exportMarksToExcel(className: string, termKey: string): Promise<void> {
        return this.academicService.exportMarksToExcel(className, termKey);
    }

    async importMarksFromExcel(file: File, termKey: string): Promise<{ updated: number; errors: string[] }> {
        return this.academicService.importMarksFromExcel(file, termKey);
    }

    async importStudentsFromExcel(file: File): Promise<{ updated: number; created: number; errors: string[] }> {
        return this.studentService.importStudentsFromExcel(file);
    }

    async bulkImportStudents(students: any[]): Promise<{ updated: number; created: number; errors: string[] }> {
        return this.studentService.bulkImportStudents(students);
    }

    parseStudentCSV(csvData: string): any[] {
        return this.studentService.parseStudentCSV(csvData);
    }

    async getSemesterSummaries(): Promise<any[]> {
        return this.academicService.getSemesterSummaries();
    }

    async recalculateAllMarkStatuses(): Promise<{ updated: number }> {
        return this.academicService.recalculateAllMarkStatuses();
    }

    async recalculateAllStudentTotals(): Promise<{ updated: number }> {
        return this.academicService.recalculateAllStudentTotals();
    }

    async recalculateAllStudentPerformanceLevels(): Promise<{ updated: number }> {
        return this.academicService.recalculateAllStudentPerformanceLevels();
    }

    async syncAllAvailableYears(): Promise<{ updated: boolean }> {
        return this.settingsService.syncAllAvailableYears();
    }

    async deleteSemesterData(termKey: string): Promise<void> {
        return this.administrativeService.deleteSemesterData(termKey);
    }

    async cleanAndSyncApplications(targetTermKey: string): Promise<{ synced: number; duplicatesDeleted: number; rejectedDeleted: number; notRegistered: number }> {
        return this.administrativeService.cleanAndSyncApplications(targetTermKey);
    }

    async repairAndAlignSupplementaryExams(): Promise<{ updated: number; repaired: number }> {
        return this.administrativeService.repairAndAlignSupplementaryExams();
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

    // Re-expose Base utilities for compatibility
    invalidateCache(): void {
        super.invalidateCache();
    }

    async getReleaseSettings(): Promise<ClassReleaseSettings> {
        return this.settingsService.getReleaseSettings();
    }

    async updateReleaseSettings(settings: ClassReleaseSettings): Promise<void> {
        return this.settingsService.updateReleaseSettings(settings);
    }

    async getEnrolledStudentsForSubject(subjectId: string, termKey?: string): Promise<StudentRecord[]> {
        const studentIds = await this.academicService.getEnrolledStudentsForSubject(subjectId, termKey);
        const allStudents = await this.studentService.getAllStudents(termKey);
        return allStudents.filter(s => studentIds.includes(s.id));
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
}

export const dataService = new DataService();