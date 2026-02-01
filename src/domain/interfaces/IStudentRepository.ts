import { Student } from '../entities/Student';
import { SubjectMarks } from '../entities/Student';

export interface IStudentRepository {
    // Basic CRUD operations
    findById(id: string): Promise<Student | null>;
    findByAdmissionNumber(adNo: string): Promise<Student | null>;
    findByClass(className: string): Promise<Student[]>;
    findAll(): Promise<Student[]>;
    save(student: Student): Promise<string>;
    update(id: string, updates: Partial<Student>): Promise<void>;
    delete(id: string): Promise<void>;

    // Marks operations
    updateStudentMarks(studentId: string, subjectId: string, marks: SubjectMarks): Promise<void>;
    clearStudentMarks(studentId: string, subjectId: string): Promise<void>;
    clearSubjectMarks(subjectId: string, studentIds: string[]): Promise<void>;

    // Bulk operations
    bulkImport(students: Omit<Student, 'id'>[]): Promise<{ success: number; errors: string[] }>;
    bulkExport(): Promise<any[]>;

    // Rankings and calculations
    calculateClassRankings(className: string): Promise<void>;

    // Real-time subscriptions
    subscribe(callback: (students: Student[]) => void): () => void;
}