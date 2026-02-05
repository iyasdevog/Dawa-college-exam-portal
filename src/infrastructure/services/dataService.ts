import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    writeBatch,
    onSnapshot,
    Unsubscribe
} from 'firebase/firestore';
import { getDb } from '../config/firebaseConfig';
import { StudentRecord, SubjectConfig, SupplementaryExam, SubjectMarks, PerformanceLevel } from '../../domain/entities/types';
import { CLASSES } from '../../domain/entities/constants';
import { loadExcelLibrary } from './dynamicImports';
import { normalizeName } from './formatUtils';

export class DataService {
    // Helper to calculate performance level
    // Helper to calculate performance level
    private calculatePerformanceLevel(average: number): PerformanceLevel {
        if (average >= 95) return 'O (Outstanding)';
        if (average >= 85) return 'A+ (Excellent)';
        if (average >= 75) return 'A (Very Good)';
        if (average >= 65) return 'B+ (Good)';
        if (average >= 55) return 'B (Good)';
        if (average >= 40) return 'C (Average)';
        return 'F (Failed)';
    }

    // Collections
    private studentsCollection = 'students';
    private subjectsCollection = 'subjects';
    private supplementaryExamsCollection = 'supplementaryExams';

    // Cache for performance optimization
    private studentsCache: StudentRecord[] | null = null;
    private subjectsCache: SubjectConfig[] | null = null;
    private cacheTimestamp: number = 0;
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

    // Cache management
    private isCacheValid(): boolean {
        return this.cacheTimestamp > 0 && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
    }

    private invalidateCache(): void {
        this.studentsCache = null;
        this.subjectsCache = null;
        this.cacheTimestamp = 0;
    }

