export class Subject {
    constructor(
        public readonly id: string,
        public readonly name: string,
        public readonly arabicName: string | undefined,
        public readonly maxTA: number,
        public readonly maxCE: number,
        public readonly passingTotal: number,
        public readonly facultyName: string | undefined,
        public readonly targetClasses: string[],
        public readonly subjectType: 'general' | 'elective',
        public readonly enrolledStudents: string[] = []
    ) { }

    static create(data: {
        id: string;
        name: string;
        arabicName?: string;
        maxTA: number;
        maxCE: number;
        passingTotal: number;
        facultyName?: string;
        targetClasses: string[];
        subjectType: 'general' | 'elective';
        enrolledStudents?: string[];
    }): Subject {
        return new Subject(
            data.id,
            data.name,
            data.arabicName,
            data.maxTA,
            data.maxCE,
            data.passingTotal,
            data.facultyName,
            data.targetClasses,
            data.subjectType,
            data.enrolledStudents || []
        );
    }

    getMaxTotal(): number {
        return this.maxTA + this.maxCE;
    }

    getMinimumTARequired(): number {
        return Math.ceil(this.maxTA * 0.4);
    }

    getMinimumCERequired(): number {
        return Math.ceil(this.maxCE * 0.5);
    }

    isPassingScore(ta: number, ce: number): boolean {
        return ta >= this.getMinimumTARequired() && ce >= this.getMinimumCERequired();
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
            this.maxTA,
            this.maxCE,
            this.passingTotal,
            this.facultyName,
            this.targetClasses,
            this.subjectType,
            [...this.enrolledStudents, studentId]
        );
    }

    unenrollStudent(studentId: string): Subject {
        return new Subject(
            this.id,
            this.name,
            this.arabicName,
            this.maxTA,
            this.maxCE,
            this.passingTotal,
            this.facultyName,
            this.targetClasses,
            this.subjectType,
            this.enrolledStudents.filter(id => id !== studentId)
        );
    }
}

// Legacy interface for backward compatibility
export interface SubjectConfig {
    id: string;
    name: string;
    arabicName?: string;
    maxTA: number;
    maxCE: number;
    passingTotal: number;
    facultyName?: string;
    targetClasses: string[];
    subjectType: 'general' | 'elective';
    enrolledStudents?: string[];
}