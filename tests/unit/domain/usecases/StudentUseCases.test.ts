import { StudentUseCases } from '../../../../src/domain/usecases/StudentUseCases';
import { Student, SubjectMarks } from '../../../../src/domain/entities/Student';
import { IStudentRepository } from '../../../../src/domain/interfaces/IStudentRepository';
import { ISubjectRepository } from '../../../../src/domain/interfaces/ISubjectRepository';

describe('StudentUseCases', () => {
    let studentUseCases: StudentUseCases;
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
    });

    describe('createStudent', () => {
        it('should create a new student successfully', async () => {
            const studentData = {
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd' as const
            };

            mockStudentRepository.findByAdmissionNumber.mockResolvedValue(null);
            mockStudentRepository.save.mockResolvedValue('student-id-123');

            const result = await studentUseCases.createStudent(studentData);

            expect(result).toBe('student-id-123');
            expect(mockStudentRepository.findByAdmissionNumber).toHaveBeenCalledWith('AD001');
            expect(mockStudentRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    adNo: 'AD001',
                    name: 'John Doe',
                    className: 'S1',
                    semester: 'Odd'
                })
            );
        });

        it('should throw error if admission number already exists', async () => {
            const studentData = {
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd' as const
            };

            const existingStudent = Student.create({
                id: 'existing-id',
                adNo: 'AD001',
                name: 'Existing Student',
                className: 'S1',
                semester: 'Odd'
            });

            mockStudentRepository.findByAdmissionNumber.mockResolvedValue(existingStudent);

            await expect(studentUseCases.createStudent(studentData))
                .rejects.toThrow('Student with admission number AD001 already exists');

            expect(mockStudentRepository.save).not.toHaveBeenCalled();
        });
    });

    describe('getStudentById', () => {
        it('should return student when found', async () => {
            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd'
            });

            mockStudentRepository.findById.mockResolvedValue(student);

            const result = await studentUseCases.getStudentById('1');

            expect(result).toBe(student);
            expect(mockStudentRepository.findById).toHaveBeenCalledWith('1');
        });

        it('should return null when student not found', async () => {
            mockStudentRepository.findById.mockResolvedValue(null);

            const result = await studentUseCases.getStudentById('non-existent');

            expect(result).toBeNull();
        });
    });

    describe('updateStudentMarks', () => {
        let mockStudent: Student;
        let mockSubject: any;

        beforeEach(() => {
            mockStudent = Student.create({
                id: 'student-1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd'
            });

            mockSubject = {
                id: 'math',
                name: 'Mathematics',
                maxTA: 50,
                maxCE: 50,
                isPassingScore: jest.fn(() => true)
            };
        });

        it('should update student marks successfully', async () => {
            mockStudentRepository.findById.mockResolvedValue(mockStudent);
            mockSubjectRepository.findById.mockResolvedValue(mockSubject);

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
        });

        it('should throw error if student not found', async () => {
            mockStudentRepository.findById.mockResolvedValue(null);

            await expect(studentUseCases.updateStudentMarks('non-existent', 'math', 40, 35))
                .rejects.toThrow('Student not found');

            expect(mockStudentRepository.updateStudentMarks).not.toHaveBeenCalled();
        });

        it('should throw error if subject not found', async () => {
            mockStudentRepository.findById.mockResolvedValue(mockStudent);
            mockSubjectRepository.findById.mockResolvedValue(null);

            await expect(studentUseCases.updateStudentMarks('student-1', 'non-existent', 40, 35))
                .rejects.toThrow('Subject not found');

            expect(mockStudentRepository.updateStudentMarks).not.toHaveBeenCalled();
        });

        it('should throw error if marks exceed maximum allowed', async () => {
            mockStudentRepository.findById.mockResolvedValue(mockStudent);
            mockSubjectRepository.findById.mockResolvedValue(mockSubject);

            await expect(studentUseCases.updateStudentMarks('student-1', 'math', 60, 35))
                .rejects.toThrow('Marks exceed maximum allowed (TA: 50, CE: 50)');

            expect(mockStudentRepository.updateStudentMarks).not.toHaveBeenCalled();
        });

        it('should calculate failed status correctly', async () => {
            mockSubject.isPassingScore.mockReturnValue(false);
            mockStudentRepository.findById.mockResolvedValue(mockStudent);
            mockSubjectRepository.findById.mockResolvedValue(mockSubject);

            await studentUseCases.updateStudentMarks('student-1', 'math', 20, 15);

            expect(mockStudentRepository.updateStudentMarks).toHaveBeenCalledWith(
                'student-1',
                'math',
                expect.objectContaining({
                    ta: 20,
                    ce: 15,
                    total: 35,
                    status: 'Failed'
                })
            );
        });
    });

    describe('deleteStudent', () => {
        it('should delete student and recalculate rankings', async () => {
            const student = Student.create({
                id: 'student-1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd'
            });

            mockStudentRepository.findById.mockResolvedValue(student);

            await studentUseCases.deleteStudent('student-1');

            expect(mockStudentRepository.delete).toHaveBeenCalledWith('student-1');
            expect(mockStudentRepository.calculateClassRankings).toHaveBeenCalledWith('S1');
        });

        it('should throw error if student not found', async () => {
            mockStudentRepository.findById.mockResolvedValue(null);

            await expect(studentUseCases.deleteStudent('non-existent'))
                .rejects.toThrow('Student not found');

            expect(mockStudentRepository.delete).not.toHaveBeenCalled();
        });
    });

    describe('bulkImportStudents', () => {
        it('should import students and recalculate rankings for affected classes', async () => {
            const studentsData = [
                { adNo: 'AD001', name: 'John Doe', className: 'S1', semester: 'Odd' as const },
                { adNo: 'AD002', name: 'Jane Smith', className: 'S2', semester: 'Even' as const }
            ];

            mockStudentRepository.bulkImport.mockResolvedValue({
                success: 2,
                errors: []
            });

            const result = await studentUseCases.bulkImportStudents(studentsData);

            expect(result.success).toBe(2);
            expect(result.errors).toEqual([]);
            expect(mockStudentRepository.calculateClassRankings).toHaveBeenCalledWith('S1');
            expect(mockStudentRepository.calculateClassRankings).toHaveBeenCalledWith('S2');
        });

        it('should handle import errors', async () => {
            const studentsData = [
                { adNo: 'AD001', name: 'John Doe', className: 'S1', semester: 'Odd' as const }
            ];

            mockStudentRepository.bulkImport.mockResolvedValue({
                success: 0,
                errors: ['Duplicate admission number']
            });

            const result = await studentUseCases.bulkImportStudents(studentsData);

            expect(result.success).toBe(0);
            expect(result.errors).toEqual(['Duplicate admission number']);
        });
    });

    describe('getClassRankings', () => {
        it('should return students sorted by rank', async () => {
            const students = [
                Student.create({
                    id: '2',
                    adNo: 'AD002',
                    name: 'Bob',
                    className: 'S1',
                    semester: 'Odd',
                    rank: 2
                }),
                Student.create({
                    id: '1',
                    adNo: 'AD001',
                    name: 'Alice',
                    className: 'S1',
                    semester: 'Odd',
                    rank: 1
                }),
                Student.create({
                    id: '3',
                    adNo: 'AD003',
                    name: 'Charlie',
                    className: 'S1',
                    semester: 'Odd',
                    rank: 3
                })
            ];

            mockStudentRepository.findByClass.mockResolvedValue(students);

            const result = await studentUseCases.getClassRankings('S1');

            expect(result[0].rank).toBe(1);
            expect(result[1].rank).toBe(2);
            expect(result[2].rank).toBe(3);
            expect(result[0].name).toBe('Alice');
        });
    });

    describe('getTopPerformers', () => {
        it('should return top performers sorted by average', async () => {
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
                    grandTotal: 0,
                    average: 0
                })
            ];

            mockStudentRepository.findAll.mockResolvedValue(students);

            const result = await studentUseCases.getTopPerformers(2);

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Alice');
            expect(result[1].name).toBe('Bob');
            expect(result[0].average).toBe(83.33);
        });

        it('should exclude students with no marks', async () => {
            const students = [
                Student.create({
                    id: '1',
                    adNo: 'AD001',
                    name: 'Alice',
                    className: 'S1',
                    semester: 'Odd',
                    grandTotal: 0,
                    average: 0
                })
            ];

            mockStudentRepository.findAll.mockResolvedValue(students);

            const result = await studentUseCases.getTopPerformers();

            expect(result).toHaveLength(0);
        });
    });

    describe('getStudentsNeedingSupplementary', () => {
        it('should return students with failed subjects', async () => {
            const students = [
                Student.create({
                    id: '1',
                    adNo: 'AD001',
                    name: 'Alice',
                    className: 'S1',
                    semester: 'Odd',
                    marks: {
                        'math': { ta: 40, ce: 35, total: 75, status: 'Passed' },
                        'english': { ta: 35, ce: 30, total: 65, status: 'Passed' }
                    }
                }),
                Student.create({
                    id: '2',
                    adNo: 'AD002',
                    name: 'Bob',
                    className: 'S1',
                    semester: 'Odd',
                    marks: {
                        'math': { ta: 20, ce: 15, total: 35, status: 'Failed' },
                        'english': { ta: 35, ce: 30, total: 65, status: 'Passed' }
                    }
                })
            ];

            mockStudentRepository.findAll.mockResolvedValue(students);

            const result = await studentUseCases.getStudentsNeedingSupplementary();

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('Bob');
        });

        it('should return empty array when no students need supplementary', async () => {
            const students = [
                Student.create({
                    id: '1',
                    adNo: 'AD001',
                    name: 'Alice',
                    className: 'S1',
                    semester: 'Odd',
                    marks: {
                        'math': { ta: 40, ce: 35, total: 75, status: 'Passed' }
                    }
                })
            ];

            mockStudentRepository.findAll.mockResolvedValue(students);

            const result = await studentUseCases.getStudentsNeedingSupplementary();

            expect(result).toHaveLength(0);
        });
    });

    describe('clearStudentMarks', () => {
        it('should clear marks and recalculate rankings', async () => {
            const student = Student.create({
                id: 'student-1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd'
            });

            mockStudentRepository.findById.mockResolvedValue(student);

            await studentUseCases.clearStudentMarks('student-1', 'math');

            expect(mockStudentRepository.clearStudentMarks).toHaveBeenCalledWith('student-1', 'math');
            expect(mockStudentRepository.calculateClassRankings).toHaveBeenCalledWith('S1');
        });

        it('should throw error if student not found', async () => {
            mockStudentRepository.findById.mockResolvedValue(null);

            await expect(studentUseCases.clearStudentMarks('non-existent', 'math'))
                .rejects.toThrow('Student not found');

            expect(mockStudentRepository.clearStudentMarks).not.toHaveBeenCalled();
        });
    });
});