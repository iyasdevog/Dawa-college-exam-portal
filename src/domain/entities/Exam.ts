import { SubjectMarks } from './Student';

export class Exam {
    constructor(
        public readonly id: string,
        public readonly studentId: string,
        public readonly subjectId: string,
        public readonly semester: 'Odd' | 'Even',
        public readonly year: number,
        public readonly marks: SubjectMarks | undefined,
        public readonly isSupplementary: boolean = false,
        public readonly originalExamId?: string
    ) { }

    static create(data: {
        id: string;
        studentId: string;
        subjectId: string;
        semester: 'Odd' | 'Even';
        year: number;
        marks?: SubjectMarks;
        isSupplementary?: boolean;
        originalExamId?: string;
    }): Exam {
        return new Exam(
            data.id,
            data.studentId,
            data.subjectId,
            data.semester,
            data.year,
            data.marks,
            data.isSupplementary || false,
            data.originalExamId
        );
    }

    hasMarks(): boolean {
        return this.marks !== undefined;
    }

    isPassed(): boolean {
        return this.marks?.status === 'Passed';
    }

    isFailed(): boolean {
        return this.marks?.status === 'Failed';
    }

    updateMarks(marks: SubjectMarks): Exam {
        return new Exam(
            this.id,
            this.studentId,
            this.subjectId,
            this.semester,
            this.year,
            marks,
            this.isSupplementary,
            this.originalExamId
        );
    }
}

export class SupplementaryExam extends Exam {
    constructor(
        id: string,
        studentId: string,
        subjectId: string,
        public readonly originalSemester: 'Odd' | 'Even',
        public readonly originalYear: number,
        public readonly supplementaryYear: number,
        public readonly status: 'Pending' | 'Completed',
        marks?: SubjectMarks
    ) {
        super(id, studentId, subjectId, originalSemester, supplementaryYear, marks, true);
    }

    static create(data: {
        id: string;
        studentId: string;
        subjectId: string;
        semester: 'Odd' | 'Even';
        year: number;
        marks?: SubjectMarks;
        isSupplementary?: boolean;
        originalExamId?: string;
        // Additional properties for SupplementaryExam
        originalSemester?: 'Odd' | 'Even';
        originalYear?: number;
        supplementaryYear?: number;
        status?: 'Pending' | 'Completed';
    }): SupplementaryExam {
        return new SupplementaryExam(
            data.id,
            data.studentId,
            data.subjectId,
            data.originalSemester || data.semester,
            data.originalYear || data.year,
            data.supplementaryYear || data.year,
            data.status || 'Pending',
            data.marks
        );
    }

    complete(marks: SubjectMarks): SupplementaryExam {
        return new SupplementaryExam(
            this.id,
            this.studentId,
            this.subjectId,
            this.originalSemester,
            this.originalYear,
            this.supplementaryYear,
            'Completed',
            marks
        );
    }

    isCompleted(): boolean {
        return this.status === 'Completed';
    }
}

// Legacy interface for backward compatibility
export interface SupplementaryExamRecord {
    id: string;
    studentId: string;
    subjectId: string;
    originalSemester: 'Odd' | 'Even';
    originalYear: number;
    supplementaryYear: number;
    status: 'Pending' | 'Completed';
    marks?: SubjectMarks;
}