export class Subject {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly arabicName: string | undefined,
        public readonly maxINT: number,
        public readonly maxEXT: number,
        public readonly passingTotal: number,
        public readonly facultyName: string | undefined,
        public readonly targetClasses: string[],
        public readonly subjectType: 'general' | 'elective',
        public readonly enrolledStudents: string[] = [],
        public readonly details?: any // Using any to avoid importing all interfaces, or we can use SubjectDetails from types if imported
    ) { }

    static create(data: {
        id: string;
        name: string;
        arabicName?: string;
        maxINT: number;
        maxEXT: number;
        passingTotal: number;
        facultyName?: string;
        targetClasses: string[];
        subjectType: 'general' | 'elective';
        enrolledStudents?: string[];
        details?: any;
    }): Subject {
        return new Subject(
            data.id,
            data.name,
            data.arabicName,
            data.maxINT,
            data.maxEXT,
            data.passingTotal,
            data.facultyName,
            data.targetClasses,
            data.subjectType,
            data.enrolledStudents || [],
            data.details
        );
    }

    getMaxTotal(): number {
        return this.maxINT + this.maxEXT;
    }

    getMinimumINTRequired(): number {
        return Math.ceil(this.maxINT * 0.5);
    }

    getMinimumEXTRequired(): number {
        return Math.ceil(this.maxEXT * 0.4);
    }

    isPassingScore(int: number, ext: number): boolean {
        return int >= this.getMinimumINTRequired() && ext >= this.getMinimumEXTRequired();
    }

    isApplicableToClass(className: string): boolean {
        return this.targetClasses.includes(className);
    }

    isStudentEnrolled(studentId: string): boolean {
        return this.subjectType === 'general' || this.enrolledStudents.includes(studentId);
    }

    enrollStudent(studentId: string): Subject {
        if (this.subjectType === 'general') {
            throw new Error('Cannot enroll students in general subjects');
        }

        if (this.enrolledStudents.includes(studentId)) {
            return this;
        }

        return new Subject(
            this.id,
            this.name,
            this.arabicName,
            this.maxINT,
            this.maxEXT,
            this.passingTotal,
            this.facultyName,
            this.targetClasses,
            this.subjectType,
            [...this.enrolledStudents, studentId],
            this.details
        );
    }

    unenrollStudent(studentId: string): Subject {
        return new Subject(
            this.id,
            this.name,
            this.arabicName,
            this.maxINT,
            this.maxEXT,
            this.passingTotal,
            this.facultyName,
            this.targetClasses,
            this.subjectType,
            this.enrolledStudents.filter(id => id !== studentId),
            this.details
        );
    }
}

// Legacy interface for backward compatibility
export interface SubjectConfig {
    id: string;
    name: string;
    arabicName?: string;
    maxINT: number;
    maxEXT: number;
    passingTotal: number;
    facultyName?: string;
    targetClasses: string[];
    subjectType: 'general' | 'elective';
    enrolledStudents?: string[];
    details?: any;
}