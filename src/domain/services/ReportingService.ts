import { Student } from '../entities/Student';
import { Subject } from '../entities/Subject';
import { GradingService } from './GradingService';

export interface ClassReport {
    className: string;
    semester: 'Odd' | 'Even';
    totalStudents: number;
    statistics: {
        passedStudents: number;
        failedStudents: number;
        averageScore: number;
        highestScore: number;
        lowestScore: number;
        performanceLevels: Record<string, number>;
    };
    subjectWiseStatistics: Array<{
        subjectId: string;
        subjectName: string;
        totalStudents: number;
        passedStudents: number;
        failedStudents: number;
        averageScore: number;
        highestScore: number;
        lowestScore: number;
    }>;
    topPerformers: Array<{
        rank: number;
        studentName: string;
        adNo: string;
        grandTotal: number;
        average: number;
    }>;
}

export interface StudentScorecard {
    studentInfo: {
        name: string;
        adNo: string;
        className: string;
        semester: string;
    };
    academicPerformance: {
        grandTotal: number;
        average: number;
        rank: number;
        performanceLevel: string;
    };
    subjectMarks: Array<{
        subjectName: string;
        arabicName?: string;
        ta: number;
        ce: number;
        total: number;
        maxTotal: number;
        percentage: number;
        status: string;
        grade: string;
    }>;
    promotionStatus: {
        eligible: boolean;
        failedSubjects: string[];
        remarks: string;
    };
}

export class ReportingService {
    constructor(private gradingService: GradingService) { }

    generateClassReport(
        className: string,
        students: Student[],
        subjects: Subject[]
    ): ClassReport {
        const classStudents = students.filter(s => s.className === className);
        const classSubjects = subjects.filter(s => s.isApplicableToClass(className));

        if (classStudents.length === 0) {
            throw new Error(`No students found for class ${className}`);
        }

        const semester = classStudents[0].semester;
        const statistics = this.gradingService.calculateClassStatistics(classStudents);

        // Calculate subject-wise statistics
        const subjectWiseStatistics = classSubjects.map(subject => {
            const studentsWithMarks = classStudents.filter(s => s.marks[subject.id]);
            const marks = studentsWithMarks.map(s => s.marks[subject.id]);
            const passedCount = marks.filter(m => m.status === 'Passed').length;
            const scores = marks.map(m => m.total);
            const averageScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;

            return {
                subjectId: subject.id,
                subjectName: subject.name,
                totalStudents: studentsWithMarks.length,
                passedStudents: passedCount,
                failedStudents: marks.length - passedCount,
                averageScore: Math.round(averageScore * 100) / 100,
                highestScore: scores.length > 0 ? Math.max(...scores) : 0,
                lowestScore: scores.length > 0 ? Math.min(...scores) : 0
            };
        });

        // Get top performers (top 10 or all if less than 10)
        const rankedStudents = this.gradingService.calculateClassRankings(classStudents);
        const topPerformers = rankedStudents
            .filter(s => s.grandTotal > 0)
            .slice(0, 10)
            .map(student => ({
                rank: student.rank,
                studentName: student.name,
                adNo: student.adNo,
                grandTotal: student.grandTotal,
                average: student.average
            }));

        return {
            className,
            semester,
            totalStudents: classStudents.length,
            statistics,
            subjectWiseStatistics,
            topPerformers
        };
    }

