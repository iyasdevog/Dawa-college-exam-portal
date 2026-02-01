import { Student, PerformanceLevel, SubjectMarks } from '../entities/Student';
import { Subject } from '../entities/Subject';

export class GradingService {
    calculatePerformanceLevel(average: number): PerformanceLevel {
        if (average >= 80) return 'Excellent';
        if (average >= 70) return 'Good';
        if (average >= 60) return 'Average';
        if (average >= 40) return 'Needs Improvement';
        return 'Failed';
    }

    calculateSubjectMarks(ta: number, ce: number, subject: Subject): SubjectMarks {
        const total = ta + ce;
        const status = subject.isPassingScore(ta, ce) ? 'Passed' : 'Failed';

        return {
            ta,
            ce,
            total,
            status
        };
    }

    calculateStudentGrandTotal(marks: Record<string, SubjectMarks>): number {
        return Object.values(marks).reduce((sum, mark) => sum + mark.total, 0);
    }

    calculateStudentAverage(marks: Record<string, SubjectMarks>): number {
        const marksCount = Object.keys(marks).length;
        if (marksCount === 0) return 0;

        const grandTotal = this.calculateStudentGrandTotal(marks);
        return Math.round((grandTotal / marksCount) * 100) / 100;
    }

    calculateClassRankings(students: Student[]): Student[] {
        // Sort by grand total (descending), then by average (descending)
        const sortedStudents = [...students].sort((a, b) => {
            if (b.grandTotal !== a.grandTotal) {
                return b.grandTotal - a.grandTotal;
            }
            return b.average - a.average;
        });

        // Assign ranks, handling ties
        let currentRank = 1;
        const rankedStudents: Student[] = [];

        for (let i = 0; i < sortedStudents.length; i++) {
            const student = sortedStudents[i];

            // Check if this student has the same score as the previous one
            if (i > 0) {
                const prevStudent = sortedStudents[i - 1];
                if (student.grandTotal !== prevStudent.grandTotal || student.average !== prevStudent.average) {
                    currentRank = i + 1;
                }
            }

            rankedStudents.push(student.updateRank(currentRank));
        }

        return rankedStudents;
    }

    getPassingGrade(subject: Subject): { minTA: number; minCE: number; minTotal: number } {
        return {
            minTA: subject.getMinimumTARequired(),
            minCE: subject.getMinimumCERequired(),
            minTotal: subject.passingTotal
        };
    }

    isStudentEligibleForPromotion(student: Student, subjects: Subject[]): {
        eligible: boolean;
        failedSubjects: string[];
        supplementaryRequired: string[];
    } {
        const failedSubjects: string[] = [];
        const supplementaryRequired: string[] = [];

        // Check each subject the student is enrolled in
        subjects.forEach(subject => {
            if (subject.isApplicableToClass(student.className)) {
                const marks = student.marks[subject.id];

                if (!marks) {
                    // No marks recorded - needs to take exam
                    supplementaryRequired.push(subject.id);
                } else if (marks.status === 'Failed') {
                    failedSubjects.push(subject.id);
                    supplementaryRequired.push(subject.id);
                }
            }
        });

        return {
            eligible: failedSubjects.length === 0 && supplementaryRequired.length === 0,
            failedSubjects,
            supplementaryRequired
        };
    }

    calculateClassStatistics(students: Student[]): {
        totalStudents: number;
        passedStudents: number;
        failedStudents: number;
        averageScore: number;
        highestScore: number;
        lowestScore: number;
        performanceLevels: Record<PerformanceLevel, number>;
    } {
        if (students.length === 0) {
            return {
                totalStudents: 0,
                passedStudents: 0,
                failedStudents: 0,
                averageScore: 0,
                highestScore: 0,
                lowestScore: 0,
                performanceLevels: {
                    'Excellent': 0,
                    'Good': 0,
                    'Average': 0,
                    'Needs Improvement': 0,
                    'Failed': 0
                }
            };
        }

        const studentsWithMarks = students.filter(s => s.grandTotal > 0);
        const passedStudents = studentsWithMarks.filter(s => s.hasPassedAllSubjects()).length;
        const scores = studentsWithMarks.map(s => s.average);
        const averageScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;

        const performanceLevels: Record<PerformanceLevel, number> = {
            'Excellent': 0,
            'Good': 0,
            'Average': 0,
            'Needs Improvement': 0,
            'Failed': 0
        };

        students.forEach(student => {
            performanceLevels[student.performanceLevel]++;
        });

        return {
            totalStudents: students.length,
            passedStudents,
            failedStudents: studentsWithMarks.length - passedStudents,
            averageScore: Math.round(averageScore * 100) / 100,
            highestScore: scores.length > 0 ? Math.max(...scores) : 0,
            lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
            performanceLevels
        };
    }

    generateGradeReport(student: Student, subjects: Subject[]): {
        studentInfo: {
            id: string;
            name: string;
            adNo: string;
            className: string;
            semester: string;
        };
        academicPerformance: {
            grandTotal: number;
            average: number;
            rank: number;
            performanceLevel: PerformanceLevel;
        };
        subjectWiseMarks: Array<{
            subjectId: string;
            subjectName: string;
            ta: number;
            ce: number;
            total: number;
            status: string;
            maxMarks: number;
            percentage: number;
        }>;
        promotionStatus: {
            eligible: boolean;
            failedSubjects: string[];
            supplementaryRequired: string[];
        };
    } {
        const eligibilityInfo = this.isStudentEligibleForPromotion(student, subjects);

        const subjectWiseMarks = subjects
            .filter(subject => subject.isApplicableToClass(student.className))
            .map(subject => {
                const marks = student.marks[subject.id];
                const maxMarks = subject.getMaxTotal();

                return {
                    subjectId: subject.id,
                    subjectName: subject.name,
                    ta: marks?.ta || 0,
                    ce: marks?.ce || 0,
                    total: marks?.total || 0,
                    status: marks?.status || 'Pending',
                    maxMarks,
                    percentage: marks ? Math.round((marks.total / maxMarks) * 100) : 0
                };
            });

        return {
            studentInfo: {
                id: student.id,
                name: student.name,
                adNo: student.adNo,
                className: student.className,
                semester: student.semester
            },
            academicPerformance: {
                grandTotal: student.grandTotal,
                average: student.average,
                rank: student.rank,
                performanceLevel: student.performanceLevel
            },
            subjectWiseMarks,
            promotionStatus: eligibilityInfo
        };
    }
}