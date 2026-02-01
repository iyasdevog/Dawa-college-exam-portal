import { ReportingService } from '../../src/domain/services/ReportingService';
import { GradingService } from '../../src/domain/services/GradingService';
import { Student, SubjectMarks } from '../../src/domain/entities/Student';
import { Subject } from '../../src/domain/entities/Subject';

describe('Reporting Workflow Integration Tests', () => {
    let reportingService: ReportingService;
    let gradingService: GradingService;

    beforeEach(() => {
        gradingService = new GradingService();
        reportingService = new ReportingService(gradingService);
    });

    describe('Class Report Generation', () => {
        let students: Student[];
        let subjects: Subject[];

        beforeEach(() => {
            students = [
                Student.create({
                    id: '1',
                    adNo: 'AD001',
                    name: 'Alice Johnson',
                    className: 'S1',
                    semester: 'Odd',
                    marks: {
                        'math': { ta: 45, ce: 40, total: 85, status: 'Passed' },
                        'english': { ta: 40, ce: 35, total: 75, status: 'Passed' },
                        'science': { ta: 35, ce: 30, total: 65, status: 'Passed' }
                    },
                    grandTotal: 225,
                    average: 75,
                    rank: 1,
                    performanceLevel: 'Good'
                }),
                Student.create({
                    id: '2',
                    adNo: 'AD002',
                    name: 'Bob Smith',
                    className: 'S1',
                    semester: 'Odd',
                    marks: {
                        'math': { ta: 25, ce: 20, total: 45, status: 'Passed' },
                        'english': { ta: 20, ce: 15, total: 35, status: 'Failed' },
                        'science': { ta: 30, ce: 25, total: 55, status: 'Passed' }
                    },
                    grandTotal: 135,
                    average: 45,
                    rank: 3,
                    performanceLevel: 'Needs Improvement'
                }),
                Student.create({
                    id: '3',
                    adNo: 'AD003',
                    name: 'Charlie Brown',
                    className: 'S1',
                    semester: 'Odd',
                    marks: {
                        'math': { ta: 35, ce: 30, total: 65, status: 'Passed' },
                        'english': { ta: 30, ce: 25, total: 55, status: 'Passed' },
                        'science': { ta: 40, ce: 35, total: 75, status: 'Passed' }
                    },
                    grandTotal: 195,
                    average: 65,
                    rank: 2,
                    performanceLevel: 'Average'
                }),
                Student.create({
                    id: '4',
                    adNo: 'AD004',
                    name: 'David Wilson',
                    className: 'S2', // Different class
                    semester: 'Odd',
                    marks: {
                        'math': { ta: 40, ce: 35, total: 75, status: 'Passed' }
                    },
                    grandTotal: 75,
                    average: 75,
                    rank: 1,
                    performanceLevel: 'Good'
                })
            ];

            subjects = [
                {
                    id: 'math',
                    name: 'Mathematics',
                    arabicName: 'الرياضيات',
                    isApplicableToClass: (className: string) => ['S1', 'S2'].includes(className),
                    getMaxTotal: () => 100
                } as Subject,
                {
                    id: 'english',
                    name: 'English Language',
                    arabicName: 'اللغة الإنجليزية',
                    isApplicableToClass: (className: string) => className === 'S1',
                    getMaxTotal: () => 100
                } as Subject,
                {
                    id: 'science',
                    name: 'General Science',
                    arabicName: 'العلوم العامة',
                    isApplicableToClass: (className: string) => className === 'S1',
                    getMaxTotal: () => 100
                } as Subject
            ];
        });

        it('should generate comprehensive class report', () => {
            const report = reportingService.generateClassReport('S1', students, subjects);

            // Basic class information
            expect(report.className).toBe('S1');
            expect(report.semester).toBe('Odd');
            expect(report.totalStudents).toBe(3); // Only S1 students

            // Class statistics
            expect(report.statistics.passedStudents).toBe(2); // Alice and Charlie passed all
            expect(report.statistics.failedStudents).toBe(1); // Bob failed English
            expect(report.statistics.averageScore).toBeCloseTo(61.67, 1); // (75 + 45 + 65) / 3
            expect(report.statistics.highestScore).toBe(75);
            expect(report.statistics.lowestScore).toBe(45);

            // Performance levels
            expect(report.statistics.performanceLevels.Good).toBe(1);
            expect(report.statistics.performanceLevels.Average).toBe(1);
            expect(report.statistics.performanceLevels['Needs Improvement']).toBe(1);

            // Subject-wise statistics
            expect(report.subjectWiseStatistics).toHaveLength(3);

            const mathStats = report.subjectWiseStatistics.find(s => s.subjectId === 'math');
            expect(mathStats?.totalStudents).toBe(3);
            expect(mathStats?.passedStudents).toBe(3);
            expect(mathStats?.failedStudents).toBe(0);
            expect(mathStats?.averageScore).toBeCloseTo(65, 1); // (85 + 45 + 65) / 3

            const englishStats = report.subjectWiseStatistics.find(s => s.subjectId === 'english');
            expect(englishStats?.totalStudents).toBe(3);
            expect(englishStats?.passedStudents).toBe(2);
            expect(englishStats?.failedStudents).toBe(1);

            // Top performers
            expect(report.topPerformers).toHaveLength(3);
            expect(report.topPerformers[0].rank).toBe(1);
            expect(report.topPerformers[0].studentName).toBe('Alice Johnson');
            expect(report.topPerformers[0].grandTotal).toBe(225);
        });

        it('should handle empty class gracefully', () => {
            expect(() => {
                reportingService.generateClassReport('NonExistent', students, subjects);
            }).toThrow('No students found for class NonExistent');
        });

        it('should filter students by class correctly', () => {
            const report = reportingService.generateClassReport('S2', students, subjects);

            expect(report.totalStudents).toBe(1);
            expect(report.topPerformers).toHaveLength(1);
            expect(report.topPerformers[0].studentName).toBe('David Wilson');
        });
    });

    describe('Student Scorecard Generation', () => {
        let student: Student;
        let subjects: Subject[];

        beforeEach(() => {
            student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'Alice Johnson',
                className: 'S1',
                semester: 'Odd',
                marks: {
                    'math': { ta: 45, ce: 40, total: 85, status: 'Passed' },
                    'english': { ta: 40, ce: 35, total: 75, status: 'Passed' },
                    'science': { ta: 20, ce: 15, total: 35, status: 'Failed' }
                },
                grandTotal: 195,
                average: 65,
                rank: 2,
                performanceLevel: 'Average'
            });

            subjects = [
                {
                    id: 'math',
                    name: 'Mathematics',
                    arabicName: 'الرياضيات',
                    isApplicableToClass: () => true,
                    getMaxTotal: () => 100
                } as Subject,
                {
                    id: 'english',
                    name: 'English Language',
                    arabicName: 'اللغة الإنجليزية',
                    isApplicableToClass: () => true,
                    getMaxTotal: () => 100
                } as Subject,
                {
                    id: 'science',
                    name: 'General Science',
                    arabicName: 'العلوم العامة',
                    isApplicableToClass: () => true,
                    getMaxTotal: () => 100
                } as Subject
            ];
        });

        it('should generate complete student scorecard', () => {
            const scorecard = reportingService.generateStudentScorecard(student, subjects);

            // Student information
            expect(scorecard.studentInfo.name).toBe('Alice Johnson');
            expect(scorecard.studentInfo.adNo).toBe('AD001');
            expect(scorecard.studentInfo.className).toBe('S1');
            expect(scorecard.studentInfo.semester).toBe('Odd');

            // Academic performance
            expect(scorecard.academicPerformance.grandTotal).toBe(195);
            expect(scorecard.academicPerformance.average).toBe(65);
            expect(scorecard.academicPerformance.rank).toBe(2);
            expect(scorecard.academicPerformance.performanceLevel).toBe('Average');

            // Subject marks
            expect(scorecard.subjectMarks).toHaveLength(3);

            const mathMark = scorecard.subjectMarks.find(m => m.subjectName === 'Mathematics');
            expect(mathMark?.ta).toBe(45);
            expect(mathMark?.ce).toBe(40);
            expect(mathMark?.total).toBe(85);
            expect(mathMark?.maxTotal).toBe(100);
            expect(mathMark?.percentage).toBe(85);
            expect(mathMark?.status).toBe('Passed');
            expect(mathMark?.grade).toBe('A');
            expect(mathMark?.arabicName).toBe('الرياضيات');

            const scienceMark = scorecard.subjectMarks.find(m => m.subjectName === 'General Science');
            expect(scienceMark?.status).toBe('Failed');
            expect(scienceMark?.grade).toBe('D'); // 35% should be D grade
            expect(scienceMark?.percentage).toBe(35);

            // Promotion status
            expect(scorecard.promotionStatus.eligible).toBe(false);
            expect(scorecard.promotionStatus.failedSubjects).toContain('science');
            expect(scorecard.promotionStatus.remarks).toContain('Supplementary examination required');
        });

        it('should calculate grades correctly', () => {
            const testCases = [
                { percentage: 95, expectedGrade: 'A+' },
                { percentage: 85, expectedGrade: 'A' },
                { percentage: 75, expectedGrade: 'B+' },
                { percentage: 65, expectedGrade: 'B' },
                { percentage: 55, expectedGrade: 'C+' },
                { percentage: 45, expectedGrade: 'C' },
                { percentage: 37, expectedGrade: 'D' },
                { percentage: 30, expectedGrade: 'F' }
            ];

            testCases.forEach(({ percentage, expectedGrade }) => {
                const testStudent = Student.create({
                    id: '1',
                    adNo: 'AD001',
                    name: 'Test Student',
                    className: 'S1',
                    semester: 'Odd',
                    marks: {
                        'math': { ta: Math.floor(percentage / 2), ce: Math.ceil(percentage / 2), total: percentage, status: 'Passed' }
                    }
                });

                const scorecard = reportingService.generateStudentScorecard(testStudent, subjects.slice(0, 1));
                expect(scorecard.subjectMarks[0].grade).toBe(expectedGrade);
            });
        });

        it('should handle student with no marks', () => {
            const studentWithoutMarks = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'New Student',
                className: 'S1',
                semester: 'Odd'
            });

            const scorecard = reportingService.generateStudentScorecard(studentWithoutMarks, subjects);

            expect(scorecard.subjectMarks[0].ta).toBe(0);
            expect(scorecard.subjectMarks[0].ce).toBe(0);
            expect(scorecard.subjectMarks[0].total).toBe(0);
            expect(scorecard.subjectMarks[0].status).toBe('Pending');
            expect(scorecard.subjectMarks[0].grade).toBe('F');
            expect(scorecard.subjectMarks[0].percentage).toBe(0);

            expect(scorecard.promotionStatus.eligible).toBe(false);
            expect(scorecard.promotionStatus.remarks).toContain('Supplementary examination required');
        });
    });

    describe('Overall Statistics Generation', () => {
        let students: Student[];
        let subjects: Subject[];

        beforeEach(() => {
            students = [
                Student.create({
                    id: '1',
                    adNo: 'AD001',
                    name: 'Alice',
                    className: 'S1',
                    semester: 'Odd',
                    marks: {
                        'math': { ta: 45, ce: 40, total: 85, status: 'Passed' },
                        'english': { ta: 40, ce: 35, total: 75, status: 'Passed' }
                    },
                    grandTotal: 160,
                    average: 80,
                    performanceLevel: 'Excellent'
                }),
                Student.create({
                    id: '2',
                    adNo: 'AD002',
                    name: 'Bob',
                    className: 'S1',
                    semester: 'Odd',
                    marks: {
                        'math': { ta: 25, ce: 20, total: 45, status: 'Passed' },
                        'english': { ta: 20, ce: 15, total: 35, status: 'Failed' }
                    },
                    grandTotal: 80,
                    average: 40,
                    performanceLevel: 'Needs Improvement'
                }),
                Student.create({
                    id: '3',
                    adNo: 'AD003',
                    name: 'Charlie',
                    className: 'S2',
                    semester: 'Even',
                    marks: {
                        'math': { ta: 35, ce: 30, total: 65, status: 'Passed' }
                    },
                    grandTotal: 65,
                    average: 65,
                    performanceLevel: 'Average'
                })
            ];

            subjects = [
                {
                    id: 'math',
                    name: 'Mathematics',
                    isApplicableToClass: () => true
                } as Subject,
                {
                    id: 'english',
                    name: 'English Language',
                    isApplicableToClass: (className: string) => className === 'S1'
                } as Subject
            ];
        });

        it('should generate comprehensive overall statistics', () => {
            const stats = reportingService.generateOverallStatistics(students, subjects);

            expect(stats.totalStudents).toBe(3);
            expect(stats.totalSubjects).toBe(2);

            // Class-wise statistics
            expect(stats.classWiseStatistics).toHaveLength(2);

            const s1Stats = stats.classWiseStatistics.find(c => c.className === 'S1');
            expect(s1Stats?.totalStudents).toBe(2);
            expect(s1Stats?.passedStudents).toBe(1); // Only Alice passed all subjects
            expect(s1Stats?.averageScore).toBe(60); // (80 + 40) / 2

            const s2Stats = stats.classWiseStatistics.find(c => c.className === 'S2');
            expect(s2Stats?.totalStudents).toBe(1);
            expect(s2Stats?.passedStudents).toBe(1);
            expect(s2Stats?.averageScore).toBe(65);

            // Subject-wise statistics
            expect(stats.subjectWiseStatistics).toHaveLength(2);

            const mathStats = stats.subjectWiseStatistics.find(s => s.subjectName === 'Mathematics');
            expect(mathStats?.totalEnrolled).toBe(3);
            expect(mathStats?.passedStudents).toBe(3);
            expect(mathStats?.averageScore).toBeCloseTo(65, 1); // (85 + 45 + 65) / 3

            const englishStats = stats.subjectWiseStatistics.find(s => s.subjectName === 'English Language');
            expect(englishStats?.totalEnrolled).toBe(2);
            expect(englishStats?.passedStudents).toBe(1);
            expect(englishStats?.averageScore).toBe(55); // (75 + 35) / 2

            // Performance trends
            expect(stats.performanceTrends.excellent).toBe(1);
            expect(stats.performanceTrends.average).toBe(1);
            expect(stats.performanceTrends.needsImprovement).toBe(1);
            expect(stats.performanceTrends.good).toBe(0);
            expect(stats.performanceTrends.failed).toBe(0);
        });
    });

    describe('Data Export Integration', () => {
        it('should export data to CSV format', () => {
            const testData = [
                { name: 'Alice', score: 85, grade: 'A' },
                { name: 'Bob', score: 65, grade: 'B' },
                { name: 'Charlie', score: 45, grade: 'C' }
            ];

            const csvContent = reportingService.exportToCSV(testData, 'test.csv');

            expect(csvContent).toContain('name,score,grade');
            expect(csvContent).toContain('Alice,85,A');
            expect(csvContent).toContain('Bob,65,B');
            expect(csvContent).toContain('Charlie,45,C');
        });

        it('should handle CSV special characters', () => {
            const testData = [
                { name: 'John, Jr.', comment: 'Good "student"', score: 85 }
            ];

            const csvContent = reportingService.exportToCSV(testData, 'test.csv');

            expect(csvContent).toContain('"John, Jr."');
            expect(csvContent).toContain('"Good ""student"""');
        });

        it('should export data to JSON format', () => {
            const testData = { students: ['Alice', 'Bob'], total: 2 };

            const jsonContent = reportingService.exportToJSON(testData, 'test.json');

            const parsed = JSON.parse(jsonContent);
            expect(parsed.students).toEqual(['Alice', 'Bob']);
            expect(parsed.total).toBe(2);
        });

        it('should handle empty data export', () => {
            const csvContent = reportingService.exportToCSV([], 'empty.csv');
            expect(csvContent).toBe('');

            const jsonContent = reportingService.exportToJSON([], 'empty.json');
            expect(jsonContent).toBe('[]');
        });
    });

    describe('Cross-Service Integration', () => {
        it('should integrate grading service calculations in reports', () => {
            const students = [
                Student.create({
                    id: '1',
                    adNo: 'AD001',
                    name: 'Test Student',
                    className: 'S1',
                    semester: 'Odd',
                    marks: {
                        'math': { ta: 40, ce: 35, total: 75, status: 'Passed' }
                    },
                    grandTotal: 75,
                    average: 75
                })
            ];

            const subjects = [
                {
                    id: 'math',
                    name: 'Mathematics',
                    isApplicableToClass: () => true,
                    getMaxTotal: () => 100
                } as Subject
            ];

            // Test that grading service methods are used correctly
            const report = reportingService.generateClassReport('S1', students, subjects);
            const scorecard = reportingService.generateStudentScorecard(students[0], subjects);

            // Verify grading service calculations are reflected
            expect(report.statistics.averageScore).toBe(75);
            expect(scorecard.academicPerformance.performanceLevel).toBe('Needs Improvement'); // 75 average should be 'Needs Improvement' based on student creation
        });

        it('should handle complex multi-class scenarios', () => {
            const students = [
                Student.create({
                    id: '1',
                    adNo: 'AD001',
                    name: 'S1 Student 1',
                    className: 'S1',
                    semester: 'Odd',
                    grandTotal: 200,
                    average: 80,
                    performanceLevel: 'Excellent'
                }),
                Student.create({
                    id: '2',
                    adNo: 'AD002',
                    name: 'S1 Student 2',
                    className: 'S1',
                    semester: 'Odd',
                    grandTotal: 150,
                    average: 60,
                    performanceLevel: 'Average'
                }),
                Student.create({
                    id: '3',
                    adNo: 'AD003',
                    name: 'S2 Student 1',
                    className: 'S2',
                    semester: 'Even',
                    grandTotal: 180,
                    average: 72,
                    performanceLevel: 'Good'
                })
            ];

            const subjects = [
                { id: 'math', name: 'Mathematics', isApplicableToClass: () => true } as Subject
            ];

            const overallStats = reportingService.generateOverallStatistics(students, subjects);

            expect(overallStats.classWiseStatistics).toHaveLength(2);
            expect(overallStats.classWiseStatistics.find(c => c.className === 'S1')?.totalStudents).toBe(2);
            expect(overallStats.classWiseStatistics.find(c => c.className === 'S2')?.totalStudents).toBe(1);
        });
    });
});