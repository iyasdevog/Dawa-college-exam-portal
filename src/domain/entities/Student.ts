import { SubjectConfig } from './Subject';
export type PerformanceLevel = 'O (Outstanding)' | 'A+ (Excellent)' | 'A (Very Good)' | 'B+ (Good)' | 'B (Good)' | 'C (Average)' | 'F (Failed)';

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
        public readonly performanceLevel: PerformanceLevel = 'C (Average)'
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
            data.performanceLevel || 'C (Average)'
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

    updateMarks(subjectId: string, marks: SubjectMarks, subjects: SubjectConfig[]): Student {
        const updatedMarks = { ...this.marks, [subjectId]: marks };
        const grandTotal = Object.values(updatedMarks).reduce((sum, mark) => sum + mark.total, 0);
        const average = Object.keys(updatedMarks).length > 0 ? grandTotal / Object.keys(updatedMarks).length : 0;

        // Note: we're reusing the calculation logic from DataService style
        let minPercentage = 100;
        let hasMarks = false;
        let hasFailedSubject = false;

        for (const [sId, m] of Object.entries(updatedMarks)) {
            const subject = subjects.find(s => s.id === sId);
            if (!subject) continue;
            const totalMax = (subject.maxINT || 0) + (subject.maxEXT || 0);
            if (totalMax === 0) continue;
            hasMarks = true;
            if (m.status === 'Failed') hasFailedSubject = true;
            const percentage = (m.total / totalMax) * 100;
            if (percentage < minPercentage) minPercentage = percentage;
        }

        let performanceLevel: PerformanceLevel;
        if (hasFailedSubject || minPercentage < 40) performanceLevel = 'F (Failed)';
        else if (!hasMarks) performanceLevel = 'C (Average)';
        else if (minPercentage >= 95) performanceLevel = 'O (Outstanding)';
        else if (minPercentage >= 85) performanceLevel = 'A+ (Excellent)';
        else if (minPercentage >= 75) performanceLevel = 'A (Very Good)';
        else if (minPercentage >= 65) performanceLevel = 'B+ (Good)';
        else if (minPercentage >= 55) performanceLevel = 'B (Good)';
        else performanceLevel = 'C (Average)';

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