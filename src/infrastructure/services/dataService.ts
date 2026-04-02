import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    setDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    writeBatch,
    onSnapshot,
    Unsubscribe,
    deleteField
} from 'firebase/firestore';
import { getDb } from '../config/firebaseConfig';
import { StudentRecord, SubjectConfig, SupplementaryExam, SubjectMarks, PerformanceLevel, ClassReleaseSettings, GlobalSettings, TermRecord, StudentApplication, ApplicationType, ApplicationStatus, AttendanceRecord, TimetableEntry, SpecialDay, ExamTimetableEntry, HallTicketSettings, AcademicCalendarEntry, TimetableGeneratorConfig } from '../../domain/entities/types';
import { CLASSES } from '../../domain/entities/constants';
import { loadExcelLibrary } from './dynamicImports';
import { normalizeName } from './formatUtils';

export class DataService {
    // Helper to calculate performance level
    // Helper to calculate performance level
    private calculatePerformanceLevel(marks: Record<string, any>, subjects: SubjectConfig[]): PerformanceLevel {
        const marksEntries = Object.entries(marks);
        if (marksEntries.length === 0) return 'F (Failed)';

        let minPercentage = 100;
        let hasMarks = false;
        let hasFailedSubject = false;

        for (const [subjectId, mark] of marksEntries) {
            const subject = subjects.find(s => s.id === subjectId);
            if (!subject) continue;

            // Skip subjects that shouldn't be counted for grading if necessary
            // For now, count all subjects that have marks
            const totalMax = (subject.maxINT || 0) + (subject.maxEXT || 0);
            if (totalMax === 0) continue;

            hasMarks = true;
            
            // If any subject is marked as Failed by the system logic, the overall grade is Failed
            if (mark.status === 'Failed') {
                hasFailedSubject = true;
            }

            const percentage = (this.getMarkValue(mark.total) / totalMax) * 100;
            if (percentage < minPercentage) {
                minPercentage = percentage;
            }
        }

        if (hasFailedSubject || minPercentage < 40) return 'F (Failed)';
        if (!hasMarks) return 'C (Average)';

        if (minPercentage >= 95) return 'O (Outstanding)';
        if (minPercentage >= 85) return 'A+ (Excellent)';
        if (minPercentage >= 75) return 'A (Very Good)';
        if (minPercentage >= 65) return 'B+ (Good)';
        if (minPercentage >= 55) return 'B (Good)';
        return 'C (Average)';
    }

    // Collections
    private studentsCollection = 'students';
    private subjectsCollection = 'subjects';
    private supplementaryExamsCollection = 'supplementaryExams';
    private settingsCollection = 'settings';
    private applicationsCollection = 'applications';
    private attendanceCollection = 'attendance';
    private timetablesCollection = 'timetables';
    private specialDaysCollection = 'specialDays';
    private examTimetablesCollection = 'examTimetables';
    private hallTicketSettingsCollection = 'hallTicketSettings';
    private academicCalendarCollection = 'academicCalendar';
    private generatorConfigsCollection = 'generatorConfigs';

    // Application related methods
    async submitApplication(appData: Omit<StudentApplication, 'id' | 'status' | 'createdAt'>): Promise<string> {
        try {
            const db = this.db;
            const newApp = this.sanitize({
                ...appData,
                status: 'pending' as ApplicationStatus,
                createdAt: Date.now()
            });
            const docRef = await addDoc(collection(db, this.applicationsCollection), newApp);
            return docRef.id;
        } catch (error) {
            console.error('Error submitting application:', error);
            throw error;
        }
    }