    private updateCache(students?: StudentRecord[], subjects?: SubjectConfig[]): void {
        if (students) this.studentsCache = students;
        if (subjects) this.subjectsCache = subjects;
        this.cacheTimestamp = Date.now();
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

            const students = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as StudentRecord));

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
            return {
                id: doc.id,
                ...doc.data()
            } as StudentRecord;
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
        try {
            const querySnapshot = await getDocs(collection(this.db, this.subjectsCollection));

            return querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as SubjectConfig));
        } catch (error) {
            console.error('Error fetching subjects:', error);
            return [];
        }
    }

    async getSubjectsByClass(className: string): Promise<SubjectConfig[]> {
        try {
            const querySnapshot = await getDocs(collection(this.db, this.subjectsCollection));

            return querySnapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as SubjectConfig))
                .filter(subject => subject.targetClasses.includes(className));
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

            const subject = subjectDoc.data() as SubjectConfig;
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

            const subject = subjectDoc.data() as SubjectConfig;
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

            const subject = subjectDoc.data() as SubjectConfig;
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
                    const student = { id: studentDoc.id, ...studentDoc.data() } as StudentRecord;
                    results.push({ student, supplementaryExam: suppExam });
                }
            }

            return results;
        } catch (error) {
            console.error('Error getting students with supplementary exams:', error);
            return [];
        }
    }

    // Real-time listeners
    subscribeToStudents(callback: (students: StudentRecord[]) => void): Unsubscribe {
        return onSnapshot(
            // Remove orderBy to avoid composite index requirement
            collection(this.db, this.studentsCollection),
            (snapshot) => {
                const students = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as StudentRecord));

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
                const subjects = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as SubjectConfig));
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

    async calculateClassRankings(className: string): Promise<void> {
        try {
            const students = await this.getStudentsByClass(className);

            // Sort by grand total (descending) - handle undefined totals
            const sortedStudents = [...students].sort((a, b) => (b.grandTotal || 0) - (a.grandTotal || 0));

            // Update ranks with standard competition ranking (1, 1, 3, 4)
            const batch = writeBatch(this.db);
            let currentRank = 1;

            for (let i = 0; i < sortedStudents.length; i++) {
                const student = sortedStudents[i];

                // If not the first student and has same total as previous, give same rank
                if (i > 0 && student.grandTotal === sortedStudents[i - 1].grandTotal) {
                    // rank remains same as previous student's rank
                } else {
                    // rank becomes current position (1-based index) - this creates gaps (1, 1, 3)
                    currentRank = i + 1;
                }

                const docRef = doc(this.db, this.studentsCollection, student.id);
                batch.update(docRef, { rank: currentRank });
            }

            await batch.commit();
            console.log('Class rankings updated for:', className);
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

            // Get all students
            const allStudents = await this.getAllStudents();
            console.log(`Found ${allStudents.length} students to recalculate`);

            // Process in batches of 500 (Firestore limit)
            const batchSize = 500;

            for (let i = 0; i < allStudents.length; i += batchSize) {
                const batch = writeBatch(this.db);
                const currentBatch = allStudents.slice(i, i + batchSize);

                for (const student of currentBatch) {
                    try {
                        // Recalculate performance level based on current average
                        const performanceLevel = this.calculatePerformanceLevel(student.average);

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
                        const performanceLevel = this.calculatePerformanceLevel(average);

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
                    const ta = marks.ta;
                    const ce = marks.ce;

                    const taVal = this.getMarkValue(ta);
                    const ceVal = this.getMarkValue(ce);

                    const minTA = Math.ceil(subject.maxTA * 0.4);
                    const minCE = Math.ceil(subject.maxCE * 0.5);
                    const passedTA = ta !== 'A' && taVal >= minTA;
                    const passedCE = ce !== 'A' && ceVal >= minCE;

                    const isFullTA = subject.maxTA === 100;
                    const taReady = subject.maxTA > 0 ? (ta !== undefined && ta !== '') : true;
                    // For full TA subjects, CE is always considered ready
                    const ceReady = isFullTA || subject.maxCE === 0 || (subject.maxCE > 0 && ce !== undefined && ce !== '');

                    let newStatus: 'Passed' | 'Failed' | 'Pending' = 'Pending';
                    if (taReady && ceReady) {
                        const finalPassedCE = isFullTA || passedCE || subject.maxCE === 0;
                        newStatus = (passedTA && finalPassedCE) ? 'Passed' : 'Failed';
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

    async updateStudentMarks(studentId: string, subjectId: string, ta: number | 'A', ce: number | 'A'): Promise<void> {
        try {
            const [studentDoc, subjectDoc] = await Promise.all([
                getDoc(doc(this.db, this.studentsCollection, studentId)),
                getDoc(doc(this.db, this.subjectsCollection, subjectId))
            ]);

            if (!studentDoc.exists()) {
                throw new Error('Student not found');
            }
            if (!subjectDoc.exists()) {
                throw new Error('Subject not found');
            }

            const student = studentDoc.data() as StudentRecord;
            const subject = subjectDoc.data() as SubjectConfig;

            const taVal = this.getMarkValue(ta);
            const ceVal = this.getMarkValue(ce);
            const total = taVal + ceVal;

            // Calculate passing requirements
            // If Max TA is 100, we ignore CE requirements (usually CE is 0 anyway)
            const isFullTA = subject.maxTA === 100;
            const minTA = Math.ceil(subject.maxTA * 0.4);
            const minCE = isFullTA ? 0 : Math.ceil(subject.maxCE * 0.5);

            const passedTA = ta !== 'A' && taVal >= minTA;
            const passedCE = isFullTA || (ce !== 'A' && ceVal >= minCE) || subject.maxCE === 0;
            const status = (passedTA && passedCE) ? 'Passed' : 'Failed';

            // Update marks
            const updatedMarks = {
                ...student.marks,
                [subjectId]: {
                    ta,
                    ce,
                    total,
                    status
                }
            };

            // Recalculate totals
            const allSubjects = await this.getAllSubjects();
            const generalSubjects = allSubjects.filter(s => s.subjectType !== 'elective');
            const electiveSubjects = allSubjects.filter(s => s.subjectType === 'elective');

            const grandTotal = Object.values(updatedMarks).reduce((sum, mark) => sum + this.getMarkValue(mark.total as any), 0);

            // Smarter average calculation: Count general subjects + 1 (if any elective marks exist)
            const generalMarksCount = generalSubjects.filter(s => updatedMarks[s.id] !== undefined).length;
            const hasElectiveMark = electiveSubjects.some(s => updatedMarks[s.id] !== undefined);
            const subjectCount = generalMarksCount + (hasElectiveMark ? 1 : 0);

            let average = subjectCount > 0 ? grandTotal / subjectCount : 0;
            if (isNaN(average)) average = 0;

            // Determine performance level
            const performanceLevel = this.calculatePerformanceLevel(average);

            // Update student document
            await updateDoc(doc(this.db, this.studentsCollection, studentId), {
                marks: updatedMarks,
                grandTotal,
                average: Math.round(average * 100) / 100,
                performanceLevel
            });

            // Recalculate class rankings
            await this.calculateClassRankings(student.className);

            this.invalidateCache();
            console.log('Student marks updated:', studentId);
        } catch (error) {
            console.error('Error updating student marks:', error);
            throw error;
        }
    }

    // New method for updating only TA marks
    async updateStudentTAMarks(studentId: string, subjectId: string, ta: number | 'A'): Promise<void> {
        try {
            const [studentDoc, subjectDoc] = await Promise.all([
                getDoc(doc(this.db, this.studentsCollection, studentId)),
                getDoc(doc(this.db, this.subjectsCollection, subjectId))
            ]);

            if (!studentDoc.exists()) {
                throw new Error('Student not found');
            }
            if (!subjectDoc.exists()) {
                throw new Error('Subject not found');
            }

            const student = studentDoc.data() as StudentRecord;
            const subject = subjectDoc.data() as SubjectConfig;

            // Get existing marks or create new entry
            const existingMarks = student.marks[subjectId] || { ta: 0, ce: 0, total: 0, status: 'Pending' };
            const ce = existingMarks.ce;
            const taVal = this.getMarkValue(ta);
            const ceVal = this.getMarkValue(ce);
            const total = taVal + ceVal;

            // Calculate passing requirements
            const minTA = Math.ceil(subject.maxTA * 0.4);
            const minCE = Math.ceil(subject.maxCE * 0.5);
            const passedTA = ta !== 'A' && taVal >= minTA;
            const passedCE = ce !== 'A' && ceVal >= minCE;

            // Status transitions from 'Pending' if all required components are entered
            let status: 'Passed' | 'Failed' | 'Pending' = 'Pending';
            const isFullTA = subject.maxTA === 100;
            const taReady = subject.maxTA > 0 ? (ta !== undefined && ta !== null) : true;
            // CE is ready if maxCE is 0, OR if we are neglecting CE (isFullTA), OR if marks are present
            const ceReady = isFullTA || subject.maxCE === 0 || (ce !== undefined && ce !== null);

            if (taReady && ceReady) {
                // If neglecting CE, only TA needs to pass
                const finalPassedCE = isFullTA || passedCE || subject.maxCE === 0;
                status = (passedTA && finalPassedCE) ? 'Passed' : 'Failed';
            }

            // Update marks
            const updatedMarks = {
                ...student.marks,
                [subjectId]: {
                    ta,
                    ce,
                    total,
                    status
                }
            };

            // Recalculate totals - Sum all available marks
            const grandTotal = Object.values(updatedMarks).reduce((sum, mark) => sum + this.getMarkValue(mark.total as any), 0);
            const average = Object.keys(updatedMarks).length > 0 ? grandTotal / Object.keys(updatedMarks).length : 0;

            // Determine performance level
            const performanceLevel = this.calculatePerformanceLevel(average);

            // Update student document
            await updateDoc(doc(this.db, this.studentsCollection, studentId), {
                marks: updatedMarks,
                grandTotal,
                average: Math.round(average * 100) / 100,
                performanceLevel
            });

            // Recalculate class rankings to keep totals up-to-date
            await this.calculateClassRankings(student.className);

            this.invalidateCache();
            console.log('Student TA marks updated:', studentId, 'TA:', ta);
        } catch (error) {
            console.error('Error updating student TA marks:', error);
            throw error;
        }
    }

    // New method for updating only CE marks
    async updateStudentCEMarks(studentId: string, subjectId: string, ce: number | 'A'): Promise<void> {
        try {
            const [studentDoc, subjectDoc] = await Promise.all([
                getDoc(doc(this.db, this.studentsCollection, studentId)),
                getDoc(doc(this.db, this.subjectsCollection, subjectId))
            ]);

            if (!studentDoc.exists()) {
                throw new Error('Student not found');
            }
            if (!subjectDoc.exists()) {
                throw new Error('Subject not found');
            }

            const student = studentDoc.data() as StudentRecord;
            const subject = subjectDoc.data() as SubjectConfig;

            // Get existing marks or create new entry
            const existingMarks = student.marks[subjectId] || { ta: 0, ce: 0, total: 0, status: 'Pending' };
            const ta = existingMarks.ta;
            const taVal = this.getMarkValue(ta);
            const ceVal = this.getMarkValue(ce);
            const total = taVal + ceVal;

            // Calculate passing requirements
            const minTA = Math.ceil(subject.maxTA * 0.4);
            const minCE = Math.ceil(subject.maxCE * 0.5);
            const passedTA = ta !== 'A' && taVal >= minTA;
            const passedCE = ce !== 'A' && ceVal >= minCE;

            // Status transitions from 'Pending' if all required components are entered
            let status: 'Passed' | 'Failed' | 'Pending' = 'Pending';
            const isFullTA = subject.maxTA === 100;
            const taReady = subject.maxTA > 0 ? (ta !== undefined && ta !== null) : true;
            // CE is ready if maxCE is 0, OR if we are neglecting CE (isFullTA), OR if marks are present
            const ceReady = isFullTA || subject.maxCE === 0 || (ce !== undefined && ce !== null);

            if (taReady && ceReady) {
                // If neglecting CE, only TA needs to pass
                const finalPassedCE = isFullTA || passedCE || subject.maxCE === 0;
                status = (passedTA && finalPassedCE) ? 'Passed' : 'Failed';
            }

            // Update marks
            const updatedMarks = {
                ...student.marks,
                [subjectId]: {
                    ta,
                    ce,
                    total,
                    status
                }
            };

            // Recalculate totals - Sum all available marks
            const grandTotal = Object.values(updatedMarks).reduce((sum, mark) => sum + this.getMarkValue(mark.total as any), 0);
            const average = Object.keys(updatedMarks).length > 0 ? grandTotal / Object.keys(updatedMarks).length : 0;

            // Determine performance level
            const performanceLevel = this.calculatePerformanceLevel(average);

            // Update student document
            await updateDoc(doc(this.db, this.studentsCollection, studentId), {
                marks: updatedMarks,
                grandTotal,
                average: Math.round(average * 100) / 100,
                performanceLevel
            });

            // Recalculate class rankings to keep totals up-to-date
            await this.calculateClassRankings(student.className);

            this.invalidateCache();
            console.log('Student CE marks updated:', studentId, 'CE:', ce);
        } catch (error) {
            console.error('Error updating student CE marks:', error);
            throw error;
        }
    }

    async clearSubjectMarks(subjectId: string, studentIds: string[]): Promise<void> {
        try {
            console.log('Clearing marks for subject:', subjectId, 'for', studentIds.length, 'students');

            // Process each student
            const updatePromises = studentIds.map(async (studentId) => {
                const studentDoc = await getDoc(doc(this.db, this.studentsCollection, studentId));
                if (!studentDoc.exists()) {
                    console.warn(`Student ${studentId} not found, skipping`);
                    return;
                }

                const student = studentDoc.data() as StudentRecord;
                const updatedMarks = { ...student.marks };

                // Remove marks for this subject
                delete updatedMarks[subjectId];

                // Recalculate totals
                const grandTotal = Object.values(updatedMarks).reduce((sum, mark) => sum + mark.total, 0);
                const average = Object.keys(updatedMarks).length > 0 ? grandTotal / Object.keys(updatedMarks).length : 0;

                // Determine performance level
                const performanceLevel = this.calculatePerformanceLevel(average);

                // Update student document
                await updateDoc(doc(this.db, this.studentsCollection, studentId), {
                    marks: updatedMarks,
                    grandTotal,
                    average: Math.round(average * 100) / 100,
                    performanceLevel
                });

                console.log('Cleared marks for student:', studentId);
            });

            await Promise.all(updatePromises);

            // Recalculate rankings for all affected classes
            const affectedClasses = new Set<string>();
            for (const studentId of studentIds) {
                const studentDoc = await getDoc(doc(this.db, this.studentsCollection, studentId));
                if (studentDoc.exists()) {
                    const student = studentDoc.data() as StudentRecord;
                    affectedClasses.add(student.className);
                }
            }

            // Recalculate rankings for each affected class
            for (const className of affectedClasses) {
                await this.calculateClassRankings(className);
            }

            this.invalidateCache();
            console.log('Subject marks cleared successfully for', studentIds.length, 'students');
        } catch (error) {
            console.error('Error clearing subject marks:', error);
            throw error;
        }
    }

    async clearStudentSubjectMarks(studentId: string, subjectId: string): Promise<void> {
        try {
            console.log('Clearing marks for student:', studentId, 'subject:', subjectId);

            const studentDoc = await getDoc(doc(this.db, this.studentsCollection, studentId));
            if (!studentDoc.exists()) {
                throw new Error('Student not found');
            }

            const student = studentDoc.data() as StudentRecord;
            const updatedMarks = { ...student.marks };

            // Remove marks for this subject
            delete updatedMarks[subjectId];

            // Recalculate totals
            const grandTotal = Object.values(updatedMarks).reduce((sum, mark) => sum + mark.total, 0);
            const average = Object.keys(updatedMarks).length > 0 ? grandTotal / Object.keys(updatedMarks).length : 0;

            // Determine performance level
            const performanceLevel = this.calculatePerformanceLevel(average);

            // Update student document
            await updateDoc(doc(this.db, this.studentsCollection, studentId), {
                marks: updatedMarks,
                grandTotal,
                average: Math.round(average * 100) / 100,
                performanceLevel
            });

            // Recalculate class rankings
            await this.calculateClassRankings(student.className);

            this.invalidateCache();
            console.log('Student subject marks cleared successfully:', studentId, subjectId);
        } catch (error) {
            console.error('Error clearing student subject marks:', error);
            throw error;
        }
    }

    async clearSubjectTAMarks(subjectId: string, studentIds: string[]): Promise<void> {
        try {
            console.log('Clearing TA marks for subject:', subjectId, 'for', studentIds.length, 'students');

            const updatePromises = studentIds.map(async (studentId) => {
                const studentDoc = await getDoc(doc(this.db, this.studentsCollection, studentId));
                if (!studentDoc.exists()) return;

                const student = studentDoc.data() as StudentRecord;
                const updatedMarks = { ...student.marks };

                if (updatedMarks[subjectId]) {
                    // Reset TA to 0 and calculate new total/status
                    const marks = updatedMarks[subjectId];
                    const ce = marks.ce || 0;
                    updatedMarks[subjectId] = {
                        ...marks,
                        ta: 0,
                        total: this.getMarkValue(ce as any),
                        status: 'Pending' // Always pending if one component is missing
                    };

                    const grandTotal = Object.values(updatedMarks).reduce((sum, m) => sum + this.getMarkValue(m.total as any), 0);
                    const average = Object.keys(updatedMarks).length > 0 ? grandTotal / Object.keys(updatedMarks).length : 0;
                    const performanceLevel = this.calculatePerformanceLevel(average);

                    await updateDoc(doc(this.db, this.studentsCollection, studentId), {
                        marks: updatedMarks,
                        grandTotal,
                        average: Math.round(average * 100) / 100,
                        performanceLevel
                    });
                }
            });

            await Promise.all(updatePromises);

            const affectedClasses = new Set<string>();
            for (const studentId of studentIds) {
                const studentDoc = await getDoc(doc(this.db, this.studentsCollection, studentId));
                if (studentDoc.exists()) {
                    affectedClasses.add((studentDoc.data() as StudentRecord).className);
                }
            }
            for (const className of affectedClasses) {
                await this.calculateClassRankings(className);
            }

            this.invalidateCache();
            console.log('Subject TA marks cleared successfully');
        } catch (error) {
            console.error('Error clearing subject TA marks:', error);
            throw error;
        }
    }

    async clearSubjectCEMarks(subjectId: string, studentIds: string[]): Promise<void> {
        try {
            console.log('Clearing CE marks for subject:', subjectId, 'for', studentIds.length, 'students');

            const updatePromises = studentIds.map(async (studentId) => {
                const studentDoc = await getDoc(doc(this.db, this.studentsCollection, studentId));
                if (!studentDoc.exists()) return;

                const student = studentDoc.data() as StudentRecord;
                const updatedMarks = { ...student.marks };

                if (updatedMarks[subjectId]) {
                    // Reset CE to 0 and calculate new total/status
                    const marks = updatedMarks[subjectId];
                    const ta = marks.ta || 0;
                    updatedMarks[subjectId] = {
                        ...marks,
                        ce: 0,
                        total: this.getMarkValue(ta as any),
                        status: 'Pending'
                    };

                    const grandTotal = Object.values(updatedMarks).reduce((sum, m) => sum + this.getMarkValue(m.total as any), 0);
                    const average = Object.keys(updatedMarks).length > 0 ? grandTotal / Object.keys(updatedMarks).length : 0;
                    const performanceLevel = this.calculatePerformanceLevel(average);

                    await updateDoc(doc(this.db, this.studentsCollection, studentId), {
                        marks: updatedMarks,
                        grandTotal,
                        average: Math.round(average * 100) / 100,
                        performanceLevel
                    });
                }
            });

            await Promise.all(updatePromises);

            const affectedClasses = new Set<string>();
            for (const studentId of studentIds) {
                const studentDoc = await getDoc(doc(this.db, this.studentsCollection, studentId));
                if (studentDoc.exists()) {
                    affectedClasses.add((studentDoc.data() as StudentRecord).className);
                }
            }
            for (const className of affectedClasses) {
                await this.calculateClassRankings(className);
            }

            this.invalidateCache();
            console.log('Subject CE marks cleared successfully');
        } catch (error) {
            console.error('Error clearing subject CE marks:', error);
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
                'Max TA': subject.maxTA,
                'Max CE': subject.maxCE,
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
                    baseRow[`${subject.name} - TA`] = marks.ta;
                    baseRow[`${subject.name} - CE`] = marks.ce;
                    baseRow[`${subject.name} - Total`] = marks.total;
                    baseRow[`${subject.name} - Status`] = marks.status;
                } else {
                    baseRow[`${subject.name} - TA`] = '';
                    baseRow[`${subject.name} - CE`] = '';
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

                    const student = studentDoc.data() as StudentRecord;
                    const updatedMarks = { ...student.marks };

                    // Process marks for each subject
                    let hasUpdates = false;
                    for (const [subjectName, subject] of subjectMap) {
                        const taKey = `${subjectName} - TA`;
                        const ceKey = `${subjectName} - CE`;
                        const statusKey = `${subjectName} - Status`;

                        const taProvided = row[taKey] !== undefined && row[taKey] !== '';
                        const ceProvided = row[ceKey] !== undefined && row[ceKey] !== '';

                        // Only proceed if all required components for this subject are provided
                        const taOk = subject.maxTA > 0 ? taProvided : true;
                        const ceOk = subject.maxCE > 0 ? ceProvided : true;

                        if (taOk && ceOk && (taProvided || ceProvided)) {
                            const ta = taProvided ? parseInt(row[taKey]) : 0;
                            const ce = ceProvided ? parseInt(row[ceKey]) : 0;

                            if (isNaN(ta) || isNaN(ce)) {
                                results.errors.push(`Row ${rowNum}: Invalid marks for ${subjectName} (TA: ${row[taKey]}, CE: ${row[ceKey]})`);
                                continue;
                            }

                            // Validate against subject limits
                            if (ta > subject.maxTA || ce > subject.maxCE) {
                                results.errors.push(`Row ${rowNum}: Marks exceed maximum for ${subjectName} (TA: ${ta}/${subject.maxTA}, CE: ${ce}/${subject.maxCE})`);
                                continue;
                            }

                            // Calculate status
                            const isFullTA = subject.maxTA === 100;
                            const minTA = Math.ceil(subject.maxTA * 0.4);
                            const minCE = isFullTA ? 0 : Math.ceil(subject.maxCE * 0.5);

                            const passedTA = ta >= minTA;
                            const passedCE = isFullTA || ce >= minCE || subject.maxCE === 0;
                            const status = (passedTA && passedCE) ? 'Passed' : 'Failed';

                            updatedMarks[subject.id] = {
                                ta,
                                ce,
                                total: ta + ce,
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
                        const performanceLevel = this.calculatePerformanceLevel(average);

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
}

// Export singleton instance
export const dataService = new DataService();