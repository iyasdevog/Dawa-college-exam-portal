import { Subject } from '../entities/Subject';

export interface ISubjectRepository {
    // Basic CRUD operations
    findById(id: string): Promise<Subject | null>;
    findByClass(className: string): Promise<Subject[]>;
    findAll(): Promise<Subject[]>;
    save(subject: Subject): Promise<string>;
    update(id: string, updates: Partial<Subject>): Promise<void>;
    delete(id: string): Promise<void>;

    // Enrollment operations
    enrollStudent(subjectId: string, studentId: string): Promise<void>;
    unenrollStudent(subjectId: string, studentId: string): Promise<void>;
    getEnrolledStudents(subjectId: string): Promise<string[]>;

    // Real-time subscriptions
    subscribe(callback: (subjects: Subject[]) => void): () => void;
}