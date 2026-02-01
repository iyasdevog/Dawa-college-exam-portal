import { Exam, SupplementaryExam } from '../entities/Exam';
import { SubjectMarks } from '../entities/Student';

export interface IExamRepository {
    // Basic CRUD operations
    findById(id: string): Promise<Exam | null>;
    findByStudent(studentId: string): Promise<Exam[]>;
    findBySubject(subjectId: string): Promise<Exam[]>;
    save(exam: Exam): Promise<string>;
    update(id: string, updates: Partial<Exam>): Promise<void>;
    delete(id: string): Promise<void>;

    // Supplementary exam operations
    findSupplementaryByStudent(studentId: string): Promise<SupplementaryExam[]>;
    findSupplementaryBySubject(subjectId: string, year?: number): Promise<SupplementaryExam[]>;
    saveSupplementary(exam: SupplementaryExam): Promise<string>;
    updateSupplementaryMarks(examId: string, marks: SubjectMarks): Promise<void>;
    deleteSupplementary(examId: string): Promise<void>;

    // Query operations
    findStudentsWithSupplementaryExams(subjectId: string, year: number): Promise<{ studentId: string, exam: SupplementaryExam }[]>;
}