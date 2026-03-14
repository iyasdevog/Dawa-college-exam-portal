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
    Unsubscribe
} from 'firebase/firestore';
import { getDb } from '../config/firebaseConfig';
import { StudentRecord, SubjectConfig, SupplementaryExam, SubjectMarks, PerformanceLevel, ClassReleaseSettings, GlobalSettings, TermRecord } from '../../domain/entities/types';
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

    // Cache for performance optimization
    private studentsCache: StudentRecord[] | null = null;
    private subjectsCache: SubjectConfig[] | null = null;
    private cacheTimestamp: number = 0;
    private currentGlobalSettings: GlobalSettings | null = null;
    private readonly DEFAULT_ACADEMIC_YEAR = "2025-2026";
    private readonly DEFAULT_SEMESTER = "Odd";
    private readonly CACHE_DURATION = 30000; // 30 seconds cache

    // Helper method to get database instance
    private get db() {
        const database = getDb();
        if (!database) {
            throw new Error('Firebase not initialized');
        }
        return database;
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
     * Normalizes a student record from Firestore.
     * Maps legacy 'ta' and 'ce' fields in marks to 'int' and 'ext'.
     */
    private processStudentRecord(data: any, id: string): StudentRecord {
        const currentTermKey = this.getCurrentTermKey();
        let academicHistory = data.academicHistory || {};
        const currentClass = data.currentClass || data.className || '';

        // Extract marks for the current active term
        const termData = academicHistory[currentTermKey];
        const rawMarks = termData?.marks || data.marks || {};

        const normalizedMarks: Record<string, SubjectMarks> = {};
        Object.entries(rawMarks).forEach(([subjectId, marks]: [string, any]) => {
            normalizedMarks[subjectId] = {
                // TA (legacy) maps to EXT, CE (legacy) maps to INT
                int: marks.int !== undefined ? marks.int : (marks.ce !== undefined ? marks.ce : 0),
                ext: marks.ext !== undefined ? marks.ext : (marks.ta !== undefined ? marks.ta : 0),
                total: marks.total || 0,
                status: marks.status || 'Pending',
                isSupplementary: marks.isSupplementary,
                supplementaryYear: marks.supplementaryYear
            };
        });

        // Migration to new structure if needed
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

        // Always pull the current term's totals if available
        const currentTotals = academicHistory[currentTermKey] || {
            grandTotal: data.grandTotal || 0,
            average: data.average || 0,
            rank: data.rank || 0,
            performanceLevel: data.performanceLevel || 'C (Average)'
        };

        return {
            ...data,
            id,
            currentClass,
            academicHistory,
            // Reflect the active term in the root fields for component compatibility
            className: currentClass,
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
        this.studentsCache = null;
        this.subjectsCache = null;
        this.cacheTimestamp = 0;
    }

    private updateStudentInCache(studentId: string, updates: Partial<StudentRecord>): void {
        if (this.studentsCache && this.isCacheValid()) {
            const index = this.studentsCache.findIndex(s => s.id === studentId);
            if (index !== -1) {
                // Merge updates into the cached student
                this.studentsCache[index] = { ...this.studentsCache[index], ...updates };
                // Also update deep nested structures if necessary, but spreading handles top-level root fields.
                // For deep updates like academicHistory, it's safer to just replace the whole academicHistory object passed in updates.
            }
        }
    }

    private updateCache(students?: StudentRecord[], subjects?: SubjectConfig[]): void {
        if (students) this.studentsCache = students;
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

    async getAvailableAcademicYears(): Promise<string[]> {
        try {
            const students = await this.getAllStudents();
            const years = new Set<string>();

            // Add current default/global year
            const settings = await this.getGlobalSettings();
            years.add(settings.currentAcademicYear);

            // Add manually configured years
            if (settings.availableYears) {
                settings.availableYears.forEach(y => years.add(y));
            }

            students.forEach(s => {
                if (s.academicHistory) {
                    Object.keys(s.academicHistory).forEach(termKey => {
                        // Extract year part from "2024-2025-Odd"
                        const match = termKey.match(/^(\d{4}-\d{4})/);
                        if (match) years.add(match[1]);
                    });
                }
            });

            return Array.from(years).sort().reverse();
        } catch (error) {
            console.error('Error fetching available academic years:', error);
            return [this.DEFAULT_ACADEMIC_YEAR];
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

    // Student operations with caching
    async getAllStudents(): Promise<StudentRecord[]> {
        // Return cached data if valid
        if (this.isCacheValid() && this.studentsCache) {
            console.log('Returning cached students data');
            return this.studentsCache;
        }

        try {
            console.log('=== FETCHING STUDENTS FROM FIREBASE ===');
            // Remove orderBy to avoid composite index requirement
            const querySnapshot = await getDocs(collection(this.db, this.studentsCollection));

            const students = querySnapshot.docs.map(doc => this.processStudentRecord(doc.data(), doc.id));

            // Sort manually by import row number (priority) or rank
            students.sort((a, b) => {
                // If both have importRowNumber, use it (ascending)
                if (a.importRowNumber !== undefined && b.importRowNumber !== undefined) {
                    return a.importRowNumber - b.importRowNumber;
                }
                // If only a has it, it comes first (or last? usually explicit order first)
                // Let's keep mixed content sorted by rank if row number missing
                if (a.importRowNumber !== undefined) return -1;
                if (b.importRowNumber !== undefined) return 1;

                // Fallback to rank
                return (a.rank || 0) - (b.rank || 0);
            });

            console.log('Total students in database:', students.length);

            // Update cache
            this.updateCache(students);

            return students;
        } catch (error) {
            console.error('Error fetching students:', error);
            return [];
        }
    }

    async getStudentsByClass(className: string): Promise<StudentRecord[]> {
        try {
            // Use cached data if available
            const allStudents = await this.getAllStudents();
            const classStudents = allStudents.filter(student => student.className === className);

            console.log('Students found in class', className, ':', classStudents.length);
            return classStudents;
        } catch (error) {
            console.error('Error fetching students by class:', error);
            return [];
        }
    }

    async getStudentByAdNo(adNo: string): Promise<StudentRecord | null> {
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
            return this.processStudentRecord(doc.data(), doc.id);
        } catch (error) {
            console.error('Error fetching student by admission number:', error);
            return null;
        }
    }

    async addStudent(student: Omit<StudentRecord, 'id'>): Promise<string> {
        try {
            const docRef = await addDoc(collection(this.db, this.studentsCollection), student);
            console.log('Student added with ID:', docRef.id);
            this.invalidateCache();
            return docRef.id;
        } catch (error) {
            console.error('Error adding student:', error);
            throw error;
        }
    }

    async updateStudent(id: string, updates: Partial<StudentRecord>): Promise<void> {
        try {
            const docRef = doc(this.db, this.studentsCollection, id);
            await updateDoc(docRef, updates);
            console.log('Student updated:', id);
            this.invalidateCache();
        } catch (error) {
            console.error('Error updating student:', error);
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
    async getAllSubjects(): Promise<SubjectConfig[]> {
        // Return cached data if valid
        if (this.isCacheValid() && this.subjectsCache) {
            return this.subjectsCache;
        }

        try {
            const querySnapshot = await getDocs(collection(this.db, this.subjectsCollection));

            const subjects = querySnapshot.docs.map(doc => this.processSubjectConfig(doc.data(), doc.id));

            // Update cache
            this.updateCache(undefined, subjects);

            return subjects;
        } catch (error) {
            console.error('Error fetching subjects:', error);
            return [];
        }
    }

    async getSubjectsByClass(className: string): Promise<SubjectConfig[]> {
        try {
            const allSubjects = await this.getAllSubjects();
            return allSubjects.filter(subject => subject.targetClasses.includes(className));
        } catch (error) {
            console.error('Error fetching subjects by class:', error);
            return [];
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

    async getEnrolledStudentsForSubject(subjectId: string): Promise<StudentRecord[]> {
        try {
            console.log('=== DEBUGGING getEnrolledStudentsForSubject ===');
            console.log('Subject ID:', subjectId);

            const subjectDoc = await getDoc(doc(this.db, this.subjectsCollection, subjectId));
            if (!subjectDoc.exists()) {
                console.log('Subject document does not exist!');
                return [];
            }

            const subject = this.processSubjectConfig(subjectDoc.data(), subjectDoc.id);
            console.log('Subject data:', {
                name: subject.name,
                subjectType: subject.subjectType,
                targetClasses: subject.targetClasses,
                enrolledStudents: subject.enrolledStudents?.length || 0
            });

            if (subject.subjectType === 'general') {
                console.log('Subject is GENERAL - getting all students from target classes');
                // For general subjects, return all students from target classes
                const allStudents: StudentRecord[] = [];
                for (const className of subject.targetClasses) {
                    console.log('Getting students from class:', className);
                    const classStudents = await this.getStudentsByClass(className);
                    console.log('Found students in', className, ':', classStudents.length);
                    allStudents.push(...classStudents);
                }
                console.log('Total students from all target classes:', allStudents.length);
                return allStudents;
            } else {
                console.log('Subject is ELECTIVE - getting only enrolled students');
                // For elective subjects, return only enrolled students
                const enrolledStudentIds = subject.enrolledStudents || [];
                if (enrolledStudentIds.length === 0) {
                    console.log('No students enrolled in this elective subject');
                    return [];
                }

                const allStudents = await this.getAllStudents();
                const enrolledStudents = allStudents.filter(student => enrolledStudentIds.includes(student.id));
                console.log('Enrolled students found:', enrolledStudents.length);
                return enrolledStudents;
            }
        } catch (error) {
            console.error('Error getting enrolled students for subject:', error);
            return [];
        }
    }

    // Supplementary exam operations
    async addSupplementaryExam(supplementaryExam: Omit<SupplementaryExam, 'id'>): Promise<string> {
        try {
            const docRef = await addDoc(collection(this.db, this.supplementaryExamsCollection), supplementaryExam);
            console.log('Supplementary exam added with ID:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('Error adding supplementary exam:', error);
            throw error;
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

    async updateSupplementaryExamMarks(supplementaryExamId: string, marks: SubjectMarks): Promise<void> {
        try {
            const docRef = doc(this.db, this.supplementaryExamsCollection, supplementaryExamId);
            await updateDoc(docRef, {
                marks,
                status: 'Completed'
            });

            this.invalidateCache();
            console.log('Supplementary exam marks updated:', supplementaryExamId);
        } catch (error) {
            console.error('Error updating supplementary exam marks:', error);
            throw error;
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

    async getAllSupplementaryExams(): Promise<(SupplementaryExam & { studentName?: string; studentAdNo?: string; subjectName?: string })[]> {
        try {
            const snapshot = await getDocs(collection(this.db, this.supplementaryExamsCollection));
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
                    subjectName: subject?.name
                };
            });
        } catch (error) {
            console.error('Error fetching all supplementary exams:', error);
            return [];
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
                        batch.set(docRef, {
                            ...student,
                            marks: student.marks || {},
                            grandTotal: student.grandTotal || 0,
                            average: student.average || 0,
                            rank: student.rank || 0,
                            performanceLevel: student.performanceLevel || 'C (Average)'
                        });

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

                if (i > 0 && total === (sortedStudents[i - 1].academicHistory?.[activeTerm]?.grandTotal || 0) && total > 0) {
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
            }

            await batch.commit();
            console.log('Class rankings updated for:', className, 'term:', activeTerm);
        } catch (error) {
            console.error('Error calculating class rankings:', error);
            throw error;
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
                        // Recalculate performance level based on subject individual marks
                        const performanceLevel = this.calculatePerformanceLevel(student.marks, allSubjects);

                        // Only update if performance level has changed
                        if (student.performanceLevel !== performanceLevel) {
                            const docRef = doc(this.db, this.studentsCollection, student.id);
                            batch.update(docRef, { performanceLevel });
                            results.updated++;
                            console.log(`Updated ${student.name}: ${student.average}% from "${student.performanceLevel}" to "${performanceLevel}"`);
                        }
                    } catch (error) {
                        results.errors.push(`${student.name} (${student.adNo}): ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }

                if (currentBatch.length > 0) {
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
                        const marksEntries = Object.entries(student.marks);
                        if (marksEntries.length === 0) continue;

                        // Identify which general subjects have marks
                        const generalMarksCount = generalSubjects.filter(s =>
                            student.marks[s.id] !== undefined
                        ).length;

                        // Identify if any elective marks exist
                        const electiveMarks = electiveSubjects.filter(s =>
                            student.marks[s.id] !== undefined
                        );
                        const hasElectiveMark = electiveMarks.length > 0;

                        // Recalculate grandTotal
                        const grandTotal = marksEntries.reduce((sum, [_, mark]) =>
                            sum + this.getMarkValue(mark.total as any), 0);

                        // Denominator: General subjects + 1 (if any elective marks exist)
                        const subjectCount = generalMarksCount + (hasElectiveMark ? 1 : 0);

                        let average = subjectCount > 0 ? grandTotal / subjectCount : 0;
                        if (isNaN(average)) average = 0;

                        // Determine performance level
                        const performanceLevel = this.calculatePerformanceLevel(student.marks, allSubjects);

                        const docRef = doc(this.db, this.studentsCollection, student.id);
                        batch.update(docRef, {
                            grandTotal,
                            average: Math.round(average * 100) / 100,
                            performanceLevel
                        });

                        results.updated++;
                    } catch (error) {
                        results.errors.push(`${student.name} (${student.adNo}): ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }

                if (currentBatch.length > 0) {
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

            for (const student of students) {
                let studentUpdated = false;
                const updatedMarks = { ...student.marks };

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
                    // For full INT subjects, EXT is always considered ready
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
                    await updateDoc(doc(this.db, this.studentsCollection, student.id), { marks: updatedMarks });
                    results.updated++;
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

            // Recalculate totals for this term
            const allSubjects = await this.getAllSubjects();
            const generalSubjects = allSubjects.filter(s => s.subjectType !== 'elective');
            const electiveSubjects = allSubjects.filter(s => s.subjectType === 'elective');

            const grandTotal = Object.values(updatedTermMarks).reduce((sum, mark) => sum + this.getMarkValue((mark as any).total), 0);
            const generalMarksCount = generalSubjects.filter(s => updatedTermMarks[s.id] !== undefined).length;
            const hasElectiveMark = electiveSubjects.some(s => updatedTermMarks[s.id] !== undefined);
            const subjectCount = generalMarksCount + (hasElectiveMark ? 1 : 0);

            let average = subjectCount > 0 ? grandTotal / subjectCount : 0;
            if (isNaN(average)) average = 0;
            const performanceLevel = this.calculatePerformanceLevel(updatedTermMarks, allSubjects);

            const updatedTermRecord = {
                ...termRecord,
                marks: updatedTermMarks,
                grandTotal,
                average: Math.round(average * 100) / 100,
                performanceLevel
            };

            const updates: any = {
                [`academicHistory.${activeTerm}`]: updatedTermRecord
            };

            // Root synchronization for the globally active term
            if (activeTerm === this.getCurrentTermKey()) {
                updates.marks = updatedTermMarks;
                updates.grandTotal = grandTotal;
                updates.average = updatedTermRecord.average;
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
                    average: updatedTermRecord.average,
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

            const grandTotal = Object.values(updatedTermMarks).reduce((sum, mark) => sum + this.getMarkValue((mark as any).total), 0);
            const subjectCount = Object.keys(updatedTermMarks).length;
            const average = subjectCount > 0 ? grandTotal / subjectCount : 0;
            const allSubjects = await this.getAllSubjects();
            const performanceLevel = this.calculatePerformanceLevel(updatedTermMarks, allSubjects);

            const updatedTermRecord = {
                ...termRecord,
                marks: updatedTermMarks,
                grandTotal,
                average: Math.round(average * 100) / 100,
                performanceLevel
            };

            const updates: any = { [`academicHistory.${activeTerm}`]: updatedTermRecord };
            if (activeTerm === this.getCurrentTermKey()) {
                updates.marks = updatedTermMarks;
                updates.grandTotal = grandTotal;
                updates.average = updatedTermRecord.average;
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
                    average: updatedTermRecord.average,
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

            const grandTotal = Object.values(updatedTermMarks).reduce((sum, mark) => sum + this.getMarkValue((mark as any).total), 0);
            const subjectCount = Object.keys(updatedTermMarks).length;
            const average = subjectCount > 0 ? grandTotal / subjectCount : 0;
            const allSubjects = await this.getAllSubjects();
            const performanceLevel = this.calculatePerformanceLevel(updatedTermMarks, allSubjects);

            const updatedTermRecord = {
                ...termRecord,
                marks: updatedTermMarks,
                grandTotal,
                average: Math.round(average * 100) / 100,
                performanceLevel
            };

            const updates: any = { [`academicHistory.${activeTerm}`]: updatedTermRecord };
            if (activeTerm === this.getCurrentTermKey()) {
                updates.marks = updatedTermMarks;
                updates.grandTotal = grandTotal;
                updates.average = updatedTermRecord.average;
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
                    average: updatedTermRecord.average,
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

                const grandTotal = Object.values(updatedTermMarks).reduce((sum, mark) => sum + this.getMarkValue((mark as any).total), 0);
                const generalMarksCount = allSubjects.filter(s => s.subjectType !== 'elective' && updatedTermMarks[s.id] !== undefined).length;
                const hasElectiveMark = allSubjects.filter(s => s.subjectType === 'elective').some(s => updatedTermMarks[s.id] !== undefined);
                const subjectCount = generalMarksCount + (hasElectiveMark ? 1 : 0);

                const average = subjectCount > 0 ? grandTotal / subjectCount : 0;
                const performanceLevel = this.calculatePerformanceLevel(updatedTermMarks, allSubjects);

                const updatedTermRecord = {
                    ...termRecord,
                    marks: updatedTermMarks,
                    grandTotal,
                    average: Math.round(average * 100) / 100,
                    performanceLevel
                };

                const updates: any = { [`academicHistory.${activeTerm}`]: updatedTermRecord };
                if (activeTerm === this.getCurrentTermKey()) {
                    updates.marks = updatedTermMarks;
                    updates.grandTotal = grandTotal;
                    updates.average = updatedTermRecord.average;
                    updates.performanceLevel = performanceLevel;
                }

                const docRef = doc(this.db, this.studentsCollection, studentId);
                batch.update(docRef, updates);

                // Inline cache update
                this.updateStudentInCache(studentId, {
                    academicHistory: { ...student.academicHistory, [activeTerm]: updatedTermRecord },
                    ...(activeTerm === this.getCurrentTermKey() ? { marks: updatedTermMarks, grandTotal, average: updatedTermRecord.average, performanceLevel } : {})
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

            const grandTotal = Object.values(updatedTermMarks).reduce((sum, mark) => sum + this.getMarkValue((mark as any).total), 0);
            const average = Object.keys(updatedTermMarks).length > 0 ? grandTotal / Object.keys(updatedTermMarks).length : 0;
            const allSubjects = await this.getAllSubjects();
            const performanceLevel = this.calculatePerformanceLevel(updatedTermMarks, allSubjects);

            const updatedTermRecord = {
                ...termRecord,
                marks: updatedTermMarks,
                grandTotal,
                average: Math.round(average * 100) / 100,
                performanceLevel
            };

            const updates: any = { [`academicHistory.${activeTerm}`]: updatedTermRecord };
            if (activeTerm === this.getCurrentTermKey()) {
                updates.marks = updatedTermMarks;
                updates.grandTotal = grandTotal;
                updates.average = updatedTermRecord.average;
                updates.performanceLevel = performanceLevel;
            }

            await updateDoc(doc(this.db, this.studentsCollection, studentId), updates);
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

                const grandTotal = Object.values(updatedTermMarks).reduce((sum, mark) => sum + this.getMarkValue((mark as any).total), 0);
                const generalMarksCount = allSubjects.filter(s => s.subjectType !== 'elective' && updatedTermMarks[s.id] !== undefined).length;
                const hasElectiveMark = allSubjects.filter(s => s.subjectType === 'elective').some(s => updatedTermMarks[s.id] !== undefined);
                const subjectCount = generalMarksCount + (hasElectiveMark ? 1 : 0);

                const average = subjectCount > 0 ? grandTotal / subjectCount : 0;
                const performanceLevel = this.calculatePerformanceLevel(updatedTermMarks, allSubjects);

                const updatedTermRecord = {
                    ...termRecord,
                    marks: updatedTermMarks,
                    grandTotal,
                    average: Math.round(average * 100) / 100,
                    performanceLevel
                };

                const updates: any = { [`academicHistory.${activeTerm}`]: updatedTermRecord };
                if (activeTerm === this.getCurrentTermKey()) {
                    updates.marks = updatedTermMarks;
                    updates.grandTotal = grandTotal;
                    updates.average = updatedTermRecord.average;
                    updates.performanceLevel = performanceLevel;
                }

                const docRef = doc(this.db, this.studentsCollection, studentId);
                batch.update(docRef, updates);

                this.updateStudentInCache(studentId, {
                    academicHistory: { ...student.academicHistory, [activeTerm]: updatedTermRecord },
                    ...(activeTerm === this.getCurrentTermKey() ? { marks: updatedTermMarks, grandTotal, average: updatedTermRecord.average, performanceLevel } : {})
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

                const grandTotal = Object.values(updatedTermMarks).reduce((sum, mark) => sum + this.getMarkValue((mark as any).total), 0);
                const generalMarksCount = allSubjects.filter(s => s.subjectType !== 'elective' && updatedTermMarks[s.id] !== undefined).length;
                const hasElectiveMark = allSubjects.filter(s => s.subjectType === 'elective').some(s => updatedTermMarks[s.id] !== undefined);
                const subjectCount = generalMarksCount + (hasElectiveMark ? 1 : 0);

                const average = subjectCount > 0 ? grandTotal / subjectCount : 0;
                const performanceLevel = this.calculatePerformanceLevel(updatedTermMarks, allSubjects);

                const updatedTermRecord = {
                    ...termRecord,
                    marks: updatedTermMarks,
                    grandTotal,
                    average: Math.round(average * 100) / 100,
                    performanceLevel
                };

                const updates: any = { [`academicHistory.${activeTerm}`]: updatedTermRecord };
                if (activeTerm === this.getCurrentTermKey()) {
                    updates.marks = updatedTermMarks;
                    updates.grandTotal = grandTotal;
                    updates.average = updatedTermRecord.average;
                    updates.performanceLevel = performanceLevel;
                }

                const docRef = doc(this.db, this.studentsCollection, studentId);
                batch.update(docRef, updates);

                this.updateStudentInCache(studentId, {
                    academicHistory: { ...student.academicHistory, [activeTerm]: updatedTermRecord },
                    ...(activeTerm === this.getCurrentTermKey() ? { marks: updatedTermMarks, grandTotal, average: updatedTermRecord.average, performanceLevel } : {})
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

            for (const update of updates) {
                const student = allStudents.find(s => s.id === update.studentId);
                const subject = allSubjects.find(s => s.id === update.subjectId);
                
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

                const updatedTermMarks = {
                    ...termRecord.marks,
                    [update.subjectId]: { int: update.int, ext, total, status }
                } as Record<string, SubjectMarks>;

                const grandTotal = Object.values(updatedTermMarks).reduce((sum, mark) => sum + this.getMarkValue((mark as any).total), 0);
                const generalMarksCount = allSubjects.filter(s => s.subjectType !== 'elective' && updatedTermMarks[s.id] !== undefined).length;
                const hasElectiveMark = allSubjects.filter(s => s.subjectType === 'elective').some(s => updatedTermMarks[s.id] !== undefined);
                const subjectCount = generalMarksCount + (hasElectiveMark ? 1 : 0);

                const average = subjectCount > 0 ? grandTotal / subjectCount : 0;
                const performanceLevel = this.calculatePerformanceLevel(updatedTermMarks, allSubjects);

                const updatedTermRecord = {
                    ...termRecord,
                    marks: updatedTermMarks,
                    grandTotal,
                    average: Math.round(average * 100) / 100,
                    performanceLevel
                };

                const docRef = doc(this.db, this.studentsCollection, student.id);
                const docUpdates: any = { [`academicHistory.${activeTerm}`]: updatedTermRecord };
                
                if (activeTerm === this.getCurrentTermKey()) {
                    docUpdates.marks = updatedTermMarks;
                    docUpdates.grandTotal = grandTotal;
                    docUpdates.average = updatedTermRecord.average;
                    docUpdates.performanceLevel = performanceLevel;
                }

                batch.update(docRef, docUpdates);

                // Update local cache manually
                this.updateStudentInCache(student.id, {
                    academicHistory: { ...student.academicHistory, [activeTerm]: updatedTermRecord },
                    ...(activeTerm === this.getCurrentTermKey() ? { marks: updatedTermMarks, grandTotal, average: updatedTermRecord.average, performanceLevel } : {})
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

            for (const update of updates) {
                const student = allStudents.find(s => s.id === update.studentId);
                const subject = allSubjects.find(s => s.id === update.subjectId);
                
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

                const updatedTermMarks = {
                    ...termRecord.marks,
                    [update.subjectId]: { int, ext: update.ext, total, status }
                } as Record<string, SubjectMarks>;

                const grandTotal = Object.values(updatedTermMarks).reduce((sum, mark) => sum + this.getMarkValue((mark as any).total), 0);
                const generalMarksCount = allSubjects.filter(s => s.subjectType !== 'elective' && updatedTermMarks[s.id] !== undefined).length;
                const hasElectiveMark = allSubjects.filter(s => s.subjectType === 'elective').some(s => updatedTermMarks[s.id] !== undefined);
                const subjectCount = generalMarksCount + (hasElectiveMark ? 1 : 0);

                const average = subjectCount > 0 ? grandTotal / subjectCount : 0;
                const performanceLevel = this.calculatePerformanceLevel(updatedTermMarks, allSubjects);

                const updatedTermRecord = {
                    ...termRecord,
                    marks: updatedTermMarks,
                    grandTotal,
                    average: Math.round(average * 100) / 100,
                    performanceLevel
                };

                const docRef = doc(this.db, this.studentsCollection, student.id);
                const docUpdates: any = { [`academicHistory.${activeTerm}`]: updatedTermRecord };
                
                if (activeTerm === this.getCurrentTermKey()) {
                    docUpdates.marks = updatedTermMarks;
                    docUpdates.grandTotal = grandTotal;
                    docUpdates.average = updatedTermRecord.average;
                    docUpdates.performanceLevel = performanceLevel;
                }

                batch.update(docRef, docUpdates);

                this.updateStudentInCache(student.id, {
                    academicHistory: { ...student.academicHistory, [activeTerm]: updatedTermRecord },
                    ...(activeTerm === this.getCurrentTermKey() ? { marks: updatedTermMarks, grandTotal, average: updatedTermRecord.average, performanceLevel } : {})
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

            for (const update of updates) {
                const student = allStudents.find(s => s.id === update.studentId);
                const subject = allSubjects.find(s => s.id === update.subjectId);
                
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

                const grandTotal = Object.values(updatedTermMarks).reduce((sum, mark) => sum + this.getMarkValue((mark as any).total), 0);
                const generalMarksCount = allSubjects.filter(s => s.subjectType !== 'elective' && updatedTermMarks[s.id] !== undefined).length;
                const hasElectiveMark = allSubjects.filter(s => s.subjectType === 'elective').some(s => updatedTermMarks[s.id] !== undefined);
                const subjectCount = generalMarksCount + (hasElectiveMark ? 1 : 0);

                const average = subjectCount > 0 ? grandTotal / subjectCount : 0;
                const performanceLevel = this.calculatePerformanceLevel(updatedTermMarks, allSubjects);

                const updatedTermRecord = {
                    ...termRecord,
                    marks: updatedTermMarks,
                    grandTotal,
                    average: Math.round(average * 100) / 100,
                    performanceLevel
                };

                const docRef = doc(this.db, this.studentsCollection, student.id);
                const docUpdates: any = { [`academicHistory.${activeTerm}`]: updatedTermRecord };
                
                if (activeTerm === this.getCurrentTermKey()) {
                    docUpdates.marks = updatedTermMarks;
                    docUpdates.grandTotal = grandTotal;
                    docUpdates.average = updatedTermRecord.average;
                    docUpdates.performanceLevel = performanceLevel;
                }

                batch.update(docRef, docUpdates);

                this.updateStudentInCache(student.id, {
                    academicHistory: { ...student.academicHistory, [activeTerm]: updatedTermRecord },
                    ...(activeTerm === this.getCurrentTermKey() ? { marks: updatedTermMarks, grandTotal, average: updatedTermRecord.average, performanceLevel } : {})
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
    async exportMarksToExcel(): Promise<void> {
        try {
            console.log('Starting marks export to Excel...');

            // Get all students and subjects
            const [students, subjects] = await Promise.all([
                this.getAllStudents(),
                this.getAllSubjects()
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
            const marksData = this.prepareMarksDataForExport(students, subjects);
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
            // Generate filename with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `AIC_Dawa_College_Marks_Backup_${timestamp}.xlsx`;

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

    private prepareMarksDataForExport(students: StudentRecord[], subjects: SubjectConfig[]): any[] {
        const exportData: any[] = [];

        students.forEach(student => {
            // Base student info
            const baseRow = {
                'Student ID': student.id,
                'Admission No': student.adNo,
                'Student Name': student.name,
                'Class': student.className,
                'Semester': student.semester,
                'Grand Total': student.grandTotal,
                'Average': student.average,
                'Rank': student.rank,
                'Performance Level': student.performanceLevel
            };

            // Add marks for each subject
            subjects.forEach(subject => {
                const marks = student.marks[subject.id];
                if (marks) {
                    baseRow[`${subject.name} - INT`] = marks.int;
                    baseRow[`${subject.name} - EXT`] = marks.ext;
                    baseRow[`${subject.name} - Total`] = marks.total;
                    baseRow[`${subject.name} - Status`] = marks.status;
                } else {
                    baseRow[`${subject.name} - INT`] = '';
                    baseRow[`${subject.name} - EXT`] = '';
                    baseRow[`${subject.name} - Total`] = '';
                    baseRow[`${subject.name} - Status`] = '';
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

                    // Process marks for each subject
                    let hasUpdates = false;
                    for (const [subjectName, subject] of subjectMap) {
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

                        // Update student document
                        await updateDoc(doc(this.db, this.studentsCollection, studentId), {
                            marks: updatedMarks,
                            grandTotal,
                            average: Math.round(average * 100) / 100,
                            performanceLevel
                        });

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
}

// Export singleton instance
export const dataService = new DataService();