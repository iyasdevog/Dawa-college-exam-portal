export type PerformanceLevel = 'Excellent' | 'Good' | 'Average' | 'Needs Improvement' | 'Failed';

export interface SubjectMarks {
    ta: number;
    ce: number;
    total: number;
    status: 'Passed' | 'Failed';
    isSupplementary?: boolean;
    supplementaryYear?: number;
}

export class Student {
    constructor(
        public readonly id: string,
        public readonly adNo: string,
        public readonly name: string,
        public readonly className: string,
        public readonly semester: 'Odd' | 'Even',
        public readonly marks: Record<string, SubjectMarks> = {},
        public readonly supplementaryExams: string[] = [],
        public readonly grandTotal: number = 0,
        public readonly average: number = 0,
        public readonly rank: number = 0,
        public readonly performanceLevel: PerformanceLevel = 'Needs Improvement'
    ) { }

    static create(data: {
        id: string;
        adNo: string;
        name: string;
        className: string;
        semester: 'Odd' | 'Even';
        marks?: Record<string, SubjectMarks>;
        supplementaryExams?: string[];
        grandTotal?: number;
        average?: number;
        rank?: number;
        performanceLevel?: PerformanceLevel;
    }): Student {
        return new Student(
            data.id,
            data.adNo,
            data.name,
            data.className,
            data.semester,
            data.marks || {},
            data.supplementaryExams || [],
            data.grandTotal || 0,
            data.average || 0,
            data.rank || 0,
            data.performanceLevel || 'Needs Improvement'
        );
    }

    calculateGrandTotal(): number {
        return Object.values(this.marks).reduce((sum, mark) => sum + mark.total, 0);
    }

    calculateAverage(): number {
        const marksCount = Object.keys(this.marks).length;
        return marksCount > 0 ? this.grandTotal / marksCount : 0;
    }

    hasPassedAllSubjects(): boolean {
        return Object.values(this.marks).every(mark => mark.status === 'Passed');
    }

    getFailedSubjects(): string[] {
        return Object.entries(this.marks)
            .filter(([_, mark]) => mark.status === 'Failed')
            .map(([subjectId, _]) => subjectId);
    }

    updateMarks(subjectId: string, marks: SubjectMarks): Student {
        const updatedMarks = { ...this.marks, [subjectId]: marks };
        const grandTotal = Object.values(updatedMarks).reduce((sum, mark) => sum + mark.total, 0);
        const average = Object.keys(updatedMarks).length > 0 ? grandTotal / Object.keys(updatedMarks).length : 0;

        let performanceLevel: PerformanceLevel;
        if (average >= 80) performanceLevel = 'Excellent';
        else if (average >= 70) performanceLevel = 'Good';
        else if (average >= 60) performanceLevel = 'Average';
        else if (average >= 40) performanceLevel = 'Needs Improvement';
        else performanceLevel = 'Failed';

        return new Student(
            this.id,
            this.adNo,
            this.name,
            this.className,
            this.semester,
            updatedMarks,
            this.supplementaryExams,
            grandTotal,
            Math.round(average * 100) / 100,
            this.rank,
            performanceLevel
        );
    }

    updateRank(rank: number): Student {
        return new Student(
            this.id,
            this.adNo,
            this.name,
            this.className,
            this.semester,
            this.marks,
            this.supplementaryExams,
            this.grandTotal,
            this.average,
            rank,
            this.performanceLevel
        );
    }
}

// Legacy interface for backward compatibility
export interface StudentRecord {
    id: string;
    adNo: string;
    name: string;
    className: string;
    semester: 'Odd' | 'Even';
    marks: Record<string, SubjectMarks>;
    supplementaryExams?: string[];
    grandTotal: number;
    average: number;
    rank: number;
    performanceLevel: PerformanceLevel;
}