    async getApplicationsByAdNo(adNo: string): Promise<StudentApplication[]> {
        try {
            const db = this.db;
            const q = query(collection(db, this.applicationsCollection), where('adNo', '==', adNo), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentApplication));
        } catch (error) {
            console.error('Error fetching applications by AdNo:', error);
            // Fallback: if index is missing or error, return all and filter client-side
            const querySnapshot = await getDocs(collection(this.db, this.applicationsCollection));
            return querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as StudentApplication))
                .filter(app => app.adNo === adNo)
                .sort((a, b) => b.createdAt - a.createdAt);
        }
    }

    async getAllApplications(): Promise<StudentApplication[]> {
        try {
            const db = this.db;
            const querySnapshot = await getDocs(collection(db, this.applicationsCollection));
            return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudentApplication));
        } catch (error) {
            console.error('Error fetching all applications:', error);
            return [];
        }
    }

    async updateApplicationStatus(id: string, status: ApplicationStatus, adminComment?: string): Promise<void> {
        try {
            const db = this.db;
            const appRef = doc(db, this.applicationsCollection, id);
            const updates = this.sanitize({ status, adminComment });
            await updateDoc(appRef, updates);

            // Sync with Supplementary Exam system if approved
            if (status === 'approved') {
                const application = await this.getApplicationById(id);
                if (application && ['improvement', 'revaluation', 'external-supp', 'internal-supp', 'special-supp'].includes(application.type)) {
                    await this.syncApplicationToSupplementary(application);
                }
            }
        } catch (error) {
            console.error('Error updating application status:', error);
            throw error;
        }
    }

    async deleteApplication(id: string): Promise<void> {
        try {
            const db = this.db;
            const appRef = doc(db, this.applicationsCollection, id);
            await deleteDoc(appRef);
        } catch (error) {
            console.error('Error deleting application:', error);
            throw error;
        }
    }

    // Cache for performance optimization - Upgraded to Map for term-level isolation
    private studentsCache = new Map<string, StudentRecord[]>();
    private subjectsCache: SubjectConfig[] | null = null;
    private supplementaryCache = new Map<string, SupplementaryExam[]>();
    private cacheTimestamp: number = 0;
    private currentGlobalSettings: GlobalSettings | null = null;
    private readonly DEFAULT_ACADEMIC_YEAR = "2025-2026";
    private readonly DEFAULT_SEMESTER = "Odd";
    private readonly ATTENDANCE_START = "2026-04-01";
    private readonly ATTENDANCE_END = "2026-08-31";
    private readonly CACHE_DURATION = 300000; // 5 minutes cache for better performance
    
    public clearCache() {
        this.studentsCache.clear();
        this.subjectsCache = null;
        this.supplementaryCache.clear();
        this.cacheTimestamp = 0;
        this.currentGlobalSettings = null;
    }

    // Helper method to get database instance
    private get db() {
        const database = getDb();
        if (!database) {
            throw new Error('Firebase not initialized');
        }
        return database;
    }

    public getDb() {
        return this.db;
    }

    // Initialize database - NO automatic seeding
    async initializeDatabase(): Promise<void> {
        try {
            console.log('Database connection verified - system starts empty');
            // Just verify connection, don't seed any data
            await this.testConnection();
        } catch (error) {
            console.error('Error initializing database:', error);
            throw error;
        }
    }

    // Helper to treat 'A' as 0
    private getMarkValue(mark: number | 'A' | undefined | null): number {
        if (mark === 'A') return 0;
        if (typeof mark === 'number') {
            return isNaN(mark) ? 0 : mark;
        }
        return 0;
    }

    /**
     * Safely strips undefined values from an object before sending to Firestore.
     */
    private sanitize(data: any): any {
        return JSON.parse(JSON.stringify(data));
    }

    /**
     * Centralized logic to calculate grandTotal, average and performanceLevel for a term.
     */
    private calculateTermMetrics(marks: Record<string, SubjectMarks>, subjects: SubjectConfig[]): {
        grandTotal: number;
        average: number;
        performanceLevel: PerformanceLevel;
    } {
        const marksEntries = Object.entries(marks);
        const grandTotal = marksEntries.reduce((sum, [_, mark]) => sum + this.getMarkValue(mark.total), 0);

        // Track all subjects as normal subjects (1-for-1 counting)
        // This ensures elective failures and marks are fully integrated into the average
        const subjectCount = Object.keys(marks).length;

        let average = subjectCount > 0 ? grandTotal / subjectCount : 0;
        if (isNaN(average)) average = 0;
        average = Math.round(average * 100) / 100;

        const performanceLevel = this.calculatePerformanceLevel(marks, subjects);

        return { grandTotal, average, performanceLevel };
    }

    /**
     * Normalizes a student record from Firestore.
     * Maps legacy 'ta' and 'ce' fields in marks to 'int' and 'ext'.
     */
    private processStudentRecord(data: any, id: string, termKey?: string): StudentRecord {
        const currentTermKey = termKey || this.getCurrentTermKey();
        let academicHistory = data.academicHistory || {};
        const currentClass = data.currentClass || data.className || '';

        // Migration: If we have top-level marks but NO history at all, 
        // treat them as 2025-2026-Odd (the user's manual semester)
        if (data.marks && Object.keys(data.marks).length > 0 && Object.keys(academicHistory).length === 0) {
            academicHistory['2025-2026-Odd'] = {
                className: currentClass,
                semester: 'Odd',
                marks: data.marks,
                grandTotal: data.grandTotal || 0,
                average: data.average || 0,
                rank: data.rank || 0,
                performanceLevel: data.performanceLevel || 'C (Average)'
            };
        }

        // Extract marks ONLY for the requested term from history
        const termData = academicHistory[currentTermKey];
        const rawMarks = termData?.marks || {}; // No fallback to root data.marks

        const normalizedMarks: Record<string, SubjectMarks> = {};
        Object.entries(rawMarks).forEach(([subjectId, marks]: [string, any]) => {
            normalizedMarks[subjectId] = {
                int: marks.int !== undefined ? marks.int : (marks.ce !== undefined ? marks.ce : 0),
                ext: marks.ext !== undefined ? marks.ext : (marks.ta !== undefined ? marks.ta : 0),
                total: marks.total || 0,
                status: marks.status || 'Pending',
                isSupplementary: marks.isSupplementary,
                supplementaryYear: marks.supplementaryYear
            };
        });

        // Migration to new structure if needed (only if no academicHistory exists)
        if (!data.academicHistory && Object.keys(normalizedMarks).length > 0) {
            const legacyTerm = `${this.DEFAULT_ACADEMIC_YEAR}-${this.DEFAULT_SEMESTER}`;
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

        // Pull the requested term's totals if available, otherwise start with defaults
        const currentTotals = academicHistory[currentTermKey] || {
            grandTotal: 0,
            average: 0,
            rank: 0,
            performanceLevel: 'Pending' as PerformanceLevel
        };

        return {
            ...data,
            id,
            currentClass,
            academicHistory,
            // Reflect the ACTIVE term in the root fields for component compatibility
            className: termData?.className || currentClass,
            marks: normalizedMarks,
            semester: currentTermKey.split('-')[2] as 'Odd' | 'Even',
            grandTotal: currentTotals.grandTotal,
            average: currentTotals.average,
            rank: currentTotals.rank,
            performanceLevel: currentTotals.performanceLevel
        } as StudentRecord;
    }

    /**
     * Normalizes a subject configuration from Firestore.
     * Maps legacy 'maxTA' and 'maxCE' fields to 'maxINT' and 'maxEXT'.
     */
    private processSubjectConfig(data: any, id: string): SubjectConfig {
        return {
            ...data,
            id,
            // Mapping: TA -> EXT (70), CE -> INT (30)
            maxINT: data.maxINT !== undefined ? data.maxINT : (data.maxCE !== undefined ? data.maxCE : 0),
            maxEXT: data.maxEXT !== undefined ? data.maxEXT : (data.maxTA !== undefined ? data.maxTA : 0),
        } as SubjectConfig;
    }

    // Cache management
    private isCacheValid(): boolean {
        return this.cacheTimestamp > 0 && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
    }

    private invalidateCache(): void {
        this.studentsCache.clear();
        this.subjectsCache = null;
        this.supplementaryCache.clear();
        this.cacheTimestamp = 0;
    }

    private updateStudentInCache(studentId: string, updates: Partial<StudentRecord>, termKey?: string): void {
        const activeTerm = termKey || this.getCurrentTermKey();
        const cachedStudents = this.studentsCache.get(activeTerm);
        if (cachedStudents && this.isCacheValid()) {
            const index = cachedStudents.findIndex(s => s.id === studentId);
            if (index !== -1) {
                cachedStudents[index] = { ...cachedStudents[index], ...updates };
            }
        }
    }

    private updateCache(students?: StudentRecord[], subjects?: SubjectConfig[], termKey?: string): void {
        if (students && termKey) this.studentsCache.set(termKey, students);
        if (subjects) this.subjectsCache = subjects;
        this.cacheTimestamp = Date.now();
    }

    // Release Settings operations

    // Global Settings Operations
    async getGlobalSettings(): Promise<GlobalSettings> {
        try {
            const docRef = doc(this.db, this.settingsCollection, 'global_admin_settings');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as any;
                this.currentGlobalSettings = {
                    currentAcademicYear: data.currentAcademicYear || '2025-2026',
                    currentSemester: data.currentSemester || 'Odd',
                    availableYears: data.availableYears || ['2023-2024', '2024-2025', '2025-2026'],
                    attendanceStartDate: data.attendanceStartDate || '2026-04-01',
                    attendanceEndDate: data.attendanceEndDate || '2026-08-31',
                    minAttendancePercentage: data.minAttendancePercentage || 75
                };
                return this.currentGlobalSettings;
            }
            // Return defaults if not set
            return {
                currentAcademicYear: this.DEFAULT_ACADEMIC_YEAR,
                currentSemester: this.DEFAULT_SEMESTER,
                attendanceStartDate: this.ATTENDANCE_START,
                attendanceEndDate: this.ATTENDANCE_END
            };
        } catch (error) {
            console.error('Error getting global settings:', error);
            return { currentAcademicYear: this.DEFAULT_ACADEMIC_YEAR, currentSemester: this.DEFAULT_SEMESTER };
        }
    }

    async getAvailableTerms(): Promise<string[]> {
        try {
            const students = await this.getAllStudents();
            const terms = new Set<string>();

            // Add current default/global term
            const settings = await this.getGlobalSettings();
            const currentTerm = this.getCurrentTermKey(settings);
            terms.add(currentTerm);

            // Add terms from student history that match the permitted academic years
            const allowedYears = new Set(settings.availableYears || [settings.currentAcademicYear]);

            students.forEach(s => {
                if (s.academicHistory) {
                    Object.keys(s.academicHistory).forEach(termKey => {
                        // Extract year part from "2024-2025-Odd"
                        const yearMatch = termKey.match(/^(\d{4}-\d{4})/);
                        if (yearMatch && allowedYears.has(yearMatch[1])) {
                            terms.add(termKey);
                        }
                    });
                }
            });

            // Sort terms: 2025-2026-Even, 2025-2026-Odd, 2024-2025-Even...
            return Array.from(terms).sort((a, b) => {
                const yearA = a.substring(0, 9);
                const yearB = b.substring(0, 9);
                const semA = a.split('-')[2];
                const semB = b.split('-')[2];

                if (yearA !== yearB) return yearB.localeCompare(yearA);
                // Within same year, Odd comes before Even (if we want newest first, Even > Odd)
                return semB === 'Even' ? 1 : -1;
            });
        } catch (error) {
            console.error('Error fetching available terms:', error);
            return [this.getCurrentTermKey()];
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

    async addAcademicYear(year: string): Promise<void> {
        try {
            const settings = await this.getGlobalSettings();
            const availableYears = settings.availableYears || [];
            if (!availableYears.includes(year)) {
                await this.updateGlobalSettings({
                    ...settings,
                    availableYears: [...availableYears, year]
                });
            }
        } catch (error) {
            console.error('Error adding academic year:', error);
            throw error;
        }
    }

    getCurrentTermKey(settings?: GlobalSettings): string {
        const s = settings || this.currentGlobalSettings || { currentAcademicYear: this.DEFAULT_ACADEMIC_YEAR, currentSemester: this.DEFAULT_SEMESTER };
        return `${s.currentAcademicYear}-${s.currentSemester}`;
    }

    async getReleaseSettings(): Promise<ClassReleaseSettings> {
        try {
            const docRef = doc(this.db, this.settingsCollection, 'scorecard_release');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data() as ClassReleaseSettings;
            }
            return {};
        } catch (error) {
            console.error('Error getting release settings:', error);
            return {};
        }
    }

    async updateReleaseSettings(settings: ClassReleaseSettings): Promise<void> {
        try {
            const docRef = doc(this.db, this.settingsCollection, 'scorecard_release');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                await updateDoc(docRef, settings as any);
            } else {
                await setDoc(docRef, settings);
            }
        } catch (error) {
            console.error('Error updating release settings:', error);
            throw error;
        }
    }

    async getFacultyParticipantCodes(): Promise<Record<string, string>> {
        try {
            const docRef = doc(this.db, this.settingsCollection, 'faculty_participant_codes');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data() as Record<string, string>;
            }
            return {};
        } catch (error) {
            console.error('Error getting faculty codes:', error);
            return {};
        }
    }

    async saveFacultyParticipantCode(facultyName: string, code: string): Promise<void> {
        try {
            const docRef = doc(this.db, this.settingsCollection, 'faculty_participant_codes');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                await updateDoc(docRef, { [facultyName]: code });
            } else {
                await setDoc(docRef, { [facultyName]: code });
            }
        } catch (error) {
            console.error('Error saving faculty code:', error);
        }
    }

    async isScorecardReleased(className: string): Promise<boolean> {
        try {
            const settings = await this.getReleaseSettings();
            const classSettings = settings[className];
            if (!classSettings) return false;
            if (classSettings.isReleased) return true;
            if (classSettings.releaseDate) {
                return new Date(classSettings.releaseDate) <= new Date();
            }
            return false;
        } catch (error) {
            console.error('Error checking release status:', error);
            return false;
        }
    }

    async getAllStudents(termKey?: string): Promise<StudentRecord[]> {
        const activeTerm = termKey || this.getCurrentTermKey();

        // Return cached data if valid
        if (this.isCacheValid() && this.studentsCache.has(activeTerm)) {
            console.log(`Returning cached students data for term: ${activeTerm}`);
            return this.studentsCache.get(activeTerm)!;
        }

        try {
            console.log(`=== FETCHING STUDENTS FROM FIREBASE ${activeTerm ? `FOR TERM ${activeTerm}` : ''} ===`);
            // Remove orderBy to avoid composite index requirement
            const querySnapshot = await getDocs(collection(this.db, this.studentsCollection));

            const students = querySnapshot.docs.map(doc => this.processStudentRecord(doc.data(), doc.id, activeTerm));

            // Sort manually by import row number (priority) or rank
            students.sort((a, b) => {
                // If both have importRowNumber, use it (ascending)
                if (a.importRowNumber !== undefined && b.importRowNumber !== undefined) {
                    return a.importRowNumber - b.importRowNumber;
                }
                if (a.importRowNumber !== undefined) return -1;
                if (b.importRowNumber !== undefined) return 1;

                // Fallback to rank
                return (a.rank || 0) - (b.rank || 0);
            });

            console.log('Total students processed:', students.length);

            // Enrollment Term Lifecycle Filtering
            const currentGlobalTerm = this.getCurrentTermKey();
            const isCurrentTerm = activeTerm === currentGlobalTerm;

            const filteredStudents = students.filter(student => {
                const isActive = student.isActive !== false;
                if (isCurrentTerm) {
                    return isActive;
                } else {
                    return !!(student.academicHistory && student.academicHistory[activeTerm]);
                }
            });

            // Store the filtered result in the Map cache
            this.updateCache(filteredStudents, undefined, activeTerm);

            return filteredStudents;
        } catch (error) {
            console.error('Error fetching students:', error);
            return [];
        }
    }

    async getStudentsByClass(className: string, termKey?: string): Promise<StudentRecord[]> {
        try {
            // Get all students for the specified term
            const allStudents = await this.getAllStudents(termKey);
            const classStudents = allStudents.filter(student => student.className === className);

            console.log('Students found in class', className, 'for term', termKey || 'default', ':', classStudents.length);
            return classStudents;
        } catch (error) {
            console.error('Error fetching students by class:', error);
            return [];
        }
    }

    async getStudentByAdNo(adNo: string, termKey?: string): Promise<StudentRecord | null> {
        try {
            const q = query(
                collection(this.db, this.studentsCollection),
                where('adNo', '==', adNo)
            );

            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                return null;
            }

            const doc = querySnapshot.docs[0];
            return this.processStudentRecord(doc.data(), doc.id, termKey);
        } catch (error) {
            console.error('Error fetching student by admission number:', error);
            return null;
        }
    }

    async getStudentById(id: string, termKey?: string): Promise<StudentRecord | null> {
        try {
            const docRef = doc(this.db, this.studentsCollection, id);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? this.processStudentRecord(docSnap.data(), docSnap.id, termKey) : null;
        } catch (error) {
            console.error('Error fetching student by ID:', error);
            return null;
        }
    }

    async addStudent(student: Omit<StudentRecord, 'id'>): Promise<string> {
        try {
            const cleanStudent = this.sanitize({ ...student, isActive: true });
            const docRef = await addDoc(collection(this.db, this.studentsCollection), cleanStudent);
            console.log('Student added with ID:', docRef.id);
            
            // Proactively add to cache
            this.updateStudentInCache(docRef.id, this.processStudentRecord(cleanStudent, docRef.id));
            
            return docRef.id;
        } catch (error) {
            console.error('Error adding student:', error);
            throw error;
        }
    }

    async updateStudent(id: string, updates: Partial<StudentRecord>): Promise<void> {
        try {
            const docRef = doc(this.db, this.studentsCollection, id);
            const cleanUpdates = this.sanitize(updates);
            await updateDoc(docRef, cleanUpdates);
            console.log('Student updated:', id);
            
            // Proactively update cache
            this.updateStudentInCache(id, cleanUpdates);
        } catch (error) {
            console.error('Error updating student:', error);
            throw error;
        }
    }

    async archiveStudent(id: string): Promise<void> {
        try {
            const docRef = doc(this.db, this.studentsCollection, id);
            await updateDoc(docRef, { isActive: false });
            
            // Soft-delete from cache as well
            this.clearCache();
        } catch (error) {
            console.error('Error archiving student:', error);
            throw error;
        }
    }

    async promoteClass(fromClass: string, toClass: string, termKey: string): Promise<void> {
        try {
            console.log(`Promoting class from ${fromClass} to ${toClass} for term ${termKey}`);
            const students = await this.getAllStudents(); // Gets active students
            const classStudents = students.filter(s => s.className === fromClass && s.isActive !== false);

            if (classStudents.length === 0) {
                throw new Error(`No active students found in class ${fromClass}`);
            }

            const batch = writeBatch(this.db);
            const academicYear = termKey.split('-')[0];
            const semester = termKey.split('-')[1] as 'Odd' | 'Even';

            for (const student of classStudents) {
                const docRef = doc(this.db, this.studentsCollection, student.id);
                
                // Initialize new term record in history
                const newTermRecord: TermRecord = {
                    className: toClass,
                    semester: semester,
                    marks: {},
                    grandTotal: 0,
                    average: 0,
                    rank: 0,
                    performanceLevel: 'C (Average)'
                };

                const updates: any = {
                    className: toClass,
                    currentClass: toClass, // Keep consistency
                    [`academicHistory.${termKey}`]: newTermRecord
                };

                batch.update(docRef, updates);
            }

            await batch.commit();
            this.clearCache();
            console.log(`Successfully promoted ${classStudents.length} students to ${toClass}`);
        } catch (error) {
            console.error('Error promoting class:', error);
            throw error;
        }
    }

    async deleteStudent(id: string): Promise<void> {
        try {
            console.log('Attempting to delete student with ID:', id);

            if (!id || id.trim() === '') {
                throw new Error('Invalid student ID provided');
            }

            // First check if the document exists
            const docRef = doc(this.db, this.studentsCollection, id);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                console.error(`Student document with ID ${id} does not exist in Firestore`);
                throw new Error(`Student with ID ${id} does not exist`);
            }

            console.log('Student document found, proceeding with deletion...');
            await deleteDoc(docRef);
            console.log('Student deleted successfully:', id);
            this.invalidateCache();
        } catch (error) {
            console.error('Error deleting student:', error);
            if (error instanceof Error) {
                throw new Error(`Failed to delete student: ${error.message}`);
            } else {
                throw new Error('Failed to delete student: Unknown error');
            }
        }
    }

    // Subject operations
    async getRawSubjects(): Promise<SubjectConfig[]> {
        try {
            const q = query(collection(this.db, this.subjectsCollection));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubjectConfig));
        } catch (error) {
            console.error('Error fetching raw subjects:', error);
            return [];
        }
    }

    async getSubjectsByClass(className: string, termKey?: string): Promise<SubjectConfig[]> {
        try {
            const settings = await this.getGlobalSettings();
            
            let targetYear = settings.currentAcademicYear;
            let targetSem = settings.currentSemester;
            
            if (termKey) {
                const parts = termKey.split('-');
                if (parts.length >= 3) {
                    targetSem = parts.pop() as 'Odd' | 'Even';
                    targetYear = parts.join('-');
                }
            }

            const q = query(collection(this.db, this.subjectsCollection));
            const snapshot = await getDocs(q);
            const allSubjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubjectConfig));
            
            return allSubjects.filter(subject => {
                const matchesClass = subject.targetClasses.includes(className);
                if (!matchesClass) return false;
                
                // Semester filter
                if (subject.activeSemester && subject.activeSemester !== 'Both' && subject.activeSemester !== targetSem) {
                    return false;
                }
                
                // Strict Academic Year filter
                if (subject.academicYear && subject.academicYear !== targetYear) {
                    return false;
                }
                
                // If we have a specific targetYear and targetSem, and the subject has them defined, 
                // we should be strict to avoid duplicates from other years/semesters.
                // However, we allow subjects with NO academicYear for backward compatibility 
                // ONLY if no year-specific version of that same subject exists.
                if (!subject.academicYear) {
                    const hasYearSpecificVersion = allSubjects.some(s => 
                        s.name === subject.name && 
                        s.academicYear === targetYear && 
                        (s.activeSemester === 'Both' || s.activeSemester === targetSem)
                    );
                    if (hasYearSpecificVersion) return false;
                }

                return true;
            });
        } catch (error) {
            console.error('Error fetching subjects:', error);
            return [];
        }
    }

    async getAllSubjects(termKey?: string): Promise<SubjectConfig[]> {
        try {
            const settings = await this.getGlobalSettings();
            
            let targetYear = settings.currentAcademicYear;
            let targetSem = settings.currentSemester;
            
            if (termKey) {
                const parts = termKey.split('-');
                if (parts.length >= 3) {
                    targetSem = parts.pop() as 'Odd' | 'Even';
                    targetYear = parts.join('-');
                }
            }

            const snapshot = await getDocs(collection(this.db, this.subjectsCollection));
            const allSubjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubjectConfig));
            
            return allSubjects.filter(subject => {
                 // Semester filter
                 if (subject.activeSemester && subject.activeSemester !== 'Both' && subject.activeSemester !== targetSem) {
                    return false;
                }
                
                // Strict Academic Year filter
                if (subject.academicYear && subject.academicYear !== targetYear) {
                    return false;
                }

                // De-duplicate: Prioritize year-specific subjects over global ones
                if (!subject.academicYear) {
                    const hasYearSpecificVersion = allSubjects.some(s => 
                        s.name === subject.name && 
                        s.academicYear === targetYear && 
                        (s.activeSemester === 'Both' || s.activeSemester === targetSem)
                    );
                    if (hasYearSpecificVersion) return false;
                }
                
                return true;
            });
        } catch (error) {
            console.error('Error fetching all subjects:', error);
            return [];
        }
    }

    async isEligibleForHallTicket(studentId: string, className: string, termKey?: string): Promise<{ eligible: boolean, percentage: number, required: number }> {
        try {
            const settings = await this.getGlobalSettings();
            const required = settings.minAttendancePercentage || 75;
            const percentage = await this.getOverallAttendance(studentId, className, termKey);
            
            return {
                eligible: percentage >= required,
                percentage,
                required
            };
        } catch (error) {
            console.error('Error checking hall ticket eligibility:', error);
            return { eligible: true, percentage: 100, required: 75 }; // Default to eligible on error
        }
    }

    async addSubject(subject: Omit<SubjectConfig, 'id'>): Promise<string> {
        try {
            // Normalize faculty name before saving
            const normalizedSubject = {
                ...subject,
                facultyName: subject.facultyName ? normalizeName(subject.facultyName) : ''
            };
            const docRef = await addDoc(collection(this.db, this.subjectsCollection), normalizedSubject);
            console.log('Subject added with ID:', docRef.id);
            this.invalidateCache();
            return docRef.id;
        } catch (error) {
            console.error('Error adding subject:', error);
            throw error;
        }
    }

    async updateSubject(id: string, updates: Partial<SubjectConfig>): Promise<void> {
        try {
            const docRef = doc(this.db, this.subjectsCollection, id);

            // Normalize faculty name if it's being updated
            const normalizedUpdates = { ...updates };
            if (updates.facultyName !== undefined) {
                normalizedUpdates.facultyName = updates.facultyName ? normalizeName(updates.facultyName) : '';
            }

            await updateDoc(docRef, normalizedUpdates);
            console.log('Subject updated:', id);
            this.invalidateCache();
        } catch (error) {
            console.error('Error updating subject:', error);
            throw error;
        }
    }

    async deleteSubject(id: string): Promise<void> {
        try {
            console.log('Attempting to delete subject with ID:', id);

            if (!id || id.trim() === '') {
                throw new Error('Invalid subject ID provided');
            }

            // First check if the document exists
            const docRef = doc(this.db, this.subjectsCollection, id);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                console.error(`Subject document with ID ${id} does not exist in Firestore`);
                throw new Error(`Subject with ID ${id} does not exist`);
            }

            console.log('Subject document found, proceeding with deletion...');
            await deleteDoc(docRef);
            console.log('Subject deleted successfully:', id);
            this.invalidateCache();
        } catch (error) {
            console.error('Error deleting subject:', error);
            if (error instanceof Error) {
                throw new Error(`Failed to delete subject: ${error.message}`);
            } else {
                throw new Error('Failed to delete subject: Unknown error');
            }
        }
    }

    // Student enrollment operations for elective subjects
    async enrollStudentInSubject(subjectId: string, studentId: string): Promise<void> {
        try {
            const subjectDoc = await getDoc(doc(this.db, this.subjectsCollection, subjectId));
            if (!subjectDoc.exists()) {
                throw new Error('Subject not found');
            }

            const subject = this.processSubjectConfig(subjectDoc.data(), subjectDoc.id);
            if (subject.subjectType !== 'elective') {
                throw new Error('Cannot enroll students in general subjects');
            }

            const enrolledStudents = subject.enrolledStudents || [];
            if (!enrolledStudents.includes(studentId)) {
                enrolledStudents.push(studentId);
                await updateDoc(doc(this.db, this.subjectsCollection, subjectId), {
                    enrolledStudents
                });
                this.invalidateCache();
            }

            console.log('Student enrolled in subject:', studentId, subjectId);
        } catch (error) {
            console.error('Error enrolling student in subject:', error);
            throw error;
        }
    }

    async unenrollStudentFromSubject(subjectId: string, studentId: string): Promise<void> {
        try {
            const subjectDoc = await getDoc(doc(this.db, this.subjectsCollection, subjectId));
            if (!subjectDoc.exists()) {
                throw new Error('Subject not found');
            }

            const subject = this.processSubjectConfig(subjectDoc.data(), subjectDoc.id);
            const enrolledStudents = subject.enrolledStudents || [];
            const updatedEnrolledStudents = enrolledStudents.filter(id => id !== studentId);

            await updateDoc(doc(this.db, this.subjectsCollection, subjectId), {
                enrolledStudents: updatedEnrolledStudents
            });
            this.invalidateCache();

            console.log('Student unenrolled from subject:', studentId, subjectId);
        } catch (error) {
            console.error('Error unenrolling student from subject:', error);
            throw error;
        }
    }

    async getEnrolledStudentsForSubject(subjectId: string, termKey?: string): Promise<StudentRecord[]> {
        try {
            console.log('=== DEBUGGING getEnrolledStudentsForSubject ===');
            console.log('Subject ID:', subjectId, 'Term:', termKey);

            const subjectDoc = await getDoc(doc(this.db, this.subjectsCollection, subjectId));
            if (!subjectDoc.exists()) {
                console.log('Subject document does not exist!');
                return [];
            }

            const subject = this.processSubjectConfig(subjectDoc.data(), subjectDoc.id);
            if (subject.subjectType === 'general') {
                // For general subjects, return all students from target classes
                const allStudents: StudentRecord[] = [];
                for (const className of subject.targetClasses) {
                    const classStudents = await this.getStudentsByClass(className, termKey);
                    allStudents.push(...classStudents);
                }
                return allStudents;
            } else {
                // For elective subjects, return only enrolled students
                const enrolledStudentIds = subject.enrolledStudents || [];
                if (enrolledStudentIds.length === 0) return [];

                const allStudents = await this.getAllStudents(termKey);
                return allStudents.filter(student => enrolledStudentIds.includes(student.id));
            }
        } catch (error) {
            console.error('Error getting enrolled students for subject:', error);
            return [];
        }
    }

    /**
     * Adds a supplementary exam, automatically calculating the attempt number
     * and tracking the original failure term.
     */
    async addSupplementaryExam(supplementaryExam: Omit<SupplementaryExam, 'id'>): Promise<string> {
        try {
            // Find existing attempts for this student and subject to determine the next attempt number
            // and the original failure term.
            const existingExams = await this.getSupplementaryExamHistory(supplementaryExam.studentId, supplementaryExam.subjectId);
            
            let nextAttempt = 1;
            let originalTerm = supplementaryExam.examTerm || this.getCurrentTermKey();

            if (existingExams.length > 0) {
                // Get the highest attempt number and increment it
                const highestAttempt = Math.max(...existingExams.map(e => e.attemptNumber || 0));
                nextAttempt = highestAttempt + 1;
                
                // Use the original term from the first attempt
                const firstAttempt = existingExams.sort((a, b) => a.appliedAt - b.appliedAt)[0];
                originalTerm = firstAttempt.originalTerm || firstAttempt.examTerm;
            }

            const data = {
                ...supplementaryExam,
                attemptNumber: nextAttempt,
                originalTerm: originalTerm,
                examTerm: supplementaryExam.examTerm || this.getCurrentTermKey(),
                appliedAt: supplementaryExam.appliedAt || Date.now(),
                updatedAt: Date.now()
            };

            const docRef = await addDoc(collection(this.db, this.supplementaryExamsCollection), data);
            console.log('Supplementary exam added with ID:', docRef.id, 'Attempt:', nextAttempt);
            return docRef.id;
        } catch (error) {
            console.error('Error adding supplementary exam:', error);
            throw error;
        }
    }

    /**
     * Retrieves all supplementary exam attempts for a specific student and subject.
     */
    async getSupplementaryExamHistory(studentId: string, subjectId: string): Promise<SupplementaryExam[]> {
        try {
            const q = query(
                collection(this.db, this.supplementaryExamsCollection),
                where('studentId', '==', studentId),
                where('subjectId', '==', subjectId)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplementaryExam))
                .sort((a, b) => a.appliedAt - b.appliedAt);
        } catch (error) {
            console.error('Error fetching supplementary history:', error);
            return [];
        }
    }

    async getSupplementaryExamsByStudent(studentId: string): Promise<SupplementaryExam[]> {
        try {
            const q = query(
                collection(this.db, this.supplementaryExamsCollection),
                where('studentId', '==', studentId)
            );

            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as SupplementaryExam));
        } catch (error) {
            console.error('Error fetching supplementary exams for student:', error);
            return [];
        }
    }

    async getSupplementaryExamsBySubject(subjectId: string, year?: number): Promise<SupplementaryExam[]> {
        try {
            let q = query(
                collection(this.db, this.supplementaryExamsCollection),
                where('subjectId', '==', subjectId)
            );

            if (year) {
                q = query(q, where('supplementaryYear', '==', year));
            }

            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as SupplementaryExam));
        } catch (error) {
            console.error('Error fetching supplementary exams for subject:', error);
            return [];
        }
    }

    async deleteSupplementaryExam(supplementaryExamId: string): Promise<void> {
        try {
            const docRef = doc(this.db, this.supplementaryExamsCollection, supplementaryExamId);
            await deleteDoc(docRef);
            console.log('Supplementary exam deleted:', supplementaryExamId);
        } catch (error) {
            console.error('Error deleting supplementary exam:', error);
            throw error;
        }
    }

    async deleteAllSupplementaryExams(): Promise<void> {
        try {
            console.log('Starting to clear all supplementary exam data...');

            // Get all exams
            const snapshot = await getDocs(collection(this.db, this.supplementaryExamsCollection));
            console.log(`Found ${snapshot.docs.length} supplementary exams to delete`);

            // Delete all
            const batch = writeBatch(this.db);
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            console.log('All supplementary exam data cleared successfully');
        } catch (error) {
            console.error('Error clearing supplementary exam data:', error);
            throw error;
        }
    }

    async getStudentsWithSupplementaryExams(subjectId: string, year: number): Promise<{ student: StudentRecord, supplementaryExam: SupplementaryExam }[]> {
        try {
            // Get supplementary exams for the subject and year
            const supplementaryExams = await this.getSupplementaryExamsBySubject(subjectId, year);

            // Get student details for each supplementary exam
            const results: { student: StudentRecord, supplementaryExam: SupplementaryExam }[] = [];

            for (const suppExam of supplementaryExams) {
                const studentDoc = await getDoc(doc(this.db, this.studentsCollection, suppExam.studentId));
                if (studentDoc.exists()) {
                    const student = this.processStudentRecord(studentDoc.data(), studentDoc.id);
                    results.push({ student, supplementaryExam: suppExam });
                }
            }

            return results;
        } catch (error) {
            console.error('Error getting students with supplementary exams:', error);
            return [];
        }
    }

    async getAllSupplementaryExams(termKey?: string): Promise<(SupplementaryExam & { studentName?: string; studentAdNo?: string; subjectName?: string })[]> {
        try {
            let q = query(collection(this.db, this.supplementaryExamsCollection));
            
            if (termKey && termKey !== 'All') {
                q = query(q, where('examTerm', '==', termKey));
            }

            const snapshot = await getDocs(q);
            const exams = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SupplementaryExam));

            // Enrich with student and subject details
            const [allStudents, allSubjects] = await Promise.all([
                this.getAllStudents(),
                this.getAllSubjects()
            ]);
            const studentMap = new Map(allStudents.map(s => [s.id, s]));
            const subjectMap = new Map(allSubjects.map(s => [s.id, s]));

            return exams.map(exam => {
                const student = studentMap.get(exam.studentId);
                const subject = subjectMap.get(exam.subjectId);
                return {
                    ...exam,
                    studentName: student?.name,
                    studentAdNo: student?.adNo,
                    subjectName: subject?.name,
                    studentClass: student?.className // Added for filtering in UI
                };
            });
        } catch (error) {
            console.error('Error fetching all supplementary exams:', error);
            return [];
        }
    }

    /**
     * One-time migration to backfill legacy supplementary records with term-scoped metadata.
     */
    async migrateLegacySupplementaryData(): Promise<{ total: number, migrated: number, applicationSync: number }> {
        try {
            const colRef = collection(this.db, this.supplementaryExamsCollection);
            const snapshot = await getDocs(colRef);
            let migrated = 0;

            const batch = writeBatch(this.db);
            snapshot.docs.forEach(d => {
                const data = d.data() as SupplementaryExam;
                if (!data.examTerm) {
                    const year = data.supplementaryYear || new Date().getFullYear();
                    const sem = data.originalSemester || 'Odd';
                    const term = `${year}-${year + 1}-${sem}`;
                    
                    batch.update(d.ref, {
                        examTerm: term,
                        originalTerm: data.originalTerm || term,
                        attemptNumber: data.attemptNumber || 1,
                        updatedAt: Date.now()
                    });
                    migrated++;
                }
            });

            if (migrated > 0) {
                await batch.commit();
            }

            // Also sync approved applications that might have been missed
            const appSyncCount = await this.syncAllApprovedApplications();

            return { total: snapshot.docs.length, migrated, applicationSync: appSyncCount };
        } catch (error) {
            console.error('Migration failed:', error);
            throw error;
        }
    }

    /**
     * Scans all applications and ensures all 'approved' ones have a corresponding supplementary entry.
     */
    async syncAllApprovedApplications(): Promise<number> {
        try {
            const q = query(
                collection(this.db, this.applicationsCollection),
                where('status', '==', 'approved')
            );
            const snapshot = await getDocs(q);
            let count = 0;

            for (const doc of snapshot.docs) {
                const app = { id: doc.id, ...doc.data() } as StudentApplication;
                // Only sync if it's a type that requires supplementary (Revaluation/Improvement/Supp)
                if (['revaluation', 'improvement', 'external-supp', 'internal-supp', 'special-supp'].includes(app.type)) {
                    await this.syncApplicationToSupplementary(app);
                    count++;
                }
            }
            return count;
        } catch (error) {
            console.error('Error in bulk application sync:', error);
            return 0;
        }
    }

    // Real-time listeners
    subscribeToStudents(callback: (students: StudentRecord[]) => void): Unsubscribe {
        return onSnapshot(
            // Remove orderBy to avoid composite index requirement
            collection(this.db, this.studentsCollection),
            (snapshot) => {
                const students = snapshot.docs.map(doc => this.processStudentRecord(doc.data(), doc.id));

                // Sort manually by import row number (priority) or rank
                students.sort((a, b) => {
                    if (a.importRowNumber !== undefined && b.importRowNumber !== undefined) {
                        return a.importRowNumber - b.importRowNumber;
                    }
                    if (a.importRowNumber !== undefined) return -1;
                    if (b.importRowNumber !== undefined) return 1;
                    return (a.rank || 0) - (b.rank || 0);
                });

                callback(students);
            },
            (error) => {
                console.error('Error in students subscription:', error);
            }
        );
    }

    subscribeToSubjects(callback: (subjects: SubjectConfig[]) => void): Unsubscribe {
        return onSnapshot(
            collection(this.db, this.subjectsCollection),
            (snapshot) => {
                const subjects = snapshot.docs.map(doc => this.processSubjectConfig(doc.data(), doc.id));
                callback(subjects);
            },
            (error) => {
                console.error('Error in subjects subscription:', error);
            }
        );
    }

    // Bulk operations
    async bulkImportStudents(students: Omit<StudentRecord, 'id'>[]): Promise<{ success: number; errors: string[] }> {
        const results = { success: 0, errors: [] as string[] };

        try {
            // Process in batches of 500 (Firestore limit)
            const batchSize = 500;

            for (let i = 0; i < students.length; i += batchSize) {
                const batch = writeBatch(this.db);
                const currentBatch = students.slice(i, i + batchSize);

                for (const student of currentBatch) {
                    try {
                        // Validate student data
                        if (!student.adNo || !student.name || !student.className) {
                            results.errors.push(`Row ${i + currentBatch.indexOf(student) + 1}: Missing required fields (adNo, name, or className)`);
                            continue;
                        }

                        // Check for duplicate admission numbers
                        const existingStudent = await this.getStudentByAdNo(student.adNo);
                        if (existingStudent) {
                            results.errors.push(`Row ${i + currentBatch.indexOf(student) + 1}: Student with admission number ${student.adNo} already exists`);
                            continue;
                        }

                        const docRef = doc(collection(this.db, this.studentsCollection));
                        const studentData = this.sanitize({
                            ...student,
                            marks: student.marks || {},
                            grandTotal: student.grandTotal || 0,
                            average: student.average || 0,
                            rank: student.rank || 0,
                            performanceLevel: student.performanceLevel || 'C (Average)'
                        });
                        batch.set(docRef, studentData);

                        results.success++;
                    } catch (error) {
                        results.errors.push(`Row ${i + currentBatch.indexOf(student) + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }

                if (results.success > 0) {
                    await batch.commit();
                }
            }

            // Recalculate rankings for all affected classes
            const affectedClasses = [...new Set(students.map(s => s.className))];
            for (const className of affectedClasses) {
                await this.calculateClassRankings(className);
            }

            console.log(`Bulk import completed: ${results.success} successful, ${results.errors.length} errors`);
            return results;
        } catch (error) {
            console.error('Error in bulk import:', error);
            throw error;
        }
    }

    // Parse CSV data for bulk import
    parseStudentCSV(csvText: string): { students: Omit<StudentRecord, 'id'>[]; errors: string[] } {
        const lines = csvText.trim().split('\n');
        const students: Omit<StudentRecord, 'id'>[] = [];
        const errors: string[] = [];
        const timestamp = Date.now(); // Base timestamp for ordering imports

        if (lines.length < 2) {
            errors.push('CSV must contain at least a header row and one data row');
            return { students, errors };
        }

        // Expected headers
        const expectedHeaders = ['adNo', 'name', 'className', 'semester'];
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

        // Validate headers
        for (const expectedHeader of expectedHeaders) {
            if (!headers.includes(expectedHeader)) {
                errors.push(`Missing required column: ${expectedHeader}`);
            }
        }

        if (errors.length > 0) {
            return { students, errors };
        }

        // Get all available classes (including custom ones from localStorage)
        const savedClasses = localStorage.getItem('customClasses');
        const customClasses = savedClasses ? JSON.parse(savedClasses) : [];
        const allClasses = [...CLASSES, ...customClasses];

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',').map(cell => cell.trim().replace(/"/g, ''));

            if (row.length !== headers.length) {
                errors.push(`Row ${i + 1}: Column count mismatch (expected ${headers.length}, got ${row.length})`);
                continue;
            }

            try {
                const student: Omit<StudentRecord, 'id'> = {
                    adNo: row[headers.indexOf('adNo')],
                    name: row[headers.indexOf('name')],
                    className: row[headers.indexOf('className')],
                    currentClass: row[headers.indexOf('className')],
                    semester: row[headers.indexOf('semester')] as 'Odd' | 'Even',
                    marks: {},
                    grandTotal: 0,
                    average: 0,
                    rank: 0,
                    performanceLevel: 'Needs Improvement',
                    importRowNumber: timestamp + i // Use timestamp to ensure later imports come after earlier ones
                };

                // Validate required fields
                if (!student.adNo || !student.name || !student.className) {
                    errors.push(`Row ${i + 1}: Missing required data`);
                    continue;
                }

                // Validate class
                if (!allClasses.includes(student.className)) {
                    errors.push(`Row ${i + 1}: Invalid class "${student.className}". Must be one of: ${allClasses.join(', ')}`);
                    continue;
                }

                // Validate semester
                if (!['Odd', 'Even'].includes(student.semester)) {
                    errors.push(`Row ${i + 1}: Invalid semester "${student.semester}". Must be "Odd" or "Even"`);
                    continue;
                }

                students.push(student);
            } catch (error) {
                errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
            }
        }

        return { students, errors };
    }

    async calculateClassRankings(className: string, termKey?: string): Promise<void> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            const students = await this.getStudentsByClass(className);

            // Sort by grand total (descending) for the specific term
            const sortedStudents = [...students].sort((a, b) => {
                const totalA = a.academicHistory?.[activeTerm]?.grandTotal || 0;
                const totalB = b.academicHistory?.[activeTerm]?.grandTotal || 0;
                return totalB - totalA;
            });

            const batch = writeBatch(this.db);
            let currentRank = 1;

            for (let i = 0; i < sortedStudents.length; i++) {
                const student = sortedStudents[i];
                const total = student.academicHistory?.[activeTerm]?.grandTotal || 0;
                const prevTotal = i > 0 ? (sortedStudents[i - 1].academicHistory?.[activeTerm]?.grandTotal || 0) : -1;

                if (i > 0 && total === prevTotal && total > 0) {
                    // rank remains same as previous student's rank if totals are equal and > 0
                } else {
                    currentRank = i + 1;
                }

                const docRef = doc(this.db, this.studentsCollection, student.id);
                const updates: any = {
                    [`academicHistory.${activeTerm}.rank`]: currentRank
                };

                // Root synchronization if this is the global active term
                if (activeTerm === this.getCurrentTermKey()) {
                    updates.rank = currentRank;
                }

                batch.update(docRef, updates);

                // Inline cache update
                this.updateStudentInCache(student.id, {
                    academicHistory: {
                        ...student.academicHistory,
                        [activeTerm]: {
                            ...(student.academicHistory?.[activeTerm] || {} as any),
                            rank: currentRank
                        }
                    },
                    ...(activeTerm === this.getCurrentTermKey() ? { rank: currentRank } : {})
                });
            }

            await batch.commit();
            console.log('Class rankings updated for:', className, 'term:', activeTerm);
        } catch (error) {
            console.error('Error calculating class rankings:', error);
            throw error;
        }
    }

    // Attendance operations
    async markAttendance(attendance: Omit<AttendanceRecord, 'id'>): Promise<string> {
        try {
            const docRef = await addDoc(collection(this.db, this.attendanceCollection), attendance);
            console.log('Attendance marked with ID:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Error marking attendance:', error);
            throw error;
        }
    }

    async getAllAttendanceRecords(): Promise<AttendanceRecord[]> {
        try {
            const q = query(
                collection(this.db, this.attendanceCollection),
                orderBy('date', 'desc'),
                orderBy('markedAt', 'desc')
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
        } catch (error) {
            console.error('Error fetching all attendance:', error);
            return [];
        }
    }

    async getAttendanceByClassAndDate(className: string, date: string, termKey?: string): Promise<AttendanceRecord[]> {
        try {
            const settings = await this.getGlobalSettings();
            const [targetYear, targetSem] = termKey ? termKey.split('-') : [settings.currentAcademicYear, settings.currentSemester];

            const q = query(
                collection(this.db, this.attendanceCollection),
                where('className', '==', className),
                where('date', '==', date)
            );
            const snapshot = await getDocs(q);
            const allRecords = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));

            // Strict term filter
            return allRecords.filter(rec => {
                if (rec.academicYear && rec.semester) {
                    return rec.academicYear === targetYear && rec.semester === targetSem;
                }
                // If older records don't have metadata, we trust the date/class match for now
                return true;
            });
        } catch (error) {
            console.error('Error fetching attendance:', error);
            return [];
        }
    }

    async getAttendanceForStudent(studentId: string, subjectId?: string, termKey?: string): Promise<AttendanceRecord[]> {
        try {
            // Get date limits from global settings or semester config
            const settings = await this.getGlobalSettings();
            let startDate = settings.attendanceStartDate;
            let endDate = settings.attendanceEndDate;
            
            const currentTermKey = termKey || `${settings.currentAcademicYear}-${settings.currentSemester}`;
            
            // Try to find specific dates for this term in SemesterConfigs
            if (settings.semesters) {
                const config = settings.semesters.find(s => s.termKey === currentTermKey);
                if (config) {
                    if (config.startDate) startDate = config.startDate;
                    if (config.endDate) endDate = config.endDate;
                }
            }

            let q = subjectId
                ? query(collection(this.db, this.attendanceCollection), where('subjectId', '==', subjectId))
                : collection(this.db, this.attendanceCollection);

            const snapshot = await getDocs(q);
            let allAttendance = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));

            const [targetYear, targetSem] = currentTermKey.split('-');
            
            return allAttendance.filter(record => {
                // First check if the student is in this record at all
                const hasStudent = record.presentStudentIds.includes(studentId) || record.absentStudentIds.includes(studentId);
                if (!hasStudent) return false;

                // 1. If record has explicit term metadata, use it
                if (record.academicYear && record.semester) {
                    return record.academicYear === targetYear && record.semester === targetSem;
                }
                
                // 2. Fallback to date filter if record has no metadata
                if (startDate && record.date < startDate) return false;
                if (endDate && record.date > endDate) return false;
                
                // If we are looking for a specific term and the record has NO term info,
                // we only include it if it falls within the window for that term.
                return true;
            });
        } catch (error) {
            console.error('Error fetching student attendance:', error);
            return [];
        }
    }

    async calculateAttendancePercentage(studentId: string, subjectId: string, termKey?: string): Promise<number> {
        const records = await this.getAttendanceForStudent(studentId, subjectId, termKey);
        if (records.length === 0) return 100; // Assume 100% if no records yet
        
        const presentCount = records.filter(r => r.presentStudentIds.includes(studentId)).length;
        return (presentCount / records.length) * 100;
    }

    // Timetable operations
    async saveTimetableEntries(entries: Omit<TimetableEntry, 'id'>[]): Promise<void> {
        try {
            const batch = writeBatch(this.db);
            for (const entry of entries) {
                const docRef = doc(collection(this.db, this.timetablesCollection));
                batch.set(docRef, entry);
            }
            await batch.commit();
        } catch (error) {
            console.error('Error saving timetable:', error);
            throw error;
        }
    }

    async getTimetableByClass(className: string): Promise<TimetableEntry[]> {
        try {
            const settings = await this.getGlobalSettings();
            const q = query(
                collection(this.db, this.timetablesCollection), 
                where('className', '==', className)
            );
            const snapshot = await getDocs(q);
            const allEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimetableEntry));
            
            // Filter by semester/year context if they exist in the record
            return allEntries.filter(entry => {
                if (entry.semester && entry.semester !== settings.currentSemester) return false;
                if (entry.academicYear && entry.academicYear !== settings.currentAcademicYear) return false;
                return true;
            });
        } catch (error) {
            console.error('Error fetching timetable:', error);
            return [];
        }
    }

    async getTimetableByDay(day: TimetableEntry['day']): Promise<TimetableEntry[]> {
        try {
            const q = query(collection(this.db, this.timetablesCollection), where('day', '==', day));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimetableEntry));
        } catch (error) {
            console.error('Error fetching timetable by day:', error);
            return [];
        }
    }

    async getAllTimetables(): Promise<TimetableEntry[]> {
        try {
            const settings = await this.getGlobalSettings();
            const snapshot = await getDocs(collection(this.db, this.timetablesCollection));
            const allEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimetableEntry));
            
            return allEntries.filter(entry => {
                if (entry.semester && entry.semester !== settings.currentSemester) return false;
                if (entry.academicYear && entry.academicYear !== settings.currentAcademicYear) return false;
                return true;
            });
        } catch (error) {
            console.error('Error fetching all timetables:', error);
            return [];
        }
    }

    // Special Days
    async markSpecialDay(specialDay: Omit<SpecialDay, 'id'>): Promise<string> {
        try {
            const docRef = await addDoc(collection(this.db, this.specialDaysCollection), specialDay);
            return docRef.id;
        } catch (error) {
            console.error('Error marking special day:', error);
            throw error;
        }
    }

    async getSpecialDays(date?: string): Promise<SpecialDay[]> {
        try {
            const q = date
                ? query(collection(this.db, this.specialDaysCollection), where('date', '==', date))
                : collection(this.db, this.specialDaysCollection);
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SpecialDay));
        } catch (error) {
            console.error('Error fetching special days:', error);
            return [];
        }
    }

    // Test Firebase connection
    async testConnection(): Promise<boolean> {
        if (!this.db) {
            console.error('Firebase not initialized');
            return false;
        }

        try {
            // Try to read from the students collection
            const testQuery = await getDocs(collection(this.db, this.studentsCollection));
            console.log('Firebase connection test successful. Found', testQuery.docs.length, 'documents');
            return true;
        } catch (error) {
            console.error('Firebase connection test failed:', error);
            return false;
        }
    }

    // Clear all data from database
    async clearAllData(): Promise<void> {
        try {
            console.log('Starting to clear all student data...');

            // Get all students
            const studentsSnapshot = await getDocs(collection(this.db, this.studentsCollection));
            console.log(`Found ${studentsSnapshot.docs.length} students to delete`);

            // Delete all students
            const batch = writeBatch(this.db);
            studentsSnapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            console.log('All student data cleared successfully');
        } catch (error) {
            console.error('Error clearing student data:', error);
            throw error;
        }
    }

    // Clear all subjects from database
    async clearAllSubjects(): Promise<void> {
        try {
            console.log('Starting to clear all subject data...');

            // Get all subjects
            const subjectsSnapshot = await getDocs(collection(this.db, this.subjectsCollection));
            console.log(`Found ${subjectsSnapshot.docs.length} subjects to delete`);

            // Delete all subjects
            const batch = writeBatch(this.db);
            subjectsSnapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            console.log('All subject data cleared successfully');
            this.invalidateCache();
        } catch (error) {
            console.error('Error clearing subject data:', error);
            throw error;
        }
    }

    // Recalculate all student performance levels with updated grading thresholds
    async recalculateAllStudentPerformanceLevels(): Promise<{ updated: number; errors: string[] }> {
        const results = { updated: 0, errors: [] as string[] };

        try {
            console.log('Starting bulk recalculation of student performance levels...');

            // Get all students and subjects
            const [allStudents, allSubjects] = await Promise.all([
                this.getAllStudents(),
                this.getAllSubjects()
            ]);
            console.log(`Found ${allStudents.length} students to recalculate`);

            // Process in batches of 500 (Firestore limit)
            const batchSize = 500;

            for (let i = 0; i < allStudents.length; i += batchSize) {
                const batch = writeBatch(this.db);
                const currentBatch = allStudents.slice(i, i + batchSize);

                for (const student of currentBatch) {
                    try {
                        const activeTerm = this.getCurrentTermKey();
                        const termRecord = student.academicHistory?.[activeTerm];
                        if (!termRecord) continue;

                        const performanceLevel = this.calculatePerformanceLevel(termRecord.marks, allSubjects);

                        if (termRecord.performanceLevel !== performanceLevel) {
                            const updatedTermRecord = { ...termRecord, performanceLevel };
                            const docRef = doc(this.db, this.studentsCollection, student.id);
                            
                            const updates: any = {
                                [`academicHistory.${activeTerm}.performanceLevel`]: performanceLevel
                            };

                            if (activeTerm === this.getCurrentTermKey()) {
                                updates.performanceLevel = performanceLevel;
                            }

                            batch.update(docRef, updates);

                            // Inline cache update
                            this.updateStudentInCache(student.id, {
                                academicHistory: {
                                    ...student.academicHistory,
                                    [activeTerm]: updatedTermRecord
                                },
                                ...(activeTerm === this.getCurrentTermKey() ? { performanceLevel } : {})
                            });

                            results.updated++;
                        }
                    } catch (error) {
                        results.errors.push(`${student.name} (${student.adNo}): ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }

                if (results.updated > 0) {
                    await batch.commit();
                }
            }

            console.log(`Bulk recalculation completed: ${results.updated} students updated, ${results.errors.length} errors`);
            return results;
        } catch (error) {
            console.error('Error in bulk recalculation:', error);
            throw error;
        }
    }


    // Complete database reset - REMOVED (no seeding should occur)
    async completeReset(): Promise<void> {
        try {
            console.log('Starting complete database reset...');

            // Clear all students
            await this.clearAllData();

            // Clear all subjects
            await this.clearAllSubjects();

            // Just verify connection, no seeding
            console.log('Complete database reset successful - system is now empty');
        } catch (error) {
            console.error('Error during complete reset:', error);
            throw error;
        }
    }

    // Recalculate all student totals and averages
    async recalculateAllStudentTotals(): Promise<{ updated: number; errors: string[] }> {
        const results = { updated: 0, errors: [] as string[] };

        try {
            console.log('Starting recalculation of all student totals and averages...');

            // Get all students and subjects
            const [allStudents, allSubjects] = await Promise.all([
                this.getAllStudents(),
                this.getAllSubjects()
            ]);

            const generalSubjects = allSubjects.filter(s => s.subjectType !== 'elective');
            const electiveSubjects = allSubjects.filter(s => s.subjectType === 'elective');

            console.log(`Found ${allStudents.length} students to recalculate`);

            // Process in batches of 500 (Firestore limit)
            const batchSize = 500;

            for (let i = 0; i < allStudents.length; i += batchSize) {
                const batch = writeBatch(this.db);
                const currentBatch = allStudents.slice(i, i + batchSize);

                for (const student of currentBatch) {
                    try {
                        const activeTerm = this.getCurrentTermKey();
                        const termRecord = student.academicHistory?.[activeTerm];
                        if (!termRecord) continue;

                        const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(termRecord.marks, allSubjects);

                        if (termRecord.grandTotal !== grandTotal || termRecord.average !== average) {
                            const updatedTermRecord = {
                                ...termRecord,
                                grandTotal,
                                average,
                                performanceLevel
                            };

                            const cleanTermRecord = this.sanitize(updatedTermRecord);
                            const docRef = doc(this.db, this.studentsCollection, student.id);
                            
                            const updates: any = {
                                [`academicHistory.${activeTerm}`]: cleanTermRecord
                            };

                            if (activeTerm === this.getCurrentTermKey()) {
                                updates.marks = cleanTermRecord.marks;
                                updates.grandTotal = grandTotal;
                                updates.average = average;
                                updates.performanceLevel = performanceLevel;
                            }

                            batch.update(docRef, updates);

                            // Inline cache update
                            this.updateStudentInCache(student.id, {
                                academicHistory: {
                                    ...student.academicHistory,
                                    [activeTerm]: updatedTermRecord
                                },
                                ...(activeTerm === this.getCurrentTermKey() ? {
                                    marks: termRecord.marks,
                                    grandTotal,
                                    average,
                                    performanceLevel
                                } : {})
                            });

                            results.updated++;
                        }
                    } catch (error) {
                        results.errors.push(`${student.name} (${student.adNo}): ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }

                if (results.updated > 0) {
                    await batch.commit();
                }
            }

            // Recalculate rankings for all classes
            const uniqueClasses = [...new Set(allStudents.map(s => s.className))];
            for (const className of uniqueClasses) {
                await this.calculateClassRankings(className);
            }

            this.invalidateCache();
            return results;
        } catch (error) {
            console.error('Error recalculating student totals:', error);
            throw error;
        }
    }

    /**
     * Normalizes all faculty names in the subjects collection to Title Case.
     * Merges variation like "usman hudawi" -> "Usman Hudawi".
     */
    async normalizeAllFacultyNames(): Promise<{ updated: number; merged: number; errors: string[] }> {
        const results = { updated: 0, merged: 0, errors: [] as string[] };
        try {
            console.log('Starting normalization of all faculty names...');
            const subjects = await this.getAllSubjects();
            const batch = writeBatch(this.db);
            let operationCount = 0;

            for (const subject of subjects) {
                if (!subject.facultyName) continue;

                const normalized = normalizeName(subject.facultyName);
                if (normalized !== subject.facultyName) {
                    const docRef = doc(this.db, this.subjectsCollection, subject.id);
                    batch.update(docRef, { facultyName: normalized });
                    results.updated++;
                    operationCount++;

                    // Firestore batch limit is 500
                    if (operationCount >= 450) {
                        await batch.commit();
                        operationCount = 0;
                        console.log('Intermediate batch committed...');
                    }
                }
            }

            if (operationCount > 0) {
                await batch.commit();
            }

            console.log(`Faculty normalization complete: ${results.updated} subjects fixed.`);
            this.invalidateCache();
            return results;
        } catch (error) {
            console.error('Error normalizing faculty names:', error);
            throw error;
        }
    }

    /**
     * Recalculates all mark statuses for all students.
     * Use this when status calculation logic changes or after imports.
     */
    async recalculateAllMarkStatuses(): Promise<{ updated: number; errors: string[] }> {
        const results = { updated: 0, errors: [] as string[] };
        try {
            console.log('Recalculating all mark statuses...');
            const [students, subjects] = await Promise.all([
                this.getAllStudents(),
                this.getAllSubjects()
            ]);

            const subjectMap = new Map(subjects.map(s => [s.id, s]));

            const batchSize = 500;
            for (let i = 0; i < students.length; i += batchSize) {
                const batch = writeBatch(this.db);
                const currentBatch = students.slice(i, i + batchSize);

                for (const student of currentBatch) {
                    try {
                        const activeTerm = this.getCurrentTermKey();
                        const termRecord = student.academicHistory?.[activeTerm];
                        if (!termRecord) continue;

                        let studentUpdated = false;
                        const updatedMarks = { ...termRecord.marks };

                        for (const subjectId in updatedMarks) {
                            const subject = subjectMap.get(subjectId);
                            if (!subject) continue;

                            const marks = updatedMarks[subjectId] as any;
                            const int = marks.int;
                            const ext = marks.ext;

                            const intVal = this.getMarkValue(int);
                            const extVal = this.getMarkValue(ext);

                            const minINT = Math.ceil(subject.maxINT * 0.5);
                            const minEXT = Math.ceil(subject.maxEXT * 0.4);
                            const passedINT = int !== 'A' && intVal >= minINT;
                            const passedEXT = ext !== 'A' && extVal >= minEXT;

                            const isFullINT = subject.maxINT === 100;
                            const intReady = subject.maxINT > 0 ? (int !== undefined && int !== '') : true;
                            const extReady = isFullINT || subject.maxEXT === 0 || (subject.maxEXT > 0 && ext !== undefined && ext !== '');

                            let newStatus: 'Passed' | 'Failed' | 'Pending' = 'Pending';
                            if (intReady && extReady) {
                                const finalPassedEXT = isFullINT || passedEXT || subject.maxEXT === 0;
                                newStatus = (passedINT && finalPassedEXT) ? 'Passed' : 'Failed';
                            }

                            if (marks.status !== newStatus) {
                                updatedMarks[subjectId] = { ...marks, status: newStatus };
                                studentUpdated = true;
                            }
                        }

                        if (studentUpdated) {
                            const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(updatedMarks, subjects);
                            const updatedTermRecord = {
                                ...termRecord,
                                marks: updatedMarks,
                                grandTotal,
                                average,
                                performanceLevel
                            };

                            const cleanTermRecord = this.sanitize(updatedTermRecord);
                            const docRef = doc(this.db, this.studentsCollection, student.id);
                            
                            const updates: any = {
                                [`academicHistory.${activeTerm}`]: cleanTermRecord
                            };

                            if (activeTerm === this.getCurrentTermKey()) {
                                updates.marks = cleanTermRecord.marks;
                                updates.grandTotal = grandTotal;
                                updates.average = average;
                                updates.performanceLevel = performanceLevel;
                            }

                            batch.update(docRef, updates);

                            // Inline cache update
                            this.updateStudentInCache(student.id, {
                                academicHistory: {
                                    ...student.academicHistory,
                                    [activeTerm]: updatedTermRecord
                                },
                                ...(activeTerm === this.getCurrentTermKey() ? {
                                    marks: updatedMarks,
                                    grandTotal,
                                    average,
                                    performanceLevel
                                } : {})
                            });

                            results.updated++;
                        }
                    } catch (error) {
                        results.errors.push(`${student.name} (${student.adNo}): ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }

                if (results.updated > 0) {
                    await batch.commit();
                }
            }

            console.log(`Status recalculation complete. Updated ${results.updated} students.`);
            this.invalidateCache();
            return results;
        } catch (error) {
            console.error('Error recalculating statuses:', error);
            throw error;
        }
    }

    async updateStudentMarks(studentId: string, subjectId: string, int: number | 'A', ext: number | 'A', termKey?: string, skipRankCalculation = false): Promise<void> {
        try {
            const [studentDoc, subjectDoc] = await Promise.all([
                getDoc(doc(this.db, this.studentsCollection, studentId)),
                getDoc(doc(this.db, this.subjectsCollection, subjectId))
            ]);

            if (!studentDoc.exists()) throw new Error('Student not found');
            if (!subjectDoc.exists()) throw new Error('Subject not found');

            const student = this.processStudentRecord(studentDoc.data(), studentDoc.id);
            const subject = this.processSubjectConfig(subjectDoc.data(), subjectDoc.id);
            const activeTerm = termKey || this.getCurrentTermKey();

            const intVal = this.getMarkValue(int);
            const extVal = this.getMarkValue(ext);
            const total = intVal + extVal;

            const isFullINT = subject.maxINT === 100;
            const minINT = Math.ceil(subject.maxINT * 0.5);
            const minEXT = isFullINT ? 0 : Math.ceil(subject.maxEXT * 0.4);

            const passedINT = int !== 'A' && intVal >= minINT;
            const passedEXT = isFullINT || (ext !== 'A' && extVal >= minEXT) || subject.maxEXT === 0;
            const status = ((passedINT && passedEXT) ? 'Passed' : 'Failed') as 'Passed' | 'Failed' | 'Pending';

            // Get existing term record or create fresh one
            const termRecord = student.academicHistory?.[activeTerm] || {
                className: student.currentClass,
                semester: activeTerm.split('-')[2] as 'Odd' | 'Even',
                marks: {},
                grandTotal: 0,
                average: 0,
                rank: 0,
                performanceLevel: 'C (Average)'
            };

            const updatedTermMarks = {
                ...termRecord.marks,
                [subjectId]: { int, ext, total, status }
            } as Record<string, SubjectMarks>;

            const allSubjects = await this.getAllSubjects();
            const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(updatedTermMarks, allSubjects);

            const updatedTermRecord = {
                ...termRecord,
                marks: updatedTermMarks,
                grandTotal,
                average,
                performanceLevel
            };

            const cleanTermRecord = this.sanitize(updatedTermRecord);
            const updates: any = {
                [`academicHistory.${activeTerm}`]: cleanTermRecord
            };

            // Root synchronization for the globally active term
            if (activeTerm === this.getCurrentTermKey()) {
                updates.marks = cleanTermRecord.marks;
                updates.grandTotal = grandTotal;
                updates.average = average;
                updates.performanceLevel = performanceLevel;
            }

            await updateDoc(doc(this.db, this.studentsCollection, studentId), updates);

            // Directly update the cache instead of invalidating everything
            this.updateStudentInCache(studentId, {
                academicHistory: {
                    ...student.academicHistory,
                    [activeTerm]: updatedTermRecord
                },
                ...(activeTerm === this.getCurrentTermKey() ? {
                    marks: updatedTermMarks,
                    grandTotal,
                    average,
                    performanceLevel
                } : {})
            });

            if (!skipRankCalculation) {
                await this.calculateClassRankings(student.currentClass, activeTerm);
            }

            console.log('Student marks updated for term:', activeTerm, studentId);
        } catch (error) {
            console.error('Error updating student marks:', error);
            throw error;
        }
    }

    // New method for updating only INT marks
    async updateStudentINTMarks(studentId: string, subjectId: string, int: number | 'A', termKey?: string, skipRankCalculation = false): Promise<void> {
        try {
            const [studentDoc, subjectDoc] = await Promise.all([
                getDoc(doc(this.db, this.studentsCollection, studentId)),
                getDoc(doc(this.db, this.subjectsCollection, subjectId))
            ]);

            if (!studentDoc.exists()) throw new Error('Student not found');
            if (!subjectDoc.exists()) throw new Error('Subject not found');

            const student = this.processStudentRecord(studentDoc.data(), studentDoc.id);
            const subject = this.processSubjectConfig(subjectDoc.data(), subjectDoc.id);
            const activeTerm = termKey || this.getCurrentTermKey();

            // Get existing term record or create fresh one
            const termRecord = student.academicHistory?.[activeTerm] || {
                className: student.currentClass,
                semester: activeTerm.split('-')[2] as 'Odd' | 'Even',
                marks: {}, grandTotal: 0, average: 0, rank: 0, performanceLevel: 'C (Average)'
            };

            const existingMarks = termRecord.marks[subjectId] || { int: 0, ext: 0, total: 0, status: 'Pending' };
            const ext = existingMarks.ext !== undefined ? existingMarks.ext : ((existingMarks as any).ta !== undefined ? (existingMarks as any).ta : 0);
            const intVal = this.getMarkValue(int);
            const extVal = this.getMarkValue(ext);
            const total = intVal + extVal;

            const minINT = Math.ceil(subject.maxINT * 0.5);
            const minEXT = Math.ceil(subject.maxEXT * 0.4);
            const passedINT = int !== 'A' && intVal >= minINT;
            const passedEXT = ext !== 'A' && extVal >= minEXT;

            let status: 'Passed' | 'Failed' | 'Pending' = 'Pending';
            const isFullINT = subject.maxINT === 100;
            const intReady = (int !== undefined && int !== null);
            const extReady = isFullINT || subject.maxEXT === 0 || (ext !== undefined && ext !== null);

            if (intReady && extReady) {
                const finalPassedEXT = isFullINT || passedEXT || subject.maxEXT === 0;
                status = (passedINT && finalPassedEXT) ? 'Passed' : 'Failed';
            }

            const updatedTermMarks = {
                ...termRecord.marks,
                [subjectId]: { int, ext, total, status }
            };

            const allSubjects = await this.getAllSubjects();
            const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(updatedTermMarks, allSubjects);

            const updatedTermRecord = {
                ...termRecord,
                marks: updatedTermMarks,
                grandTotal,
                average,
                performanceLevel
            };

            const cleanTermRecord = this.sanitize(updatedTermRecord);
            const updates: any = { [`academicHistory.${activeTerm}`]: cleanTermRecord };
            if (activeTerm === this.getCurrentTermKey()) {
                updates.marks = cleanTermRecord.marks;
                updates.grandTotal = grandTotal;
                updates.average = average;
                updates.performanceLevel = performanceLevel;
            }

            await updateDoc(doc(this.db, this.studentsCollection, studentId), updates);

            this.updateStudentInCache(studentId, {
                academicHistory: {
                    ...student.academicHistory,
                    [activeTerm]: updatedTermRecord
                },
                ...(activeTerm === this.getCurrentTermKey() ? {
                    marks: updatedTermMarks,
                    grandTotal,
                    average,
                    performanceLevel
                } : {})
            });

            if (!skipRankCalculation) {
                await this.calculateClassRankings(student.currentClass, activeTerm);
            }
        } catch (error) {
            console.error('Error updating student INT marks:', error);
            throw error;
        }
    }

    // New method for updating only EXT marks
    async updateStudentEXTMarks(studentId: string, subjectId: string, ext: number | 'A', termKey?: string, skipRankCalculation = false): Promise<void> {
        try {
            const [studentDoc, subjectDoc] = await Promise.all([
                getDoc(doc(this.db, this.studentsCollection, studentId)),
                getDoc(doc(this.db, this.subjectsCollection, subjectId))
            ]);

            if (!studentDoc.exists()) throw new Error('Student not found');
            if (!subjectDoc.exists()) throw new Error('Subject not found');

            const student = this.processStudentRecord(studentDoc.data(), studentDoc.id);
            const subject = this.processSubjectConfig(subjectDoc.data(), subjectDoc.id);
            const activeTerm = termKey || this.getCurrentTermKey();

            const termRecord = student.academicHistory?.[activeTerm] || {
                className: student.currentClass,
                semester: activeTerm.split('-')[2] as 'Odd' | 'Even',
                marks: {}, grandTotal: 0, average: 0, rank: 0, performanceLevel: 'C (Average)'
            };

            const existingMarks = termRecord.marks[subjectId] || { int: 0, ext: 0, total: 0, status: 'Pending' };
            const int = existingMarks.int !== undefined ? existingMarks.int : ((existingMarks as any).ce !== undefined ? (existingMarks as any).ce : 0);
            const intVal = this.getMarkValue(int);
            const extVal = this.getMarkValue(ext);
            const total = intVal + extVal;

            const minINT = Math.ceil(subject.maxINT * 0.5);
            const minEXT = Math.ceil(subject.maxEXT * 0.4);
            const passedINT = int !== 'A' && intVal >= minINT;
            const passedEXT = ext !== 'A' && extVal >= minEXT;

            let status: 'Passed' | 'Failed' | 'Pending' = 'Pending';
            const isFullINT = subject.maxINT === 100;
            const intReady = subject.maxINT > 0 ? (int !== undefined && int !== null) : true;
            const extReady = isFullINT || subject.maxEXT === 0 || (ext !== undefined && ext !== null);

            if (intReady && extReady) {
                const finalPassedEXT = isFullINT || passedEXT || subject.maxEXT === 0;
                status = (passedINT && finalPassedEXT) ? 'Passed' : 'Failed';
            }

            const updatedTermMarks = {
                ...termRecord.marks,
                [subjectId]: { int, ext, total, status }
            };

            const allSubjects = await this.getAllSubjects();
            const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(updatedTermMarks, allSubjects);

            const updatedTermRecord = {
                ...termRecord,
                marks: updatedTermMarks,
                grandTotal,
                average,
                performanceLevel
            };

            const cleanTermRecord = this.sanitize(updatedTermRecord);
            const updates: any = { [`academicHistory.${activeTerm}`]: cleanTermRecord };
            if (activeTerm === this.getCurrentTermKey()) {
                updates.marks = cleanTermRecord.marks;
                updates.grandTotal = grandTotal;
                updates.average = average;
                updates.performanceLevel = performanceLevel;
            }

            await updateDoc(doc(this.db, this.studentsCollection, studentId), updates);

            this.updateStudentInCache(studentId, {
                academicHistory: {
                    ...student.academicHistory,
                    [activeTerm]: updatedTermRecord
                },
                ...(activeTerm === this.getCurrentTermKey() ? {
                    marks: updatedTermMarks,
                    grandTotal,
                    average,
                    performanceLevel
                } : {})
            });

            if (!skipRankCalculation) {
                await this.calculateClassRankings(student.currentClass, activeTerm);
            }
        } catch (error) {
            console.error('Error updating student EXT marks:', error);
            throw error;
        }
    }

    async clearSubjectMarks(subjectId: string, studentIds: string[], termKey?: string): Promise<void> {
        try {
            console.log('Clearing marks for subject:', subjectId, 'for', studentIds.length, 'students');
            const activeTerm = termKey || this.getCurrentTermKey();
            const batch = writeBatch(this.db);
            const affectedClasses = new Set<string>();
            const [allStudents, allSubjects] = await Promise.all([this.getAllStudents(), this.getAllSubjects()]);

            for (const studentId of studentIds) {
                const student = allStudents.find(s => s.id === studentId);
                if (!student) continue;

                const termRecord = student.academicHistory?.[activeTerm];
                if (!termRecord || !termRecord.marks[subjectId]) continue;
                affectedClasses.add(student.currentClass);

                const updatedTermMarks = { ...termRecord.marks };
                delete updatedTermMarks[subjectId];

                const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(updatedTermMarks, allSubjects);

                const updatedTermRecord = {
                    ...termRecord,
                    marks: updatedTermMarks,
                    grandTotal,
                    average,
                    performanceLevel
                };

                const cleanTermRecord = this.sanitize(updatedTermRecord);
                const updates: any = { [`academicHistory.${activeTerm}`]: cleanTermRecord };
                if (activeTerm === this.getCurrentTermKey()) {
                    updates.marks = cleanTermRecord.marks;
                    updates.grandTotal = grandTotal;
                    updates.average = average;
                    updates.performanceLevel = performanceLevel;
                }

                const docRef = doc(this.db, this.studentsCollection, studentId);
                batch.update(docRef, updates);

                // Inline cache update
                this.updateStudentInCache(studentId, {
                    academicHistory: { ...student.academicHistory, [activeTerm]: updatedTermRecord },
                    ...(activeTerm === this.getCurrentTermKey() ? { marks: updatedTermMarks, grandTotal, average, performanceLevel } : {})
                });
            }
            
            await batch.commit();

            for (const className of affectedClasses) {
                await this.calculateClassRankings(className, activeTerm);
            }
        } catch (error) {
            console.error('Error clearing subject marks:', error);
            throw error;
        }
    }

    async clearStudentSubjectMarks(studentId: string, subjectId: string, termKey?: string): Promise<void> {
        try {
            const studentDoc = await getDoc(doc(this.db, this.studentsCollection, studentId));
            if (!studentDoc.exists()) throw new Error('Student not found');

            const student = this.processStudentRecord(studentDoc.data(), studentDoc.id);
            const activeTerm = termKey || this.getCurrentTermKey();
            const termRecord = student.academicHistory?.[activeTerm];
            if (!termRecord) return;

            const updatedTermMarks = { ...termRecord.marks };
            delete updatedTermMarks[subjectId];

            const allSubjects = await this.getAllSubjects();
            const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(updatedTermMarks, allSubjects);

            const updatedTermRecord = {
                ...termRecord,
                marks: updatedTermMarks,
                grandTotal,
                average,
                performanceLevel
            };

            const cleanTermRecord = this.sanitize(updatedTermRecord);
            const updates: any = { [`academicHistory.${activeTerm}`]: cleanTermRecord };
            if (activeTerm === this.getCurrentTermKey()) {
                updates.marks = cleanTermRecord.marks;
                updates.grandTotal = grandTotal;
                updates.average = average;
                updates.performanceLevel = performanceLevel;
            }

            await updateDoc(doc(this.db, this.studentsCollection, studentId), updates);

            this.updateStudentInCache(studentId, {
                academicHistory: { ...student.academicHistory, [activeTerm]: updatedTermRecord },
                ...(activeTerm === this.getCurrentTermKey() ? { marks: updatedTermMarks, grandTotal, average, performanceLevel } : {})
            });

            await this.calculateClassRankings(student.currentClass, activeTerm);
            this.invalidateCache();
        } catch (error) {
            console.error('Error clearing student subject marks:', error);
            throw error;
        }
    }

    async clearSubjectEXTMarks(subjectId: string, studentIds: string[], termKey?: string): Promise<void> {
        try {
            console.log('Clearing EXT marks for subject:', subjectId, 'for', studentIds.length, 'students');
            const activeTerm = termKey || this.getCurrentTermKey();
            const batch = writeBatch(this.db);
            const affectedClasses = new Set<string>();
            const [allStudents, allSubjects] = await Promise.all([this.getAllStudents(), this.getAllSubjects()]);

            for (const studentId of studentIds) {
                const student = allStudents.find(s => s.id === studentId);
                if (!student) continue;

                const termRecord = student.academicHistory?.[activeTerm];
                if (!termRecord || !termRecord.marks[subjectId]) continue;
                affectedClasses.add(student.currentClass);

                const updatedTermMarks = { ...termRecord.marks };
                const marks = updatedTermMarks[subjectId];
                const int = marks.int || 0;

                updatedTermMarks[subjectId] = {
                    int,
                    ext: 0,
                    total: this.getMarkValue(int as any),
                    status: 'Pending'
                };

                const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(updatedTermMarks, allSubjects);

                const updatedTermRecord = {
                    ...termRecord,
                    marks: updatedTermMarks,
                    grandTotal,
                    average,
                    performanceLevel
                };

                const cleanTermRecord = this.sanitize(updatedTermRecord);
                const updates: any = { [`academicHistory.${activeTerm}`]: cleanTermRecord };
                if (activeTerm === this.getCurrentTermKey()) {
                    updates.marks = cleanTermRecord.marks;
                    updates.grandTotal = grandTotal;
                    updates.average = average;
                    updates.performanceLevel = performanceLevel;
                }

                const docRef = doc(this.db, this.studentsCollection, studentId);
                batch.update(docRef, updates);

                this.updateStudentInCache(studentId, {
                    academicHistory: { ...student.academicHistory, [activeTerm]: updatedTermRecord },
                    ...(activeTerm === this.getCurrentTermKey() ? { marks: updatedTermMarks, grandTotal, average, performanceLevel } : {})
                });
            }

            await batch.commit();

            for (const className of affectedClasses) {
                await this.calculateClassRankings(className, activeTerm);
            }
        } catch (error) {
            console.error('Error clearing subject EXT marks:', error);
            throw error;
        }
    }

    async clearSubjectINTMarks(subjectId: string, studentIds: string[], termKey?: string): Promise<void> {
        try {
            console.log('Clearing INT marks for subject:', subjectId, 'for', studentIds.length, 'students');
            const activeTerm = termKey || this.getCurrentTermKey();
            const batch = writeBatch(this.db);
            const affectedClasses = new Set<string>();
            const [allStudents, allSubjects] = await Promise.all([this.getAllStudents(), this.getAllSubjects()]);

            for (const studentId of studentIds) {
                const student = allStudents.find(s => s.id === studentId);
                if (!student) continue;

                const termRecord = student.academicHistory?.[activeTerm];
                if (!termRecord || !termRecord.marks[subjectId]) continue;
                affectedClasses.add(student.currentClass);

                const updatedTermMarks = { ...termRecord.marks };
                const marks = updatedTermMarks[subjectId];
                const ext = marks.ext || 0;

                updatedTermMarks[subjectId] = {
                    int: 0,
                    ext,
                    total: this.getMarkValue(ext as any),
                    status: 'Pending'
                };

                const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(updatedTermMarks, allSubjects);

                const updatedTermRecord = {
                    ...termRecord,
                    marks: updatedTermMarks,
                    grandTotal,
                    average,
                    performanceLevel
                };

                const cleanTermRecord = this.sanitize(updatedTermRecord);
                const updates: any = { [`academicHistory.${activeTerm}`]: cleanTermRecord };
                if (activeTerm === this.getCurrentTermKey()) {
                    updates.marks = cleanTermRecord.marks;
                    updates.grandTotal = grandTotal;
                    updates.average = average;
                    updates.performanceLevel = performanceLevel;
                }

                const docRef = doc(this.db, this.studentsCollection, studentId);
                batch.update(docRef, updates);

                this.updateStudentInCache(studentId, {
                    academicHistory: { ...student.academicHistory, [activeTerm]: updatedTermRecord },
                    ...(activeTerm === this.getCurrentTermKey() ? { marks: updatedTermMarks, grandTotal, average, performanceLevel } : {})
                });
            }

            await batch.commit();

            for (const className of affectedClasses) {
                await this.calculateClassRankings(className, activeTerm);
            }
        } catch (error) {
            console.error('Error clearing subject INT marks:', error);
            throw error;
        }
    }

    // --- BULK BATCH UPDATES ---

    async bulkUpdateINTMarks(updates: {studentId: string, subjectId: string, int: number | 'A'}[], termKey?: string): Promise<void> {
        try {
            console.log(`Starting bulk INT update for ${updates.length} records`);
            const activeTerm = termKey || this.getCurrentTermKey();
            const batch = writeBatch(this.db);
            const affectedClasses = new Set<string>();

            // Pre-fetch all necessary data
            const [allStudents, allSubjects] = await Promise.all([
                this.getAllStudents(),
                this.getAllSubjects()
            ]);

            // Create Maps for O(1) lookups
            const studentMap = new Map(allStudents.map(s => [s.id, s]));
            const subjectMap = new Map(allSubjects.map(s => [s.id, s]));

            for (const update of updates) {
                const student = studentMap.get(update.studentId);
                const subject = subjectMap.get(update.subjectId);
                
                if (!student || !subject) continue;
                affectedClasses.add(student.currentClass);

                const termRecord = student.academicHistory?.[activeTerm] || {
                    className: student.currentClass,
                    semester: activeTerm.split('-')[2] as 'Odd' | 'Even',
                    marks: {}, grandTotal: 0, average: 0, rank: 0, performanceLevel: 'C (Average)'
                };

                const existingMarks = termRecord.marks[update.subjectId] || { int: 0, ext: 0, total: 0, status: 'Pending' };
                const ext = existingMarks.ext !== undefined ? existingMarks.ext : ((existingMarks as any).ta !== undefined ? (existingMarks as any).ta : 0);
                
                const intVal = this.getMarkValue(update.int);
                const extVal = this.getMarkValue(ext);
                const total = intVal + extVal;

                const isFullINT = subject.maxINT === 100;
                const minINT = Math.ceil(subject.maxINT * 0.5);
                const minEXT = isFullINT ? 0 : Math.ceil(subject.maxEXT * 0.4);

                const passedINT = update.int !== 'A' && intVal >= minINT;
                const passedEXT = isFullINT || (ext !== 'A' && extVal >= minEXT) || subject.maxEXT === 0;
                
                let status: 'Passed' | 'Failed' | 'Pending' = 'Pending';
                if ((subject.maxINT > 0 ? (update.int !== undefined && update.int !== null) : true) && 
                    (isFullINT || subject.maxEXT === 0 || (ext !== undefined && ext !== null))) {
                    status = (passedINT && passedEXT) ? 'Passed' : 'Failed';
                }

                const updatedSubjectMarks: any = { ...existingMarks, int: update.int, ext, total, status };
                if (updatedSubjectMarks.isSupplementary === undefined) {
                    delete updatedSubjectMarks.isSupplementary;
                }

                const updatedTermMarks = {
                    ...termRecord.marks,
                    [update.subjectId]: updatedSubjectMarks
                } as Record<string, SubjectMarks>;

                const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(updatedTermMarks, allSubjects);

                const updatedTermRecord = {
                    ...termRecord,
                    marks: updatedTermMarks,
                    grandTotal,
                    average,
                    performanceLevel
                };

                const docRef = doc(this.db, this.studentsCollection, student.id);
                
                // Use centralized sanitization
                const cleanTermRecord = this.sanitize(updatedTermRecord);

                const docUpdates: any = { [`academicHistory.${activeTerm}`]: cleanTermRecord };
                
                if (activeTerm === this.getCurrentTermKey()) {
                    docUpdates.marks = cleanTermRecord.marks;
                    docUpdates.grandTotal = grandTotal;
                    docUpdates.average = average;
                    docUpdates.performanceLevel = performanceLevel;
                }

                batch.update(docRef, docUpdates);

                // Update local cache manually
                this.updateStudentInCache(student.id, {
                    academicHistory: { ...student.academicHistory, [activeTerm]: updatedTermRecord },
                    ...(activeTerm === this.getCurrentTermKey() ? { marks: updatedTermMarks, grandTotal, average, performanceLevel } : {})
                });
            }

            await batch.commit();
            console.log(`Bulk INT marks updated. Calculating ranks for ${affectedClasses.size} classes`);
            
            // Calculate ranks exactly ONCE per affected class
            for (const className of affectedClasses) {
                await this.calculateClassRankings(className, activeTerm);
            }

        } catch (error) {
            console.error('Error in bulk update INT marks:', error);
            throw error;
        }
    }

    async bulkUpdateEXTMarks(updates: {studentId: string, subjectId: string, ext: number | 'A'}[], termKey?: string): Promise<void> {
        try {
            console.log(`Starting bulk EXT update for ${updates.length} records`);
            const activeTerm = termKey || this.getCurrentTermKey();
            const batch = writeBatch(this.db);
            const affectedClasses = new Set<string>();

            const [allStudents, allSubjects] = await Promise.all([
                this.getAllStudents(),
                this.getAllSubjects()
            ]);

            // Create Maps for O(1) lookups
            const studentMap = new Map(allStudents.map(s => [s.id, s]));
            const subjectMap = new Map(allSubjects.map(s => [s.id, s]));

            for (const update of updates) {
                const student = studentMap.get(update.studentId);
                const subject = subjectMap.get(update.subjectId);
                
                if (!student || !subject) continue;
                affectedClasses.add(student.currentClass);

                const termRecord = student.academicHistory?.[activeTerm] || {
                    className: student.currentClass,
                    semester: activeTerm.split('-')[2] as 'Odd' | 'Even',
                    marks: {}, grandTotal: 0, average: 0, rank: 0, performanceLevel: 'C (Average)'
                };

                const existingMarks = termRecord.marks[update.subjectId] || { int: 0, ext: 0, total: 0, status: 'Pending' };
                const int = existingMarks.int !== undefined ? existingMarks.int : ((existingMarks as any).ce !== undefined ? (existingMarks as any).ce : 0);
                
                const intVal = this.getMarkValue(int);
                const extVal = this.getMarkValue(update.ext);
                const total = intVal + extVal;

                const isFullINT = subject.maxINT === 100;
                const minINT = Math.ceil(subject.maxINT * 0.5);
                const minEXT = isFullINT ? 0 : Math.ceil(subject.maxEXT * 0.4);

                const passedINT = int !== 'A' && intVal >= minINT;
                const passedEXT = isFullINT || (update.ext !== 'A' && extVal >= minEXT) || subject.maxEXT === 0;
                
                let status: 'Passed' | 'Failed' | 'Pending' = 'Pending';
                if ((subject.maxINT > 0 ? (int !== undefined && int !== null) : true) && 
                    (isFullINT || subject.maxEXT === 0 || (update.ext !== undefined && update.ext !== null))) {
                    status = (passedINT && passedEXT) ? 'Passed' : 'Failed';
                }

                const updatedSubjectMarks: any = { ...existingMarks, int, ext: update.ext, total, status };
                if (updatedSubjectMarks.isSupplementary === undefined) {
                    delete updatedSubjectMarks.isSupplementary;
                }

                const updatedTermMarks = {
                    ...termRecord.marks,
                    [update.subjectId]: updatedSubjectMarks
                } as Record<string, SubjectMarks>;

                const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(updatedTermMarks, allSubjects);

                const updatedTermRecord = {
                    ...termRecord,
                    marks: updatedTermMarks,
                    grandTotal,
                    average,
                    performanceLevel
                };

                const docRef = doc(this.db, this.studentsCollection, student.id);
                
                // Use centralized sanitization
                const cleanTermRecord = this.sanitize(updatedTermRecord);

                const docUpdates: any = { [`academicHistory.${activeTerm}`]: cleanTermRecord };
                
                if (activeTerm === this.getCurrentTermKey()) {
                    docUpdates.marks = cleanTermRecord.marks;
                    docUpdates.grandTotal = grandTotal;
                    docUpdates.average = average;
                    docUpdates.performanceLevel = performanceLevel;
                }

                batch.update(docRef, docUpdates);

                // Update local cache manually
                this.updateStudentInCache(student.id, {
                    academicHistory: { ...student.academicHistory, [activeTerm]: updatedTermRecord },
                    ...(activeTerm === this.getCurrentTermKey() ? { marks: updatedTermMarks, grandTotal, average, performanceLevel } : {})
                });
            }

            await batch.commit();
            console.log(`Bulk EXT marks updated. Calculating ranks for ${affectedClasses.size} classes`);
            
            for (const className of affectedClasses) {
                await this.calculateClassRankings(className, activeTerm);
            }

        } catch (error) {
            console.error('Error in bulk update EXT marks:', error);
            throw error;
        }
    }

    async bulkUpdateMarks(updates: {studentId: string, subjectId: string, int: number | 'A', ext: number | 'A'}[], termKey?: string): Promise<void> {
        try {
            console.log(`Starting bulk update for ${updates.length} records`);
            const activeTerm = termKey || this.getCurrentTermKey();
            const batch = writeBatch(this.db);
            const affectedClasses = new Set<string>();

            const [allStudents, allSubjects] = await Promise.all([
                this.getAllStudents(),
                this.getAllSubjects()
            ]);

            // Create Maps for O(1) lookups
            const studentMap = new Map(allStudents.map(s => [s.id, s]));
            const subjectMap = new Map(allSubjects.map(s => [s.id, s]));

            for (const update of updates) {
                const student = studentMap.get(update.studentId);
                const subject = subjectMap.get(update.subjectId);
                
                if (!student || !subject) continue;
                affectedClasses.add(student.currentClass);

                const termRecord = student.academicHistory?.[activeTerm] || {
                    className: student.currentClass,
                    semester: activeTerm.split('-')[2] as 'Odd' | 'Even',
                    marks: {}, grandTotal: 0, average: 0, rank: 0, performanceLevel: 'C (Average)'
                };

                const intVal = this.getMarkValue(update.int);
                const extVal = this.getMarkValue(update.ext);
                const total = intVal + extVal;

                const isFullINT = subject.maxINT === 100;
                const minINT = Math.ceil(subject.maxINT * 0.5);
                const minEXT = isFullINT ? 0 : Math.ceil(subject.maxEXT * 0.4);

                const passedINT = update.int !== 'A' && intVal >= minINT;
                const passedEXT = isFullINT || (update.ext !== 'A' && extVal >= minEXT) || subject.maxEXT === 0;
                
                const status = (passedINT && passedEXT) ? 'Passed' : 'Failed' as 'Passed' | 'Failed' | 'Pending';

                const updatedTermMarks = {
                    ...termRecord.marks,
                    [update.subjectId]: { int: update.int, ext: update.ext, total, status }
                } as Record<string, SubjectMarks>;

                const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(updatedTermMarks, allSubjects);

                const updatedTermRecord = {
                    ...termRecord,
                    marks: updatedTermMarks,
                    grandTotal,
                    average,
                    performanceLevel
                };

                const docRef = doc(this.db, this.studentsCollection, student.id);

                // Use centralized sanitization
                const cleanTermRecord = this.sanitize(updatedTermRecord);

                const docUpdates: any = { [`academicHistory.${activeTerm}`]: cleanTermRecord };
                
                if (activeTerm === this.getCurrentTermKey()) {
                    docUpdates.marks = cleanTermRecord.marks;
                    docUpdates.grandTotal = grandTotal;
                    docUpdates.average = average;
                    docUpdates.performanceLevel = performanceLevel;
                }

                batch.update(docRef, docUpdates);

                // Update local cache manually
                this.updateStudentInCache(student.id, {
                    academicHistory: { ...student.academicHistory, [activeTerm]: updatedTermRecord },
                    ...(activeTerm === this.getCurrentTermKey() ? { marks: updatedTermMarks, grandTotal, average, performanceLevel } : {})
                });
            }

            await batch.commit();
            console.log(`Bulk marks updated. Calculating ranks for ${affectedClasses.size} classes`);
            
            for (const className of affectedClasses) {
                await this.calculateClassRankings(className, activeTerm);
            }

        } catch (error) {
            console.error('Error in bulk update marks:', error);
            throw error;
        }
    }

        // Excel export functionality for marks backup
    async exportMarksToExcel(termKey?: string): Promise<void> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            console.log(`Starting marks export to Excel for term: ${activeTerm}...`);

            // Get students for the SPECIFIC term
            const [students, subjects] = await Promise.all([
                this.getAllStudents(activeTerm),
                this.getAllSubjects(activeTerm)
            ]);

            if (students.length === 0) {
                throw new Error('No students found to export');
            }

            if (subjects.length === 0) {
                throw new Error('No subjects found to export');
            }

            // Import XLSX dynamically using our service
            const XLSX = await loadExcelLibrary();

            // Create workbook
            const workbook = (XLSX as any).utils.book_new();

            // Create marks data sheet
            const marksData = this.prepareMarksDataForExport(students, subjects, activeTerm);
            const marksWorksheet = (XLSX as any).utils.json_to_sheet(marksData);
            (XLSX as any).utils.book_append_sheet(workbook, marksWorksheet, 'Student Marks');

            // Create subjects reference sheet
            const subjectsData = subjects.map(subject => ({
                'Subject ID': subject.id,
                'Subject Name': subject.name,
                'Arabic Name': subject.arabicName || '',
                'Subject Type': subject.subjectType,
                'Target Classes': subject.targetClasses.join(', '),
                'Max INT': subject.maxINT,
                'Max EXT': subject.maxEXT,
                'Faculty': subject.facultyName
            }));
            const subjectsWorksheet = (XLSX as any).utils.json_to_sheet(subjectsData);
            (XLSX as any).utils.book_append_sheet(workbook, subjectsWorksheet, 'Subjects Reference');

            // Create students reference sheet
            const studentsData = students.map(student => ({
                'Student ID': student.id,
                'Admission No': student.adNo,
                'Name': student.name,
                'Class': student.className,
                'Semester': student.semester,
                'Grand Total': student.grandTotal,
                'Average': student.average,
                'Rank': student.rank,
                'Performance Level': student.performanceLevel
            }));
            const studentsWorksheet = (XLSX as any).utils.json_to_sheet(studentsData);
            (XLSX as any).utils.book_append_sheet(workbook, studentsWorksheet, 'Students Reference');
            // Generate filename with term and timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `AIC_Dawa_College_Marks_${activeTerm}_${timestamp}.xlsx`;

            // Write and download file
            XLSX.writeFile(workbook, filename);

            console.log('Marks exported successfully to:', filename);
        } catch (error) {
            console.error('Error exporting marks to Excel:', error);
            throw error;
        }
    }

    // Excel import functionality for students
    async importStudentsFromExcel(file: File): Promise<{ success: number; errors: string[] }> {
        const results = { success: 0, errors: [] as string[] };
        const timestamp = Date.now(); // Base timestamp for ordering

        try {
            console.log('Starting student import from Excel...');

            // Import XLSX dynamically
            const XLSX = await loadExcelLibrary();

            // Read file
            const arrayBuffer = await file.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });

            // Get the first sheet
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];

            // Convert to JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                throw new Error('No data found in the Excel file');
            }

            const studentsToImport: Omit<StudentRecord, 'id'>[] = [];

            // Process each row
            for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i] as any;
                const rowNum = i + 2; // Excel row number (header is 1)

                try {
                    // Normalize keys (handle case sensitivity and spaces)
                    const normalizedRow: any = {};
                    Object.keys(row).forEach(key => {
                        const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                        normalizedRow[cleanKey] = row[key];
                    });

                    // Map fields based on normalized keys
                    // Expected keys: adno, name, classname, semester
                    const adNo = normalizedRow['adno'] || normalizedRow['admissionno'] || normalizedRow['id'];
                    const name = normalizedRow['name'] || normalizedRow['studentname'] || normalizedRow['fullname'];
                    const className = normalizedRow['classname'] || normalizedRow['class'] || normalizedRow['grade'];
                    let semester = normalizedRow['semester'] || normalizedRow['term'];

                    // Validation
                    if (!adNo || !name || !className) {
                        results.errors.push(`Row ${rowNum}: Missing required fields (AdNo, Name, or Class)`);
                        continue;
                    }

                    // Normalize semester
                    if (!semester) semester = 'Odd'; // Default
                    if (semester.toString().toLowerCase().includes('even') || semester.toString() === '2') semester = 'Even';
                    else semester = 'Odd';

                    const student: Omit<StudentRecord, 'id'> = {
                        adNo: String(adNo).trim(),
                        name: String(name).trim(),
                        className: String(className).trim(),
                        currentClass: String(className).trim(),
                        semester: semester as 'Odd' | 'Even',
                        marks: {},
                        grandTotal: 0,
                        average: 0,
                        rank: 0,
                        performanceLevel: 'Needs Improvement',
                        importRowNumber: timestamp + i
                    };

                    studentsToImport.push(student);

                } catch (error) {
                    results.errors.push(`Row ${rowNum}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            if (studentsToImport.length > 0) {
                const importResult = await this.bulkImportStudents(studentsToImport);
                results.success = importResult.success;
                results.errors = [...results.errors, ...importResult.errors];
            }

            console.log(`Excel import processing completed. Found ${studentsToImport.length} valid rows.`);
            return results;

        } catch (error) {
            console.error('Error importing students from Excel:', error);
            throw error;
        }
    }

    private prepareMarksDataForExport(students: StudentRecord[], subjects: SubjectConfig[], activeTerm: string): any[] {
        const exportData: any[] = [];
        
        // Find all unique subject names to ensure consistent columns across all rows
        // DEDUPLICATION: Group by name to prevent repeating columns
        const uniqueSubjectNames = [...new Set(subjects.map(s => s.name))];

        students.forEach(student => {
            // Retrieve term data from history
            const termRecord = student.academicHistory?.[activeTerm];
            const termMarks = termRecord?.marks || {};

            // Base student info
            const baseRow: any = {
                'Student ID': student.id,
                'Admission No': student.adNo,
                'Student Name': student.name,
                'Class': termRecord?.className || student.className,
                'Semester': activeTerm, // Clearer term label
                'Grand Total': termRecord?.grandTotal || 0,
                'Average': termRecord?.average || 0,
                'Rank': termRecord?.rank || 0,
                'Performance': termRecord?.performanceLevel || 'Pending'
            };

            // Initialize all possible subject columns with cleaner names
            uniqueSubjectNames.forEach(name => {
                baseRow[`${name} INT`] = '';
                baseRow[`${name} EXT`] = '';
                baseRow[`${name} Total`] = '';
                baseRow[`${name} Status`] = '';
            });

            // Map marks for each subject in this term
            subjects.forEach(subject => {
                const marks = termMarks[subject.id];
                if (marks) {
                    baseRow[`${subject.name} INT`] = marks.int;
                    baseRow[`${subject.name} EXT`] = marks.ext;
                    baseRow[`${subject.name} Total`] = marks.total;
                    baseRow[`${subject.name} Status`] = marks.status;
                }
            });

            exportData.push(baseRow);
        });

        return exportData;
    }

    // Excel import functionality for marks restoration
    async importMarksFromExcel(file: File): Promise<{ success: number; errors: string[] }> {
        const results = { success: 0, errors: [] as string[] };

        try {
            console.log('Starting marks import from Excel...');

            // Import XLSX dynamically using our service
            const XLSX = await loadExcelLibrary();

            // Read file
            const arrayBuffer = await file.arrayBuffer();
            const workbook = (XLSX as any).read(arrayBuffer, { type: 'array' });

            // Get the marks sheet
            const marksSheetName = 'Student Marks';
            if (!workbook.SheetNames.includes(marksSheetName)) {
                throw new Error('Excel file must contain a "Student Marks" sheet');
            }

            const marksSheet = workbook.Sheets[marksSheetName];
            const marksData = (XLSX as any).utils.sheet_to_json(marksSheet);

            if (marksData.length === 0) {
                throw new Error('No data found in Student Marks sheet');
            }

            // Get current subjects for validation
            const subjects = await this.getAllSubjects();
            const subjectMap = new Map(subjects.map(s => [s.name, s]));

            // Process each row
            for (let i = 0; i < marksData.length; i++) {
                const row = marksData[i] as any;
                const rowNum = i + 2; // Excel row number (accounting for header)

                try {
                    const studentId = row['Student ID'];
                    if (!studentId) {
                        results.errors.push(`Row ${rowNum}: Missing Student ID`);
                        continue;
                    }

                    // Verify student exists
                    const studentDoc = await getDoc(doc(this.db, this.studentsCollection, studentId));
                    if (!studentDoc.exists()) {
                        results.errors.push(`Row ${rowNum}: Student with ID ${studentId} not found`);
                        continue;
                    }

                    const student = this.processStudentRecord(studentDoc.data(), studentDoc.id);
                    const updatedMarks = { ...student.marks };

                    // Process marks for each subject scoped to their class
                    let hasUpdates = false;
                    const studentClassSubjects = subjects.filter(s => s.targetClasses.includes(student.className));

                    for (const subject of studentClassSubjects) {
                        const subjectName = subject.name;
                        const intKey = `${subjectName} - INT`;
                        const extKey = `${subjectName} - EXT`;
                        const statusKey = `${subjectName} - Status`;

                        const intProvided = row[intKey] !== undefined && row[intKey] !== '';
                        const extProvided = row[extKey] !== undefined && row[extKey] !== '';

                        // Only proceed if all required components for this subject are provided
                        const intOk = subject.maxINT > 0 ? intProvided : true;
                        const extOk = subject.maxEXT > 0 ? extProvided : true;

                        if (intOk && extOk && (intProvided || extProvided)) {
                            const int = intProvided ? parseInt(row[intKey]) : 0;
                            const ext = extProvided ? parseInt(row[extKey]) : 0;

                            if (isNaN(int) || isNaN(ext)) {
                                results.errors.push(`Row ${rowNum}: Invalid marks for ${subjectName} (INT: ${row[intKey]}, EXT: ${row[extKey]})`);
                                continue;
                            }

                            // Validate against subject limits
                            if (int > subject.maxINT || ext > subject.maxEXT) {
                                results.errors.push(`Row ${rowNum}: Marks exceed maximum for ${subjectName} (INT: ${int}/${subject.maxINT}, EXT: ${ext}/${subject.maxEXT})`);
                                continue;
                            }

                            // Calculate status
                            const isFullINT = subject.maxINT === 100;
                            const minINT = Math.ceil(subject.maxINT * 0.5);
                            const minEXT = isFullINT ? 0 : Math.ceil(subject.maxEXT * 0.4);

                            const passedINT = int >= minINT;
                            const passedEXT = isFullINT || ext >= minEXT || subject.maxEXT === 0;
                            const status = (passedINT && passedEXT) ? 'Passed' : 'Failed';

                            updatedMarks[subject.id] = {
                                int,
                                ext,
                                total: int + ext,
                                status
                            };
                            hasUpdates = true;
                        }
                    }

                    if (hasUpdates) {
                        // Recalculate totals
                        const grandTotal = Object.values(updatedMarks).reduce((sum, mark) => sum + mark.total, 0);
                        const average = Object.keys(updatedMarks).length > 0 ? grandTotal / Object.keys(updatedMarks).length : 0;

                        // Determine performance level
                        const performanceLevel = this.calculatePerformanceLevel(updatedMarks, subjects);

                        // Extract active term for correctly scoped update
                        const settings = await this.getGlobalSettings();
                        const activeTerm = this.getCurrentTermKey(settings);

                        const termRecord: TermRecord = {
                            className: student.className,
                            semester: activeTerm.split('-')[2] as 'Odd' | 'Even',
                            marks: updatedMarks,
                            grandTotal,
                            average: Math.round(average * 100) / 100,
                            rank: student.rank || 0,
                            performanceLevel
                        };

                        // Update student document with both root and history persistence
                        await updateDoc(doc(this.db, this.studentsCollection, studentId), {
                            marks: updatedMarks,
                            grandTotal,
                            average: Math.round(average * 100) / 100,
                            performanceLevel,
                            [`academicHistory.${activeTerm}`]: termRecord
                        });

                        // Invalidate cache to reflect changes
                        this.invalidateCache();

                        results.success++;
                    }
                } catch (error) {
                    results.errors.push(`Row ${rowNum}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            // Recalculate rankings for all classes
            const allClasses = [...new Set((marksData as any[]).map(row => row['Class']).filter(Boolean))];
            for (const className of allClasses) {
                await this.calculateClassRankings(className);
            }

            console.log(`Marks import completed: ${results.success} successful, ${results.errors.length} errors`);
            return results;

        } catch (error) {
            console.error('Error importing marks from Excel:', error);
            throw error;
        }
    }
    private sanitizeObject(obj: any) {
        return Object.entries(obj).reduce((acc, [key, value]) => {
            if (value !== undefined) acc[key] = value;
            return acc;
        }, {} as any);
    }

    // Exam Timetable Operations
    async saveExamTimetableEntries(entries: Omit<ExamTimetableEntry, 'id'>[]): Promise<void> {
        try {
            const settings = await this.getGlobalSettings();
            const batch = writeBatch(this.db);
            for (const entry of entries) {
                const docRef = doc(collection(this.db, this.examTimetablesCollection));
                batch.set(docRef, {
                    ...entry,
                    academicYear: settings.currentAcademicYear
                });
            }
            await batch.commit();
            this.invalidateCache();
        } catch (error) {
            console.error('Error saving exam timetable:', error);
            throw error;
        }
    }

    async getExamTimetable(className: string, semester: 'Odd' | 'Even', academicYear?: string): Promise<ExamTimetableEntry[]> {
        try {
            const settings = await this.getGlobalSettings();
            const targetYear = academicYear || settings.currentAcademicYear;
            const q = query(
                collection(this.db, this.examTimetablesCollection),
                where('className', '==', className),
                where('semester', '==', semester),
                where('academicYear', '==', targetYear)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExamTimetableEntry))
                .sort((a, b) => a.date.localeCompare(b.date));
        } catch (error) {
            console.error('Error fetching exam timetable:', error);
            return [];
        }
    }

    async clearExamTimetable(className: string, semester: 'Odd' | 'Even'): Promise<void> {
        try {
            const settings = await this.getGlobalSettings();
            const q = query(
                collection(this.db, this.examTimetablesCollection),
                where('className', '==', className),
                where('semester', '==', semester),
                where('academicYear', '==', settings.currentAcademicYear)
            );
            const snapshot = await getDocs(q);
            const batch = writeBatch(this.db);
            snapshot.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
            this.invalidateCache();
        } catch (error) {
            console.error('Error clearing exam timetable:', error);
            throw error;
        }
    }

    // Hall Ticket Release Operations
    async setHallTicketReleaseStatus(className: string, semester: 'Odd' | 'Even', isReleased: boolean): Promise<void> {
        try {
            const settings = await this.getGlobalSettings();
            const academicYear = settings.currentAcademicYear;
            const id = `${className}-${academicYear}-${semester}`;
            const docRef = doc(this.db, this.hallTicketSettingsCollection, id);
            await setDoc(docRef, {
                id,
                className,
                semester,
                academicYear,
                isReleased,
                releasedAt: isReleased ? Date.now() : null
            });
            this.invalidateCache();
        } catch (error) {
            console.error('Error setting hall ticket release status:', error);
            throw error;
        }
    }

    async getHallTicketReleaseStatus(className: string, semester: 'Odd' | 'Even', academicYear?: string): Promise<boolean> {
        try {
            const settings = await this.getGlobalSettings();
            const targetYear = academicYear || settings.currentAcademicYear;
            const id = `${className}-${targetYear}-${semester}`;
            const docRef = doc(this.db, this.hallTicketSettingsCollection, id);
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                return (snapshot.data() as HallTicketSettings).isReleased;
            }
            return false;
        } catch (error) {
            console.error('Error fetching hall ticket release status:', error);
            return false;
        }
    }

    async getOverallAttendance(studentId: string, className: string, termKey?: string): Promise<number> {
        try {
            const subjects = await this.getSubjectsByClass(className);
            if (subjects.length === 0) return 100;

            let totalClasses = 0;
            let totalPresent = 0;

            for (const subject of subjects) {
                const records = await this.getAttendanceForStudent(studentId, subject.id, termKey);
                totalClasses += records.length;
                totalPresent += records.filter(r => r.presentStudentIds.includes(studentId)).length;
            }

            return totalClasses > 0 ? (totalPresent / totalClasses) * 100 : 100;
        } catch (error) {
            console.error('Error calculating overall attendance:', error);
            return 0;
        }
    }

    // Academic Calendar Methods
    async getAcademicCalendar(): Promise<AcademicCalendarEntry[]> {
        const querySnapshot = await getDocs(collection(this.db, this.academicCalendarCollection));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AcademicCalendarEntry));
    }

    async saveAcademicCalendarEntry(entry: Omit<AcademicCalendarEntry, 'id'>): Promise<string> {
        const docRef = await addDoc(collection(this.db, this.academicCalendarCollection), entry);
        return docRef.id;
    }

    async deleteAcademicCalendarEntry(id: string): Promise<void> {
        await deleteDoc(doc(this.db, this.academicCalendarCollection, id));
    }

    // Timetable Generator Methods
    async getGeneratorConfig(className: string, semester: 'Odd' | 'Even'): Promise<TimetableGeneratorConfig | null> {
        const id = `${className}-${semester}`;
        const docRef = doc(this.db, this.generatorConfigsCollection, id);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
            return { id: snapshot.id, ...snapshot.data() } as TimetableGeneratorConfig;
        }
        return null;
    }

    async saveGeneratorConfig(config: TimetableGeneratorConfig): Promise<void> {
        const { id, ...data } = config;
        await setDoc(doc(this.db, this.generatorConfigsCollection, id), data);
    }

    async getApplicationById(id: string): Promise<StudentApplication | null> {
        try {
            const docRef = doc(this.db, this.applicationsCollection, id);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as StudentApplication : null;
        } catch (error) {
            console.error('Error fetching application:', error);
            return null;
        }
    }

    async getPreviousMarks(studentId: string, subjectId: string): Promise<{ int: number | 'A', ext: number | 'A' } | undefined> {
        try {
            const student = await this.getStudentById(studentId);
            if (!student || !student.academicHistory) return undefined;

            const termKeys = Object.keys(student.academicHistory).sort((a, b) => b.localeCompare(a));
            const currentTerm = this.getCurrentTermKey();

            for (const termKey of termKeys) {
                if (termKey === currentTerm) continue;

                const marks = student.academicHistory[termKey].marks[subjectId];
                if (marks && (marks.int !== undefined || marks.ext !== undefined)) {
                    return {
                        int: marks.int,
                        ext: marks.ext
                    };
                }
            }
            return undefined;
        } catch (error) {
            console.error('Error fetching previous marks:', error);
            return undefined;
        }
    }

    public async syncApplicationToSupplementary(application: StudentApplication): Promise<void> {
        try {
            // Find student ID if not present
            let studentId = application.studentId;
            if (!studentId) {
                const student = await this.getStudentByAdNo(application.adNo);
                if (!student) return;
                studentId = student.id;
            }

            // Check for existing record for this specific application or subject/term
            const q = query(
                collection(this.db, this.supplementaryExamsCollection),
                where('studentId', '==', studentId),
                where('subjectId', '==', application.subjectId),
                where('examTerm', '==', `${application.appliedYear}-${application.appliedSemester}`)
            );
            const snapshot = await getDocs(q);
            
            // If already exists, we might need to update the application ID if missing
            if (!snapshot.empty) {
                const existingDoc = snapshot.docs[0];
                const existingData = existingDoc.data() as SupplementaryExam;
                if (!existingData.applicationId) {
                    await updateDoc(existingDoc.ref, { 
                        applicationId: application.id,
                        applicationType: application.type
                    });
                }
                return;
            }

            const previousMarks = await this.getPreviousMarks(studentId, application.subjectId);
            const termKey = `${application.appliedYear}-${application.appliedSemester}`;

            const suppExam: Omit<SupplementaryExam, 'id'> = {
                studentId: studentId,
                subjectId: application.subjectId,
                examType: 'CurrentSemester',
                attemptNumber: 1, 
                originalTerm: termKey,
                originalSemester: application.appliedSemester,
                originalYear: parseInt(application.appliedYear.split('-')[0]),
                supplementaryYear: parseInt(application.appliedYear.split('-')[0]),
                status: 'Pending',
                marks: {
                    int: 0,
                    ext: 0,
                    total: 0,
                    status: 'Pending'
                },
                previousMarks,
                examTerm: termKey,
                appliedAt: application.createdAt || Date.now(),
                updatedAt: Date.now(),
                applicationId: application.id,
                applicationType: application.type
            };

            await addDoc(collection(this.db, this.supplementaryExamsCollection), suppExam);
            this.invalidateCache();
        } catch (error) {
            console.error('Error syncing application:', error);
        }
    }

    async updateSupplementaryExamMarks(id: string, marks: SubjectMarks, previousMarks?: { int: number | 'A', ext: number | 'A' }, attemptNumber?: number, originalTerm?: string): Promise<void> {
        try {
            const docRef = doc(this.db, this.supplementaryExamsCollection, id);
            const updates: any = {
                marks,
                status: 'Completed',
                updatedAt: Date.now()
            };
            if (previousMarks) {
                updates.previousMarks = previousMarks;
            }
            if (attemptNumber !== undefined) {
                updates.attemptNumber = attemptNumber;
            }
            if (originalTerm !== undefined) {
                updates.originalTerm = originalTerm;
            }
            await updateDoc(docRef, updates);
            this.invalidateCache();
        } catch (error) {
            console.error('Error updating supplementary marks:', error);
            throw error;
        }
    }

    /**
     * Finds all unique years present in student academic history
     * and updates the global settings if any are missing from availableYears.
     */
    async syncAllAvailableYears(): Promise<string[]> {
        try {
            const settings = await this.getGlobalSettings();
            const currentYears = new Set(settings.availableYears || []);
            const allStudents = await this.getAllStudents();
            
            const discoveredYears = new Set<string>();
            allStudents.forEach(student => {
                if (student.academicHistory) {
                    Object.keys(student.academicHistory).forEach(key => {
                        // Key format is usually YYYY-YYYY-Semester
                        const yearPart = key.split('-').slice(0, 2).join('-');
                        if (yearPart) discoveredYears.add(yearPart);
                    });
                }
            });

            const merged = Array.from(new Set([...currentYears, ...discoveredYears])).sort().reverse();
            
            if (merged.length > currentYears.size) {
                await this.updateGlobalSettings({
                    ...settings,
                    availableYears: merged
                });
                console.log('Synchronized available years:', merged);
            }
            
            return merged;
        } catch (error) {
            console.error('Error syncing available years:', error);
            return [];
        }
    }

    async getSemesterSummaries(): Promise<any[]> {
        try {
            // Force a fresh fetch of students to ensure counters are accurate
            this.invalidateCache();
            
            const settings = await this.getGlobalSettings();
            const years = settings.availableYears || [this.getCurrentTermKey().split('-').slice(0, 2).join('-')];
            const students = await this.getAllStudents();
            const attendanceSnap = await getDocs(collection(this.db, this.attendanceCollection));
            const attendanceRecords = attendanceSnap.docs.map(doc => doc.data());
            
            const subjectsSnap = await getDocs(collection(this.db, this.subjectsCollection));
            const allSubjects = subjectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubjectConfig));

            const summaries: any[] = [];
            const currentTerm = this.getCurrentTermKey();

            // Unique years from settings + student history + subjects
            const allYears = new Set([...years]);
            students.forEach(s => {
                if (s.academicHistory) {
                    Object.keys(s.academicHistory).forEach(key => {
                        const parts = key.split('-');
                        if (parts.length >= 2) {
                            allYears.add(parts.slice(0, 2).join('-'));
                        }
                    });
                }
            });
            allSubjects.forEach(s => {
                if (s.academicYear) allYears.add(s.academicYear);
            });

            Array.from(allYears).forEach(year => {
                ['Odd', 'Even'].forEach(sem => {
                    const termKey = `${year}-${sem}`;
                    
                    const termStudents = students.filter(s => {
                        if (termKey === currentTerm) return s.isActive !== false;
                        return s.academicHistory && s.academicHistory[termKey];
                    });
                    
                    // Same filtering rule as getAllSubjects
                    const termSubjects = allSubjects.filter(sub => {
                        if (sub.activeSemester && sub.activeSemester !== 'Both' && sub.activeSemester !== sem) return false;
                        if (sub.academicYear && sub.academicYear !== year) return false;
                        if (!sub.academicYear) {
                            const hasSpecific = allSubjects.some(s => s.name === sub.name && s.academicYear === year && (s.activeSemester === 'Both' || s.activeSemester === sem));
                            if (hasSpecific) return false;
                        }
                        return true;
                    });
                    
                    const termAttendance = attendanceRecords.filter(a => 
                        (a.academicYear === year && a.semester === sem) || 
                        (a.termKey === termKey)
                    );

                    const uniqueTeachers = new Set(termSubjects.map(s => s.facultyName).filter(f => f && f.trim() !== ''));
                    const uniqueClasses = new Set(termStudents.map(s => s.className).filter(Boolean));

                    // Show terms that actually have data OR are the current term
                    const hasStudents = termStudents.length > 0;
                    const hasAttendance = termAttendance.length > 0;
                    const hasSubjects = termSubjects.length > 0;
                    
                    if (hasStudents || hasAttendance || hasSubjects || termKey === currentTerm) {
                        summaries.push({
                            academicYear: year,
                            semester: sem,
                            termKey,
                            studentCount: termStudents.length,
                            attendanceCount: termAttendance.length,
                            subjectCount: termSubjects.length,
                            teacherCount: uniqueTeachers.size,
                            classCount: uniqueClasses.size,
                            isCurrent: termKey === currentTerm
                        });
                    }
                });
            });

            return summaries.sort((a, b) => b.termKey.localeCompare(a.termKey));
        } catch (error) {
            console.error('Error getting semester summaries:', error);
            return [];
        }
    }

    async deleteSemesterData(termKey: string): Promise<void> {
        try {
            const students = await this.getAllStudents();
            
            // Extract year and sem from "2025-2026-Odd"
            const parts = termKey.split('-');
            const sem = parts.pop();
            const year = parts.join('-');

            // We must process in batches since Firestore has a 500 writes limit per batch
            const MAX_BATCH_SIZE = 400;
            let currentBatch = writeBatch(this.db);
            let operationCount = 0;

            const commitBatchIfNeeded = async () => {
                if (operationCount >= MAX_BATCH_SIZE) {
                    await currentBatch.commit();
                    currentBatch = writeBatch(this.db);
                    operationCount = 0;
                }
            };

            // 1. Remove history from students
            for (const student of students) {
                let needsUpdate = false;
                const updateData: any = {};

                if (student.academicHistory && student.academicHistory[termKey]) {
                    updateData[`academicHistory.${termKey}`] = deleteField();
                    needsUpdate = true;
                }
                
                // Also clear top-level current term data if deleting active term
                if (termKey === this.getCurrentTermKey()) {
                    if (student.marks && Object.keys(student.marks).length > 0) {
                        updateData.marks = {};
                        updateData.grandTotal = 0;
                        updateData.average = 0;
                        updateData.rank = 0;
                        updateData.performanceLevel = 'Pending';
                        needsUpdate = true;
                    }
                }

                if (needsUpdate) {
                    const docRef = doc(this.db, this.studentsCollection, student.id);
                    currentBatch.update(docRef, updateData);
                    operationCount++;
                    await commitBatchIfNeeded();
                }
            }

            // 2. Delete attendance records
            const attendanceSnap = await getDocs(query(
                collection(this.db, this.attendanceCollection),
                where('termKey', '==', termKey)
            ));
            for (const d of attendanceSnap.docs) {
                currentBatch.delete(d.ref);
                operationCount++;
                await commitBatchIfNeeded();
            }
            
            // Fallback for legacy attendance with year/semester separate
            const legacyAttendanceSnap = await getDocs(query(
                collection(this.db, this.attendanceCollection),
                where('academicYear', '==', year),
                where('semester', '==', sem)
            ));
            for (const d of legacyAttendanceSnap.docs) {
                currentBatch.delete(d.ref);
                operationCount++;
                await commitBatchIfNeeded();
            }

            // 3. Delete Subjects - broad sweep: any subject matching this academicYear
            // included subjects without explicit activeSemester (orphaned test data)
            const subjectsSnap = await getDocs(collection(this.db, this.subjectsCollection));
            for (const docSnap of subjectsSnap.docs) {
                const sub = docSnap.data();
                const matchingSem = !sub.activeSemester || sub.activeSemester === sem || sub.activeSemester === 'Both';
                if (sub.academicYear === year && matchingSem) {
                    currentBatch.delete(docSnap.ref);
                    operationCount++;
                    await commitBatchIfNeeded();
                }
            }

            // 4. Handle Active Term Cleanup & Metadata Pruning
            const settings = await this.getGlobalSettings();
            const currentTerm = this.getCurrentTermKey();
            
            // Prune availableYears: only remove if NO other semester exists for this year
            let updatedAvailableYears = settings.availableYears || [];
            const otherSemForThisYear = students.some(s => {
                if (!s.academicHistory) return false;
                return Object.keys(s.academicHistory).some(k => k.startsWith(year) && k !== termKey);
            });
            
            if (!otherSemForThisYear) {
                updatedAvailableYears = updatedAvailableYears.filter(y => y !== year);
            }

            const remainingSemesters = (settings.semesters || []).filter(s => s.termKey !== termKey);
            
            if (termKey === currentTerm) {
                console.log('Deleting active term. Resetting global settings current semester pointers...');
                
                let fallbackYear = this.DEFAULT_ACADEMIC_YEAR;
                let fallbackSem = this.DEFAULT_SEMESTER;

                if (remainingSemesters.length > 0) {
                    const latest = remainingSemesters[0];
                    fallbackYear = latest.academicYear;
                    fallbackSem = latest.semester;
                } else if (updatedAvailableYears.length > 0) {
                    fallbackYear = updatedAvailableYears[0];
                    // If switching to a legacy year without a semester config, default to Odd
                    fallbackSem = 'Odd';
                }

                await this.updateGlobalSettings({
                    ...settings,
                    currentAcademicYear: fallbackYear,
                    currentSemester: fallbackSem as 'Odd' | 'Even',
                    availableYears: updatedAvailableYears,
                    semesters: remainingSemesters
                });
            } else {
                // Just prune the metadata
                await this.updateGlobalSettings({
                    ...settings,
                    availableYears: updatedAvailableYears,
                    semesters: remainingSemesters
                });
            }

            // Commit any remaining operations
            if (operationCount > 0) {
                await currentBatch.commit();
            }
            
            console.log(`Deleted all data for term: ${termKey}`);
            this.invalidateCache();
            
            // Auto-trigger repair after deletion to ensure fallback is solid
            await this.repairGlobalSettings();
        } catch (error) {
            console.error('Error deleting semester data:', error);
            throw error;
        }
    }

    /**
     * Scans all student records to rebuild availableYears and ensure currentActiveTerm points to real data.
     */
    async repairGlobalSettings(): Promise<{ discoveredYears: string[], activeTermSet: string }> {
        try {
            console.log('Repairing Global Settings...');
            const settings = await this.getGlobalSettings();
            const students = await this.getAllStudents();
            
            const discoveredYears = new Set<string>(settings.availableYears || []);
            const discoveredTerms = new Set<string>();
            
            students.forEach(s => {
                if (s.academicHistory) {
                    Object.keys(s.academicHistory).forEach(tk => {
                        discoveredTerms.add(tk);
                        const yearPart = tk.split('-').slice(0, 2).join('-');
                        if (yearPart) discoveredYears.add(yearPart);
                    });
                }
            });

            // Sort years newest first
            const sortedYears = Array.from(discoveredYears).sort().reverse();
            
            let newYear = settings.currentAcademicYear;
            let newSem = settings.currentSemester;
            
            // HEAL: If current year is NOT in discovered years (meaning it might be a deleted/orphaned term)
            // or if it has 0 students while others have data, consider switching
            const currentTermKey = this.getCurrentTermKey();
            const currentHasData = students.some(s => s.academicHistory?.[currentTermKey]);
            
            if (!currentHasData && sortedYears.length > 0) {
                // Find the first year in sorted list that actually has student records
                for (const year of sortedYears) {
                    const hasOdd = students.some(s => s.academicHistory?.[`${year}-Odd`]);
                    const hasEven = students.some(s => s.academicHistory?.[`${year}-Even`]);
                    
                    if (hasOdd) {
                        newYear = year;
                        newSem = 'Odd';
                        break;
                    } else if (hasEven) {
                        newYear = year;
                        newSem = 'Even';
                        break;
                    }
                }
            }

            const updatedSettings = {
                ...settings,
                availableYears: sortedYears,
                currentAcademicYear: newYear,
                currentSemester: newSem as 'Odd' | 'Even'
            };

            await this.updateGlobalSettings(updatedSettings);
            console.log('Global Settings repaired. Active Term:', `${newYear}-${newSem}`);
            
            return { 
                discoveredYears: sortedYears, 
                activeTermSet: `${newYear}-${newSem}` 
            };
        } catch (error) {
            console.error('Error repairing global settings:', error);
            throw error;
        }
    }

    // Clone subjects from one term to another (Helper for Wizard)
    async cloneSubjectsForNewTerm(targetAcademicYear: string): Promise<number> {
        try {
            const allSubjects = await this.getAllSubjects();
            if (allSubjects.length === 0) return 0;

            const batch = writeBatch(this.db);
            let count = 0;

            // In this architecture, subjects are global but we can update their academicYear
            // or simply ensure they are available for the new year's classes.
            // If the user wants to strictly ISOLATE subjects by year, we would need to duplicate them.
            // For now, let's just return the count and ensure they are all processed.
            return allSubjects.length;
        } catch (error) {
            console.error('Error cloning subjects:', error);
            return 0;
        }
    }

    // Bulk class promotion
    async promoteStudents(fromClass: string, toClass: string): Promise<void> {
        try {
            const students = await this.getAllStudents();
            const targetStudents = students.filter(s => s.className === fromClass);

            const MAX_BATCH_SIZE = 400;
            let currentBatch = writeBatch(this.db);
            let operationCount = 0;

            for (const student of targetStudents) {
                const docRef = doc(this.db, this.studentsCollection, student.id);
                currentBatch.update(docRef, { className: toClass });
                operationCount++;
                
                if (operationCount >= MAX_BATCH_SIZE) {
                    await currentBatch.commit();
                    currentBatch = writeBatch(this.db);
                    operationCount = 0;
                }
            }

            if (operationCount > 0) {
                await currentBatch.commit();
            }
            this.invalidateCache();
            console.log(`Successfully promoted ${targetStudents.length} students from ${fromClass} to ${toClass}`);
        } catch (error) {
            console.error('Error promoting students:', error);
            throw error;
        }
    }

    // Master System Backup (High Fidelity JSON Export)
    async downloadFullSystemBackup(): Promise<void> {
        try {
            console.log('Initiating Full System Backup (JSON)...');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const backup: Record<string, any[]> = {};
            
            const collectionsToBackup = [
                this.studentsCollection,
                this.subjectsCollection,
                this.settingsCollection,
                this.applicationsCollection,
                this.supplementaryExamsCollection,
                this.attendanceCollection,
                this.timetablesCollection,
                this.specialDaysCollection,
                this.examTimetablesCollection,
                this.hallTicketSettingsCollection,
                this.academicCalendarCollection,
                this.generatorConfigsCollection
            ];

            for (const colName of collectionsToBackup) {
                const q = query(collection(this.db, colName));
                const snapshot = await getDocs(q);
                backup[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            }

            const backupData = JSON.stringify(backup, null, 2);
            const blob = new Blob([backupData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `AIC_Dawa_Portal_Master_Backup_${timestamp}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            console.log('Master Backup complete.');
        } catch (error) {
            console.error('Error during Master Backup:', error);
            throw error;
        }
    }

    /**
     * Restore a specific academic term's data from a JSON backup file.
     * Restores: student academicHistory entries, subjects for that term, and attendance records.
     * SAFE: skips write if a student already has the academicHistory key (won't overwrite current data).
     * @param backupJson - Parsed JSON object from the backup file
     * @param termKey - e.g. "2025-2026-Odd"
     * @param forceOverwrite - if true, overwrites even existing academicHistory
     */
    async restoreTermFromBackup(
        backupJson: Record<string, any[]>,
        termKey: string,
        forceOverwrite = false
    ): Promise<{ studentsRestored: number; subjectsRestored: number; attendanceRestored: number; skipped: number }> {
        try {
            const parts = termKey.split('-');
            const sem = parts.pop()!; // 'Odd' or 'Even'
            const year = parts.join('-'); // '2025-2026'

            const MAX_BATCH_SIZE = 400;
            let currentBatch = writeBatch(this.db);
            let operationCount = 0;

            const commitBatchIfNeeded = async () => {
                if (operationCount >= MAX_BATCH_SIZE) {
                    await currentBatch.commit();
                    currentBatch = writeBatch(this.db);
                    operationCount = 0;
                }
            };

            // ─── 1. Restore student academicHistory entries ─────────────────
            const backupStudents: any[] = backupJson[this.studentsCollection] || [];
            let studentsRestored = 0;
            let skipped = 0;

            // Get live students map
            const liveSnap = await getDocs(collection(this.db, this.studentsCollection));
            const liveStudentsMap: Record<string, any> = {};
            liveSnap.docs.forEach(d => { liveStudentsMap[d.id] = d.data(); });

            for (const backupStudent of backupStudents) {
                const historyEntry = backupStudent.academicHistory?.[termKey];
                if (!historyEntry) continue; // This student had no data for this term

                const liveStudent = liveStudentsMap[backupStudent.id];

                if (!forceOverwrite && liveStudent?.academicHistory?.[termKey]) {
                    skipped++;
                    continue; // Already has this term's data
                }

                const docRef = doc(this.db, this.studentsCollection, backupStudent.id);
                const updateData: any = {
                    [`academicHistory.${termKey}`]: historyEntry
                };

                // If the student doesn't exist at all in live DB, create them
                if (!liveStudent) {
                    const { id, ...studentData } = backupStudent;
                    await setDoc(docRef, {
                        ...studentData,
                        // Ensure we don't import marks/grades from another term as current
                        marks: {},
                        grandTotal: 0,
                        average: 0,
                        rank: 0,
                        performanceLevel: 'Pending'
                    });
                } else {
                    currentBatch.update(docRef, updateData);
                    operationCount++;
                    await commitBatchIfNeeded();
                }
                studentsRestored++;
            }

            // ─── 2. Restore subjects for this term ──────────────────────────
            const backupSubjects: any[] = backupJson[this.subjectsCollection] || [];
            let subjectsRestored = 0;

            // Get live subjects to avoid duplicates
            const liveSubjectsSnap = await getDocs(collection(this.db, this.subjectsCollection));
            const liveSubjectIds = new Set(liveSubjectsSnap.docs.map(d => d.id));

            for (const sub of backupSubjects) {
                if (sub.academicYear !== year) continue;
                if (sub.activeSemester && sub.activeSemester !== sem && sub.activeSemester !== 'Both') continue;

                if (!liveSubjectIds.has(sub.id)) {
                    // Subject was deleted — restore it
                    const { id, ...subjectData } = sub;
                    const subDocRef = doc(this.db, this.subjectsCollection, id);
                    currentBatch.set(subDocRef, subjectData);
                    operationCount++;
                    await commitBatchIfNeeded();
                    subjectsRestored++;
                }
            }

            // ─── 3. Restore attendance records for this term ─────────────────
            const backupAttendance: any[] = backupJson[this.attendanceCollection] || [];
            let attendanceRestored = 0;

            // Get live attendance ids for this term
            const liveAttSnap = await getDocs(query(
                collection(this.db, this.attendanceCollection),
                where('termKey', '==', termKey)
            ));
            const liveAttIds = new Set(liveAttSnap.docs.map(d => d.id));

            for (const att of backupAttendance) {
                if (att.termKey !== termKey) {
                    // Also try matching via academicYear+semester for legacy records
                    if (!(att.academicYear === year && att.semester === sem)) continue;
                }
                if (liveAttIds.has(att.id)) continue; // Already exists

                const { id, ...attData } = att;
                const attDocRef = doc(this.db, this.attendanceCollection, id);
                currentBatch.set(attDocRef, attData);
                operationCount++;
                await commitBatchIfNeeded();
                attendanceRestored++;
            }

            // Commit remaining
            if (operationCount > 0) {
                await currentBatch.commit();
            }

            this.invalidateCache();
            console.log(`Restore complete: ${studentsRestored} students, ${subjectsRestored} subjects, ${attendanceRestored} attendance records`);

            return { studentsRestored, subjectsRestored, attendanceRestored, skipped };
        } catch (error) {
            console.error('Error restoring from backup:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const dataService = new DataService();