    generateStudentScorecard(
        student: Student,
        subjects: Subject[]
    ): StudentScorecard {
        const applicableSubjects = subjects.filter(s => s.isApplicableToClass(student.className));
        const eligibilityInfo = this.gradingService.isStudentEligibleForPromotion(student, applicableSubjects);

        const subjectMarks = applicableSubjects.map(subject => {
            const marks = student.marks[subject.id];
            const maxTotal = subject.getMaxTotal();
            const percentage = marks ? Math.round((marks.total / maxTotal) * 100) : 0;

            // Calculate grade based on percentage
            let grade = 'F';
            if (percentage >= 90) grade = 'A+';
            else if (percentage >= 80) grade = 'A';
            else if (percentage >= 70) grade = 'B+';
            else if (percentage >= 60) grade = 'B';
            else if (percentage >= 50) grade = 'C+';
            else if (percentage >= 40) grade = 'C';
            else if (percentage >= 35) grade = 'D';

            return {
                subjectName: subject.name,
                arabicName: subject.arabicName,
                ta: marks?.ta || 0,
                ce: marks?.ce || 0,
                total: marks?.total || 0,
                maxTotal,
                percentage,
                status: marks?.status || 'Pending',
                grade
            };
        });

        // Generate remarks
        let remarks = '';
        if (eligibilityInfo.eligible) {
            remarks = 'Eligible for promotion to next level';
        } else if (eligibilityInfo.supplementaryRequired.length > 0) {
            remarks = `Supplementary examination required in ${eligibilityInfo.supplementaryRequired.length} subject(s)`;
        } else {
            remarks = 'Not eligible for promotion';
        }

        return {
            studentInfo: {
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
            subjectMarks,
            promotionStatus: {
                eligible: eligibilityInfo.eligible,
                failedSubjects: eligibilityInfo.failedSubjects,
                remarks
            }
        };
    }

    generateOverallStatistics(students: Student[], subjects: Subject[]): {
        totalStudents: number;
        totalSubjects: number;
        classWiseStatistics: Array<{
            className: string;
            totalStudents: number;
            passedStudents: number;
            averageScore: number;
        }>;
        subjectWiseStatistics: Array<{
            subjectName: string;
            totalEnrolled: number;
            passedStudents: number;
            averageScore: number;
        }>;
        performanceTrends: {
            excellent: number;
            good: number;
            average: number;
            needsImprovement: number;
            failed: number;
        };
    } {
        const classes = [...new Set(students.map(s => s.className))];

        const classWiseStatistics = classes.map(className => {
            const classStudents = students.filter(s => s.className === className);
            const studentsWithMarks = classStudents.filter(s => s.grandTotal > 0);
            const passedStudents = studentsWithMarks.filter(s => s.hasPassedAllSubjects()).length;
            const averageScore = studentsWithMarks.length > 0
                ? studentsWithMarks.reduce((sum, s) => sum + s.average, 0) / studentsWithMarks.length
                : 0;

            return {
                className,
                totalStudents: classStudents.length,
                passedStudents,
                averageScore: Math.round(averageScore * 100) / 100
            };
        });

        const subjectWiseStatistics = subjects.map(subject => {
            const enrolledStudents = students.filter(s =>
                subject.isApplicableToClass(s.className) && s.marks[subject.id]
            );
            const passedStudents = enrolledStudents.filter(s =>
                s.marks[subject.id]?.status === 'Passed'
            ).length;
            const averageScore = enrolledStudents.length > 0
                ? enrolledStudents.reduce((sum, s) => sum + s.marks[subject.id].total, 0) / enrolledStudents.length
                : 0;

            return {
                subjectName: subject.name,
                totalEnrolled: enrolledStudents.length,
                passedStudents,
                averageScore: Math.round(averageScore * 100) / 100
            };
        });

        const performanceTrends = {
            excellent: students.filter(s => s.performanceLevel === 'Excellent').length,
            good: students.filter(s => s.performanceLevel === 'Good').length,
            average: students.filter(s => s.performanceLevel === 'Average').length,
            needsImprovement: students.filter(s => s.performanceLevel === 'Needs Improvement').length,
            failed: students.filter(s => s.performanceLevel === 'Failed').length
        };

        return {
            totalStudents: students.length,
            totalSubjects: subjects.length,
            classWiseStatistics,
            subjectWiseStatistics,
            performanceTrends
        };
    }

    exportToCSV(data: any[], filename: string): string {
        if (data.length === 0) return '';

        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row =>
                headers.map(header => {
                    const value = row[header];
                    // Escape commas and quotes in CSV
                    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');

        return csvContent;
    }

    exportToJSON(data: any, filename: string): string {
        return JSON.stringify(data, null, 2);
    }
}