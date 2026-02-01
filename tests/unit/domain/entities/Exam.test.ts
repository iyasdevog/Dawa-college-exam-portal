import { Exam, SupplementaryExam } from '../../../../src/domain/entities/Exam';
import { SubjectMarks } from '../../../../src/domain/entities/Student';

describe('Exam Entity', () => {
    const mockMarks: SubjectMarks = {
        ta: 40,
        ce: 35,
        total: 75,
        status: 'Passed'
    };

    describe('Exam.create', () => {
        it('should create an exam with required fields', () => {
            const exam = Exam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024
            });

            expect(exam.id).toBe('1');
            expect(exam.studentId).toBe('student1');
            expect(exam.subjectId).toBe('math');
            expect(exam.semester).toBe('Odd');
            expect(exam.year).toBe(2024);
            expect(exam.marks).toBeUndefined();
            expect(exam.isSupplementary).toBe(false);
            expect(exam.originalExamId).toBeUndefined();
        });

        it('should create an exam with optional fields', () => {
            const exam = Exam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024,
                marks: mockMarks,
                isSupplementary: true,
                originalExamId: 'original1'
            });

            expect(exam.marks).toEqual(mockMarks);
            expect(exam.isSupplementary).toBe(true);
            expect(exam.originalExamId).toBe('original1');
        });
    });

    describe('hasMarks', () => {
        it('should return true when marks are present', () => {
            const exam = Exam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024,
                marks: mockMarks
            });

            expect(exam.hasMarks()).toBe(true);
        });

        it('should return false when marks are not present', () => {
            const exam = Exam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024
            });

            expect(exam.hasMarks()).toBe(false);
        });
    });

    describe('isPassed', () => {
        it('should return true when marks status is Passed', () => {
            const exam = Exam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024,
                marks: { ...mockMarks, status: 'Passed' }
            });

            expect(exam.isPassed()).toBe(true);
        });

        it('should return false when marks status is Failed', () => {
            const exam = Exam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024,
                marks: { ...mockMarks, status: 'Failed' }
            });

            expect(exam.isPassed()).toBe(false);
        });

        it('should return false when no marks are present', () => {
            const exam = Exam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024
            });

            expect(exam.isPassed()).toBe(false);
        });
    });

    describe('isFailed', () => {
        it('should return true when marks status is Failed', () => {
            const exam = Exam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024,
                marks: { ...mockMarks, status: 'Failed' }
            });

            expect(exam.isFailed()).toBe(true);
        });

        it('should return false when marks status is Passed', () => {
            const exam = Exam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024,
                marks: { ...mockMarks, status: 'Passed' }
            });

            expect(exam.isFailed()).toBe(false);
        });

        it('should return false when no marks are present', () => {
            const exam = Exam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024
            });

            expect(exam.isFailed()).toBe(false);
        });
    });

    describe('updateMarks', () => {
        it('should update marks and preserve other properties', () => {
            const exam = Exam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024
            });

            const newMarks: SubjectMarks = {
                ta: 45,
                ce: 40,
                total: 85,
                status: 'Passed'
            };

            const updatedExam = exam.updateMarks(newMarks);

            expect(updatedExam.marks).toEqual(newMarks);
            expect(updatedExam.id).toBe('1');
            expect(updatedExam.studentId).toBe('student1');
            expect(updatedExam.subjectId).toBe('math');
            expect(updatedExam.semester).toBe('Odd');
            expect(updatedExam.year).toBe(2024);
        });
    });
});

describe('SupplementaryExam Entity', () => {
    const mockMarks: SubjectMarks = {
        ta: 40,
        ce: 35,
        total: 75,
        status: 'Passed',
        isSupplementary: true,
        supplementaryYear: 2025
    };

    describe('SupplementaryExam.create', () => {
        it('should create a supplementary exam with required fields', () => {
            const exam = SupplementaryExam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024,
                originalSemester: 'Odd',
                originalYear: 2024,
                supplementaryYear: 2025
            });

            expect(exam.id).toBe('1');
            expect(exam.studentId).toBe('student1');
            expect(exam.subjectId).toBe('math');
            expect(exam.semester).toBe('Odd');
            expect(exam.year).toBe(2025);
            expect(exam.originalSemester).toBe('Odd');
            expect(exam.originalYear).toBe(2024);
            expect(exam.supplementaryYear).toBe(2025);
            expect(exam.status).toBe('Pending');
            expect(exam.isSupplementary).toBe(true);
            expect(exam.marks).toBeUndefined();
        });

        it('should create a supplementary exam with optional fields', () => {
            const exam = SupplementaryExam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024,
                marks: mockMarks,
                status: 'Completed'
            });

            expect(exam.marks).toEqual(mockMarks);
            expect(exam.status).toBe('Completed');
        });

        it('should default to original semester and year when not provided', () => {
            const exam = SupplementaryExam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024
            });

            expect(exam.originalSemester).toBe('Odd');
            expect(exam.originalYear).toBe(2024);
            expect(exam.supplementaryYear).toBe(2024);
        });
    });

    describe('complete', () => {
        it('should complete the exam with marks', () => {
            const exam = SupplementaryExam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024,
                originalSemester: 'Odd',
                originalYear: 2024,
                supplementaryYear: 2025,
                status: 'Pending'
            });

            const completedExam = exam.complete(mockMarks);

            expect(completedExam.status).toBe('Completed');
            expect(completedExam.marks).toEqual(mockMarks);
            expect(completedExam.id).toBe('1');
            expect(completedExam.studentId).toBe('student1');
            expect(completedExam.subjectId).toBe('math');
        });
    });

    describe('isCompleted', () => {
        it('should return true when status is Completed', () => {
            const exam = SupplementaryExam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024,
                status: 'Completed'
            });

            expect(exam.isCompleted()).toBe(true);
        });

        it('should return false when status is Pending', () => {
            const exam = SupplementaryExam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024,
                status: 'Pending'
            });

            expect(exam.isCompleted()).toBe(false);
        });
    });

    describe('Inheritance from Exam', () => {
        it('should inherit Exam methods', () => {
            const exam = SupplementaryExam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024,
                marks: mockMarks
            });

            expect(exam.hasMarks()).toBe(true);
            expect(exam.isPassed()).toBe(true);
            expect(exam.isFailed()).toBe(false);
        });

        it('should update marks correctly', () => {
            const exam = SupplementaryExam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024
            });

            const newMarks: SubjectMarks = {
                ta: 45,
                ce: 40,
                total: 85,
                status: 'Passed'
            };

            const updatedExam = exam.updateMarks(newMarks);

            expect(updatedExam.marks).toEqual(newMarks);
            expect(updatedExam.isSupplementary).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle zero marks', () => {
            const zeroMarks: SubjectMarks = {
                ta: 0,
                ce: 0,
                total: 0,
                status: 'Failed'
            };

            const exam = SupplementaryExam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024,
                marks: zeroMarks
            });

            expect(exam.hasMarks()).toBe(true);
            expect(exam.isPassed()).toBe(false);
            expect(exam.isFailed()).toBe(true);
        });

        it('should handle same original and supplementary year', () => {
            const exam = SupplementaryExam.create({
                id: '1',
                studentId: 'student1',
                subjectId: 'math',
                semester: 'Odd',
                year: 2024,
                originalYear: 2024,
                supplementaryYear: 2024
            });

            expect(exam.originalYear).toBe(2024);
            expect(exam.supplementaryYear).toBe(2024);
        });
    });
});