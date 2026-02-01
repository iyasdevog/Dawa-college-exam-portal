import { GradingService } from '../../../../src/domain/services/GradingService';
import { Student, SubjectMarks } from '../../../../src/domain/entities/Student';
import { Subject } from '../../../../src/domain/entities/Subject';

describe('GradingService', () => {
    let gradingService: GradingService;

    beforeEach(() => {
        gradingService = new GradingService();
    });

    describe('calculatePerformanceLevel', () => {
        it('should return Excellent for average >= 80', () => {
            expect(gradingService.calculatePerformanceLevel(85)).toBe('Excellent');
            expect(gradingService.calculatePerformanceLevel(80)).toBe('Excellent');
        });

        it('should return Good for average >= 70 and < 80', () => {
            expect(gradingService.calculatePerformanceLevel(75)).toBe('Good');
            expect(gradingService.calculatePerformanceLevel(70)).toBe('Good');
            expect(gradingService.calculatePerformanceLevel(79.99)).toBe('Good');
        });

        it('should return Average for average >= 60 and < 70', () => {
            expect(gradingService.calculatePerformanceLevel(65)).toBe('Average');
            expect(gradingService.calculatePerformanceLevel(60)).toBe('Average');
            expect(gradingService.calculatePerformanceLevel(69.99)).toBe('Average');
        });

        it('should return Needs Improvement for average >= 40 and < 60', () => {
            expect(gradingService.calculatePerformanceLevel(50)).toBe('Needs Improvement');
            expect(gradingService.calculatePerformanceLevel(40)).toBe('Needs Improvement');
            expect(gradingService.calculatePerformanceLevel(59.99)).toBe('Needs Improvement');
        });

        it('should return Failed for average < 40', () => {
            expect(gradingService.calculatePerformanceLevel(35)).toBe('Failed');
            expect(gradingService.calculatePerformanceLevel(0)).toBe('Failed');
            expect(gradingService.calculatePerformanceLevel(39.99)).toBe('Failed');
        });
    });

    describe('calculateSubjectMarks', () => {
        let mockSubject: Subject;

        beforeEach(() => {
            mockSubject = {
                id: 'math',
                name: 'Mathematics',
                maxTA: 50,
                maxCE: 50,
                passingTotal: 40,
                isPassingScore: jest.fn((ta: number, ce: number) => ta + ce >= 40),
                getMaxTotal: jest.fn(() => 100)
            } as any;
        });

        it('should calculate subject marks correctly for passing score', () => {
            const marks = gradingService.calculateSubjectMarks(25, 20, mockSubject);

            expect(marks.ta).toBe(25);
            expect(marks.ce).toBe(20);
            expect(marks.total).toBe(45);
            expect(marks.status).toBe('Passed');
            expect(mockSubject.isPassingScore).toHaveBeenCalledWith(25, 20);
        });

        it('should calculate subject marks correctly for failing score', () => {
            (mockSubject.isPassingScore as jest.Mock).mockReturnValue(false);

            const marks = gradingService.calculateSubjectMarks(15, 20, mockSubject);

            expect(marks.ta).toBe(15);
            expect(marks.ce).toBe(20);
            expect(marks.total).toBe(35);
            expect(marks.status).toBe('Failed');
        });

        it('should handle zero marks', () => {
            (mockSubject.isPassingScore as jest.Mock).mockReturnValue(false);

            const marks = gradingService.calculateSubjectMarks(0, 0, mockSubject);

            expect(marks.ta).toBe(0);
            expect(marks.ce).toBe(0);
            expect(marks.total).toBe(0);
            expect(marks.status).toBe('Failed');
        });
    });

    describe('calculateStudentGrandTotal', () => {
        it('should calculate grand total correctly', () => {
            const marks: Record<string, SubjectMarks> = {
                'math': { ta: 40, ce: 35, total: 75, status: 'Passed' },
                'english': { ta: 35, ce: 30, total: 65, status: 'Passed' },
                'science': { ta: 20, ce: 15, total: 35, status: 'Failed' }
            };

            const grandTotal = gradingService.calculateStudentGrandTotal(marks);
            expect(grandTotal).toBe(175);
        });

        it('should return 0 for empty marks', () => {
            const grandTotal = gradingService.calculateStudentGrandTotal({});
            expect(grandTotal).toBe(0);
        });
    });

    describe('calculateStudentAverage', () => {
        it('should calculate average correctly', () => {
            const marks: Record<string, SubjectMarks> = {
                'math': { ta: 40, ce: 35, total: 75, status: 'Passed' },
                'english': { ta: 35, ce: 30, total: 65, status: 'Passed' },
                'science': { ta: 20, ce: 15, total: 35, status: 'Failed' }
            };

            const average = gradingService.calculateStudentAverage(marks);
            expect(average).toBeCloseTo(58.33, 2);
        });

        it('should return 0 for empty marks', () => {
            const average = gradingService.calculateStudentAverage({});
            expect(average).toBe(0);
        });

        it('should round to 2 decimal places', () => {
            const marks: Record<string, SubjectMarks> = {
                'math': { ta: 33, ce: 34, total: 67, status: 'Passed' }
            };

            const average = gradingService.calculateStudentAverage(marks);
            expect(average).toBe(67);
        });
    });

    describe('calculateClassRankings', () => {
        let students: Student[];

        beforeEach(() => {
            students = [
                Student.create({
                    id: '1',
                    adNo: 'AD001',
                    name: 'Alice',
                    className: 'S1',
                    semester: 'Odd',
                    grandTotal: 250,
                    average: 83.33
                }),
                Student.create({
                    id: '2',
                    adNo: 'AD002',
                    name: 'Bob',
                    className: 'S1',
                    semester: 'Odd',
                    grandTotal: 200,
                    average: 66.67
                }),
                Student.create({
                    id: '3',
                    adNo: 'AD003',
                    name: 'Charlie',
                    className: 'S1',
                    semester: 'Odd',
                    grandTotal: 250,
                    average: 83.33
                }),
                Student.create({
                    id: '4',
                    adNo: 'AD004',
                    name: 'David',
                    className: 'S1',
                    semester: 'Odd',
                    grandTotal: 180,
                    average: 60
                })
            ];
        });

        it('should rank students by grand total and average', () => {
            const rankedStudents = gradingService.calculateClassRankings(students);

            expect(rankedStudents[0].rank).toBe(1); // Alice or Charlie (tied)
            expect(rankedStudents[1].rank).toBe(1); // Alice or Charlie (tied)
            expect(rankedStudents[2].rank).toBe(3); // Bob
            expect(rankedStudents[3].rank).toBe(4); // David

            // Check that higher scores come first
            expect(rankedStudents[0].grandTotal).toBe(250);
            expect(rankedStudents[1].grandTotal).toBe(250);
            expect(rankedStudents[2].grandTotal).toBe(200);
            expect(rankedStudents[3].grandTotal).toBe(180);
        });

        it('should handle ties correctly', () => {
            const tiedStudents = [
                Student.create({
                    id: '1',
                    adNo: 'AD001',
                    name: 'Alice',
                    className: 'S1',
                    semester: 'Odd',
                    grandTotal: 200,
                    average: 66.67
                }),
                Student.create({
                    id: '2',
                    adNo: 'AD002',
                    name: 'Bob',
                    className: 'S1',
                    semester: 'Odd',
                    grandTotal: 200,
                    average: 66.67
                })
            ];

            const rankedStudents = gradingService.calculateClassRankings(tiedStudents);

            expect(rankedStudents[0].rank).toBe(1);
            expect(rankedStudents[1].rank).toBe(1);
        });

        it('should handle empty student list', () => {
            const rankedStudents = gradingService.calculateClassRankings([]);
            expect(rankedStudents).toEqual([]);
        });

        it('should handle single student', () => {
            const singleStudent = [students[0]];
            const rankedStudents = gradingService.calculateClassRankings(singleStudent);

            expect(rankedStudents).toHaveLength(1);
            expect(rankedStudents[0].rank).toBe(1);
        });
    });

    describe('isStudentEligibleForPromotion', () => {
        let student: Student;
        let subjects: Subject[];

        beforeEach(() => {
            student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd',
                marks: {
                    'math': { ta: 40, ce: 35, total: 75, status: 'Passed' },
                    'english': { ta: 20, ce: 15, total: 35, status: 'Failed' }
                }
            });

            subjects = [
                {
                    id: 'math',
                    name: 'Mathematics',
                    isApplicableToClass: jest.fn((className: string) => className === 'S1')
                } as any,
                {
                    id: 'english',
                    name: 'English',
                    isApplicableToClass: jest.fn((className: string) => className === 'S1')
                } as any,
                {
                    id: 'science',
                    name: 'Science',
                    isApplicableToClass: jest.fn((className: string) => className === 'S1')
                } as any
            ];
        });

        it('should return not eligible when student has failed subjects', () => {
            const result = gradingService.isStudentEligibleForPromotion(student, subjects);

            expect(result.eligible).toBe(false);
            expect(result.failedSubjects).toContain('english');
            expect(result.supplementaryRequired).toContain('english');
            expect(result.supplementaryRequired).toContain('science'); // No marks recorded
        });

        it('should return eligible when student passed all subjects', () => {
            const passedStudent = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd',
                marks: {
                    'math': { ta: 40, ce: 35, total: 75, status: 'Passed' },
                    'english': { ta: 35, ce: 30, total: 65, status: 'Passed' },
                    'science': { ta: 30, ce: 25, total: 55, status: 'Passed' }
                }
            });

            const result = gradingService.isStudentEligibleForPromotion(passedStudent, subjects);

            expect(result.eligible).toBe(true);
            expect(result.failedSubjects).toEqual([]);
            expect(result.supplementaryRequired).toEqual([]);
        });

        it('should only check subjects applicable to student class', () => {
            const otherClassSubject = {
                id: 'advanced',
                name: 'Advanced Subject',
                isApplicableToClass: jest.fn((className: string) => className === 'S2')
            } as any;

            const allSubjects = [...subjects, otherClassSubject];
            const result = gradingService.isStudentEligibleForPromotion(student, allSubjects);

            expect(otherClassSubject.isApplicableToClass).toHaveBeenCalledWith('S1');
            expect(result.failedSubjects).not.toContain('advanced');
        });
    });

    describe('calculateClassStatistics', () => {
        let students: Student[];

        beforeEach(() => {
            students = [
                Student.create({
                    id: '1',
                    adNo: 'AD001',
                    name: 'Alice',
                    className: 'S1',
                    semester: 'Odd',
                    grandTotal: 250,
                    average: 83.33,
                    performanceLevel: 'Excellent',
                    marks: {
                        'math': { ta: 40, ce: 35, total: 75, status: 'Passed' },
                        'english': { ta: 40, ce: 35, total: 75, status: 'Passed' },
                        'science': { ta: 45, ce: 45, total: 90, status: 'Passed' }
                    }
                }),
                Student.create({
                    id: '2',
                    adNo: 'AD002',
                    name: 'Bob',
                    className: 'S1',
                    semester: 'Odd',
                    grandTotal: 150,
                    average: 50,
                    performanceLevel: 'Needs Improvement',
                    marks: {
                        'math': { ta: 25, ce: 25, total: 50, status: 'Passed' },
                        'english': { ta: 20, ce: 15, total: 35, status: 'Failed' },
                        'science': { ta: 30, ce: 35, total: 65, status: 'Passed' }
                    }
                }),
                Student.create({
                    id: '3',
                    adNo: 'AD003',
                    name: 'Charlie',
                    className: 'S1',
                    semester: 'Odd',
                    grandTotal: 0,
                    average: 0,
                    performanceLevel: 'Failed'
                })
            ];
        });

        it('should calculate class statistics correctly', () => {
            const stats = gradingService.calculateClassStatistics(students);

            expect(stats.totalStudents).toBe(3);
            expect(stats.passedStudents).toBe(1); // Only Alice passed all subjects
            expect(stats.failedStudents).toBe(1); // Only Bob has marks but failed
            expect(stats.averageScore).toBeCloseTo(66.67, 1); // (83.33 + 50) / 2
            expect(stats.highestScore).toBe(83.33);
            expect(stats.lowestScore).toBe(50);
            expect(stats.performanceLevels.Excellent).toBe(1);
            expect(stats.performanceLevels['Needs Improvement']).toBe(1);
            expect(stats.performanceLevels.Failed).toBe(1);
        });

        it('should handle empty student list', () => {
            const stats = gradingService.calculateClassStatistics([]);

            expect(stats.totalStudents).toBe(0);
            expect(stats.passedStudents).toBe(0);
            expect(stats.failedStudents).toBe(0);
            expect(stats.averageScore).toBe(0);
            expect(stats.highestScore).toBe(0);
            expect(stats.lowestScore).toBe(0);
            expect(Object.values(stats.performanceLevels).every(count => count === 0)).toBe(true);
        });

        it('should exclude students with no marks from score calculations', () => {
            const studentsWithNoMarks = [
                Student.create({
                    id: '1',
                    adNo: 'AD001',
                    name: 'Alice',
                    className: 'S1',
                    semester: 'Odd',
                    grandTotal: 0,
                    average: 0,
                    performanceLevel: 'Failed'
                })
            ];

            const stats = gradingService.calculateClassStatistics(studentsWithNoMarks);

            expect(stats.totalStudents).toBe(1);
            expect(stats.passedStudents).toBe(0);
            expect(stats.failedStudents).toBe(0);
            expect(stats.averageScore).toBe(0);
            expect(stats.highestScore).toBe(0);
            expect(stats.lowestScore).toBe(0);
        });
    });

    describe('generateGradeReport', () => {
        let student: Student;
        let subjects: Subject[];

        beforeEach(() => {
            student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd',
                grandTotal: 175,
                average: 58.33,
                rank: 5,
                performanceLevel: 'Average',
                marks: {
                    'math': { ta: 40, ce: 35, total: 75, status: 'Passed' },
                    'english': { ta: 35, ce: 30, total: 65, status: 'Passed' },
                    'science': { ta: 20, ce: 15, total: 35, status: 'Failed' }
                }
            });

            subjects = [
                {
                    id: 'math',
                    name: 'Mathematics',
                    isApplicableToClass: jest.fn(() => true),
                    getMaxTotal: jest.fn(() => 100)
                } as any,
                {
                    id: 'english',
                    name: 'English',
                    isApplicableToClass: jest.fn(() => true),
                    getMaxTotal: jest.fn(() => 100)
                } as any,
                {
                    id: 'science',
                    name: 'Science',
                    isApplicableToClass: jest.fn(() => true),
                    getMaxTotal: jest.fn(() => 100)
                } as any
            ];
        });

        it('should generate complete grade report', () => {
            const report = gradingService.generateGradeReport(student, subjects);

            expect(report.studentInfo).toEqual({
                id: '1',
                name: 'John Doe',
                adNo: 'AD001',
                className: 'S1',
                semester: 'Odd'
            });

            expect(report.academicPerformance).toEqual({
                grandTotal: 175,
                average: 58.33,
                rank: 5,
                performanceLevel: 'Average'
            });

            expect(report.subjectWiseMarks).toHaveLength(3);
            expect(report.subjectWiseMarks[0]).toEqual({
                subjectId: 'math',
                subjectName: 'Mathematics',
                ta: 40,
                ce: 35,
                total: 75,
                status: 'Passed',
                maxMarks: 100,
                percentage: 75
            });

            expect(report.promotionStatus.eligible).toBe(false);
            expect(report.promotionStatus.failedSubjects).toContain('science');
        });

        it('should handle subjects with no marks', () => {
            const studentWithoutMarks = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd'
            });

            const report = gradingService.generateGradeReport(studentWithoutMarks, subjects);

            expect(report.subjectWiseMarks[0]).toEqual({
                subjectId: 'math',
                subjectName: 'Mathematics',
                ta: 0,
                ce: 0,
                total: 0,
                status: 'Pending',
                maxMarks: 100,
                percentage: 0
            });
        });
    });
});