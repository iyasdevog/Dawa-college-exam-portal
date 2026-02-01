import { StudentUseCases } from '../../src/domain/usecases/StudentUseCases';
import { GradingService } from '../../src/domain/services/GradingService';
import { Student, SubjectMarks } from '../../src/domain/entities/Student';
import { Subject } from '../../src/domain/entities/Subject';
import { IStudentRepository } from '../../src/domain/interfaces/IStudentRepository';
import { ISubjectRepository } from '../../src/domain/interfaces/ISubjectRepository';

describe('Student Workflow Integration Tests', () => {
    let studentUseCases: StudentUseCases;
    let gradingService: GradingService;
    let mockStudentRepository: jest.Mocked<IStudentRepository>;
    let mockSubjectRepository: jest.Mocked<ISubjectRepository>;

    beforeEach(() => {
        mockStudentRepository = {
            save: jest.fn(),
            findById: jest.fn(),
            findByAdmissionNumber: jest.fn(),
            findByClass: jest.fn(),
            findAll: jest.fn(),
            updateStudentMarks: jest.fn(),
            delete: jest.fn(),
            bulkImport: jest.fn(),
            clearStudentMarks: jest.fn(),
            calculateClassRankings: jest.fn()
        };

        mockSubjectRepository = {
            findById: jest.fn(),
            findAll: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            findByClass: jest.fn(),
            getEnrolledStudents: jest.fn()
        };

        studentUseCases = new StudentUseCases(mockStudentRepository, mockSubjectRepository);
        gradingService = new GradingService();
    });

    describe('Complete Student Marks Entry and Ranking Workflow', () => {
        it('should handle complete workflow from student creation to ranking calculation', async () => {
            // Setup subjects
            const mathSubject = {
                id: 'math',
                name: 'Mathematics',
                maxTA: 50,
                maxCE: 50,
                passingTotal: 40,
                isPassingScore: (ta: number, ce: number) => ta + ce >= 40,
                getMaxTotal: () => 100,
                isApplicableToClass: (className: string) => className === 'S1'
            } as Subject;

            const englishSubject = {
                id: 'english',
                name: 'English',
                maxTA: 50,
                maxCE: 50,
                passingTotal: 40,
                isPassingScore: (ta: number, ce: number) => ta + ce >= 40,
                getMaxTotal: () => 100,
                isApplicableToClass: (className: string) => className === 'S1'
            } as Subject;

            // Mock repository responses
            mockStudentRepository.findByAdmissionNumber.mockResolvedValue(null);
            mockStudentRepository.save.mockResolvedValue('student-1');
            mockSubjectRepository.findById
                .mockResolvedValueOnce(mathSubject)
                .mockResolvedValueOnce(englishSubject);

            // Step 1: Create student
            const studentId = await studentUseCases.createStudent({
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd'
            });

            expect(studentId).toBe('student-1');
            expect(mockStudentRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    adNo: 'AD001',
                    name: 'John Doe',
                    className: 'S1',
                    semester: 'Odd'
                })
            );

            // Step 2: Add marks for first subject
            const student = Student.create({
                id: 'student-1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd'
            });

            mockStudentRepository.findById.mockResolvedValue(student);

            await studentUseCases.updateStudentMarks('student-1', 'math', 40, 35);

            expect(mockStudentRepository.updateStudentMarks).toHaveBeenCalledWith(
                'student-1',
                'math',
                expect.objectContaining({
                    ta: 40,
                    ce: 35,
                    total: 75,
                    status: 'Passed'
                })
            );
            expect(mockStudentRepository.calculateClassRankings).toHaveBeenCalledWith('S1');

            // Step 3: Add marks for second subject
            await studentUseCases.updateStudentMarks('student-1', 'english', 35, 30);

            expect(mockStudentRepository.updateStudentMarks).toHaveBeenCalledWith(
                'student-1',
                'english',
                expect.objectContaining({
                    ta: 35,
                    ce: 30,
                    total: 65,
                    status: 'Passed'
                })
            );

            // Verify ranking calculation was called for each marks update
            expect(mockStudentRepository.calculateClassRankings).toHaveBeenCalledTimes(2);
        });

        it('should handle student promotion eligibility workflow', async () => {
            // Create student with mixed marks (some passed, some failed)
            const student = Student.create({
                id: 'student-1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd',
                marks: {
                    'math': { ta: 40, ce: 35, total: 75, status: 'Passed' },
                    'english': { ta: 20, ce: 15, total: 35, status: 'Failed' }
                }
            });

            const subjects = [
                {
                    id: 'math',
                    name: 'Mathematics',
                    isApplicableToClass: (className: string) => className === 'S1',
                    getMaxTotal: () => 100
                } as Subject,
                {
                    id: 'english',
                    name: 'English',
                    isApplicableToClass: (className: string) => className === 'S1',
                    getMaxTotal: () => 100
                } as Subject,
                {
                    id: 'science',
                    name: 'Science',
                    isApplicableToClass: (className: string) => className === 'S1',
                    getMaxTotal: () => 100
                } as Subject
            ];

            // Test promotion eligibility
            const eligibility = gradingService.isStudentEligibleForPromotion(student, subjects);

            expect(eligibility.eligible).toBe(false);
            expect(eligibility.failedSubjects).toContain('english');
            expect(eligibility.supplementaryRequired).toContain('english');
            expect(eligibility.supplementaryRequired).toContain('science'); // No marks recorded

            // Generate grade report
            const gradeReport = gradingService.generateGradeReport(student, subjects);

            expect(gradeReport.promotionStatus.eligible).toBe(false);
            expect(gradeReport.promotionStatus.failedSubjects).toContain('english');
            expect(gradeReport.subjectWiseMarks).toHaveLength(3);
        });

        it('should handle class ranking workflow with multiple students', async () => {
            const students = [
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
                })
            ];

            mockStudentRepository.findByClass.mockResolvedValue(students);

            // Get class rankings through use case
            const rankings = await studentUseCases.getClassRankings('S1');

            // Verify students are sorted by rank
            expect(rankings[0].rank).toBeLessThanOrEqual(rankings[1].rank);
            expect(rankings[1].rank).toBeLessThanOrEqual(rankings[2].rank);

            // Test grading service ranking calculation
            const rankedStudents = gradingService.calculateClassRankings(students);

            expect(rankedStudents[0].rank).toBe(1);
            expect(rankedStudents[1].rank).toBe(1); // Tied for first
            expect(rankedStudents[2].rank).toBe(3); // Next rank after tie
        });
    });

    describe('Bulk Operations Integration', () => {
        it('should handle bulk student import with ranking recalculation', async () => {
            const studentsData = [
                { adNo: 'AD001', name: 'Alice', className: 'S1', semester: 'Odd' as const },
                { adNo: 'AD002', name: 'Bob', className: 'S1', semester: 'Odd' as const },
                { adNo: 'AD003', name: 'Charlie', className: 'S2', semester: 'Even' as const }
            ];

            mockStudentRepository.bulkImport.mockResolvedValue({
                success: 3,
                errors: []
            });

            const result = await studentUseCases.bulkImportStudents(studentsData);

            expect(result.success).toBe(3);
            expect(result.errors).toEqual([]);

            // Verify rankings are recalculated for all affected classes
            expect(mockStudentRepository.calculateClassRankings).toHaveBeenCalledWith('S1');
            expect(mockStudentRepository.calculateClassRankings).toHaveBeenCalledWith('S2');
            expect(mockStudentRepository.calculateClassRankings).toHaveBeenCalledTimes(2);
        });

        it('should handle bulk import with partial failures', async () => {
            const studentsData = [
                { adNo: 'AD001', name: 'Alice', className: 'S1', semester: 'Odd' as const },
                { adNo: 'AD002', name: 'Bob', className: 'S1', semester: 'Odd' as const }
            ];

            mockStudentRepository.bulkImport.mockResolvedValue({
                success: 1,
                errors: ['Duplicate admission number: AD002']
            });

            const result = await studentUseCases.bulkImportStudents(studentsData);

            expect(result.success).toBe(1);
            expect(result.errors).toContain('Duplicate admission number: AD002');

            // Rankings should still be recalculated for affected classes
            expect(mockStudentRepository.calculateClassRankings).toHaveBeenCalledWith('S1');
        });
    });

    describe('Error Handling Integration', () => {
        it('should handle repository failures gracefully', async () => {
            mockStudentRepository.findByAdmissionNumber.mockRejectedValue(new Error('Database connection failed'));

            await expect(studentUseCases.createStudent({
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd'
            })).rejects.toThrow('Database connection failed');

            expect(mockStudentRepository.save).not.toHaveBeenCalled();
        });

        it('should validate marks against subject constraints', async () => {
            const student = Student.create({
                id: 'student-1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd'
            });

            const subject = {
                id: 'math',
                name: 'Mathematics',
                maxTA: 50,
                maxCE: 50
            } as Subject;

            mockStudentRepository.findById.mockResolvedValue(student);
            mockSubjectRepository.findById.mockResolvedValue(subject);

            // Test marks exceeding maximum
            await expect(studentUseCases.updateStudentMarks('student-1', 'math', 60, 35))
                .rejects.toThrow('Marks exceed maximum allowed (TA: 50, CE: 50)');

            expect(mockStudentRepository.updateStudentMarks).not.toHaveBeenCalled();
        });

        it('should handle missing entities appropriately', async () => {
            // Test missing student
            mockStudentRepository.findById.mockResolvedValue(null);

            await expect(studentUseCases.updateStudentMarks('non-existent', 'math', 40, 35))
                .rejects.toThrow('Student not found');

            // Test missing subject
            const student = Student.create({
                id: 'student-1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd'
            });

            mockStudentRepository.findById.mockResolvedValue(student);
            mockSubjectRepository.findById.mockResolvedValue(null);

            await expect(studentUseCases.updateStudentMarks('student-1', 'non-existent', 40, 35))
                .rejects.toThrow('Subject not found');
        });
    });

    describe('Data Flow Integration', () => {
        it('should maintain data consistency across operations', async () => {
            // Create a student with initial marks
            const student = Student.create({
                id: 'student-1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd',
                marks: {
                    'math': { ta: 40, ce: 35, total: 75, status: 'Passed' }
                },
                grandTotal: 75,
                average: 75,
                rank: 1
            });

            mockStudentRepository.findById.mockResolvedValue(student);

            // Test clearing marks
            await studentUseCases.clearStudentMarks('student-1', 'math');

            expect(mockStudentRepository.clearStudentMarks).toHaveBeenCalledWith('student-1', 'math');
            expect(mockStudentRepository.calculateClassRankings).toHaveBeenCalledWith('S1');

            // Test deletion
            await studentUseCases.deleteStudent('student-1');

            expect(mockStudentRepository.delete).toHaveBeenCalledWith('student-1');
            expect(mockStudentRepository.calculateClassRankings).toHaveBeenCalledWith('S1');
        });

        it('should handle complex grading scenarios', async () => {
            const students = [
                Student.create({
                    id: '1',
                    adNo: 'AD001',
                    name: 'Excellent Student',
                    className: 'S1',
                    semester: 'Odd',
                    marks: {
                        'math': { ta: 45, ce: 45, total: 90, status: 'Passed' },
                        'english': { ta: 40, ce: 40, total: 80, status: 'Passed' }
                    },
                    grandTotal: 170,
                    average: 85,
                    performanceLevel: 'Excellent'
                }),
                Student.create({
                    id: '2',
                    adNo: 'AD002',
                    name: 'Struggling Student',
                    className: 'S1',
                    semester: 'Odd',
                    marks: {
                        'math': { ta: 20, ce: 15, total: 35, status: 'Failed' },
                        'english': { ta: 25, ce: 20, total: 45, status: 'Passed' }
                    },
                    grandTotal: 80,
                    average: 40,
                    performanceLevel: 'Needs Improvement'
                })
            ];

            // Test class statistics calculation
            const stats = gradingService.calculateClassStatistics(students);

            expect(stats.totalStudents).toBe(2);
            expect(stats.passedStudents).toBe(1); // Only excellent student passed all
            expect(stats.failedStudents).toBe(1); // Struggling student has failed subjects
            expect(stats.performanceLevels.Excellent).toBe(1);
            expect(stats.performanceLevels['Needs Improvement']).toBe(1);

            // Test top performers
            mockStudentRepository.findAll.mockResolvedValue(students);
            const topPerformers = await studentUseCases.getTopPerformers(1);

            expect(topPerformers).toHaveLength(1);
            expect(topPerformers[0].name).toBe('Excellent Student');
        });
    });
});