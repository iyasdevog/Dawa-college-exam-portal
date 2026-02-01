import { Student, SubjectMarks, PerformanceLevel } from '../../../../src/domain/entities/Student';

describe('Student Entity', () => {
    const mockMarks: Record<string, SubjectMarks> = {
        'math': { ta: 40, ce: 35, total: 75, status: 'Passed' },
        'english': { ta: 35, ce: 30, total: 65, status: 'Passed' },
        'science': { ta: 20, ce: 15, total: 35, status: 'Failed' }
    };

    describe('Student.create', () => {
        it('should create a student with required fields', () => {
            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd'
            });

            expect(student.id).toBe('1');
            expect(student.adNo).toBe('AD001');
            expect(student.name).toBe('John Doe');
            expect(student.className).toBe('S1');
            expect(student.semester).toBe('Odd');
            expect(student.marks).toEqual({});
            expect(student.grandTotal).toBe(0);
            expect(student.average).toBe(0);
            expect(student.rank).toBe(0);
            expect(student.performanceLevel).toBe('Needs Improvement');
        });

        it('should create a student with optional fields', () => {
            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd',
                marks: mockMarks,
                grandTotal: 175,
                average: 58.33,
                rank: 5,
                performanceLevel: 'Average'
            });

            expect(student.marks).toEqual(mockMarks);
            expect(student.grandTotal).toBe(175);
            expect(student.average).toBe(58.33);
            expect(student.rank).toBe(5);
            expect(student.performanceLevel).toBe('Average');
        });
    });

    describe('calculateGrandTotal', () => {
        it('should calculate grand total correctly', () => {
            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd',
                marks: mockMarks
            });

            const grandTotal = student.calculateGrandTotal();
            expect(grandTotal).toBe(175); // 75 + 65 + 35
        });

        it('should return 0 for student with no marks', () => {
            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd'
            });

            const grandTotal = student.calculateGrandTotal();
            expect(grandTotal).toBe(0);
        });
    });

    describe('calculateAverage', () => {
        it('should calculate average correctly', () => {
            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd',
                marks: mockMarks,
                grandTotal: 175
            });

            const average = student.calculateAverage();
            expect(average).toBeCloseTo(58.33, 2); // 175 / 3
        });

        it('should return 0 for student with no marks', () => {
            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd'
            });

            const average = student.calculateAverage();
            expect(average).toBe(0);
        });
    });

    describe('hasPassedAllSubjects', () => {
        it('should return true when all subjects are passed', () => {
            const passedMarks: Record<string, SubjectMarks> = {
                'math': { ta: 40, ce: 35, total: 75, status: 'Passed' },
                'english': { ta: 35, ce: 30, total: 65, status: 'Passed' }
            };

            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd',
                marks: passedMarks
            });

            expect(student.hasPassedAllSubjects()).toBe(true);
        });

        it('should return false when any subject is failed', () => {
            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd',
                marks: mockMarks
            });

            expect(student.hasPassedAllSubjects()).toBe(false);
        });

        it('should return true for student with no marks', () => {
            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd'
            });

            expect(student.hasPassedAllSubjects()).toBe(true);
        });
    });

    describe('getFailedSubjects', () => {
        it('should return failed subject IDs', () => {
            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd',
                marks: mockMarks
            });

            const failedSubjects = student.getFailedSubjects();
            expect(failedSubjects).toEqual(['science']);
        });

        it('should return empty array when all subjects are passed', () => {
            const passedMarks: Record<string, SubjectMarks> = {
                'math': { ta: 40, ce: 35, total: 75, status: 'Passed' },
                'english': { ta: 35, ce: 30, total: 65, status: 'Passed' }
            };

            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd',
                marks: passedMarks
            });

            const failedSubjects = student.getFailedSubjects();
            expect(failedSubjects).toEqual([]);
        });
    });

    describe('updateMarks', () => {
        it('should update marks and recalculate totals and performance level', () => {
            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd'
            });

            const newMarks: SubjectMarks = { ta: 45, ce: 40, total: 85, status: 'Passed' };
            const updatedStudent = student.updateMarks('math', newMarks);

            expect(updatedStudent.marks['math']).toEqual(newMarks);
            expect(updatedStudent.grandTotal).toBe(85);
            expect(updatedStudent.average).toBe(85);
            expect(updatedStudent.performanceLevel).toBe('Excellent');
        });

        it('should calculate correct performance levels', () => {
            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd'
            });

            // Test Excellent (>= 80)
            let updatedStudent = student.updateMarks('math', { ta: 45, ce: 40, total: 85, status: 'Passed' });
            expect(updatedStudent.performanceLevel).toBe('Excellent');

            // Test Good (>= 70)
            updatedStudent = student.updateMarks('math', { ta: 40, ce: 35, total: 75, status: 'Passed' });
            expect(updatedStudent.performanceLevel).toBe('Good');

            // Test Average (>= 60)
            updatedStudent = student.updateMarks('math', { ta: 35, ce: 30, total: 65, status: 'Passed' });
            expect(updatedStudent.performanceLevel).toBe('Average');

            // Test Needs Improvement (>= 40)
            updatedStudent = student.updateMarks('math', { ta: 25, ce: 20, total: 45, status: 'Passed' });
            expect(updatedStudent.performanceLevel).toBe('Needs Improvement');

            // Test Failed (< 40)
            updatedStudent = student.updateMarks('math', { ta: 15, ce: 15, total: 30, status: 'Failed' });
            expect(updatedStudent.performanceLevel).toBe('Failed');
        });

        it('should preserve other student properties', () => {
            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd',
                rank: 5
            });

            const newMarks: SubjectMarks = { ta: 45, ce: 40, total: 85, status: 'Passed' };
            const updatedStudent = student.updateMarks('math', newMarks);

            expect(updatedStudent.id).toBe('1');
            expect(updatedStudent.adNo).toBe('AD001');
            expect(updatedStudent.name).toBe('John Doe');
            expect(updatedStudent.className).toBe('S1');
            expect(updatedStudent.semester).toBe('Odd');
            expect(updatedStudent.rank).toBe(5);
        });
    });

    describe('updateRank', () => {
        it('should update rank while preserving other properties', () => {
            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd',
                marks: mockMarks,
                grandTotal: 175,
                average: 58.33,
                performanceLevel: 'Average'
            });

            const updatedStudent = student.updateRank(3);

            expect(updatedStudent.rank).toBe(3);
            expect(updatedStudent.id).toBe('1');
            expect(updatedStudent.marks).toEqual(mockMarks);
            expect(updatedStudent.grandTotal).toBe(175);
            expect(updatedStudent.average).toBe(58.33);
            expect(updatedStudent.performanceLevel).toBe('Average');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty marks object', () => {
            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd',
                marks: {}
            });

            expect(student.calculateGrandTotal()).toBe(0);
            expect(student.calculateAverage()).toBe(0);
            expect(student.hasPassedAllSubjects()).toBe(true);
            expect(student.getFailedSubjects()).toEqual([]);
        });

        it('should handle marks with zero values', () => {
            const zeroMarks: Record<string, SubjectMarks> = {
                'math': { ta: 0, ce: 0, total: 0, status: 'Failed' }
            };

            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd',
                marks: zeroMarks
            });

            expect(student.calculateGrandTotal()).toBe(0);
            expect(student.calculateAverage()).toBe(0);
            expect(student.hasPassedAllSubjects()).toBe(false);
            expect(student.getFailedSubjects()).toEqual(['math']);
        });

        it('should round average to 2 decimal places', () => {
            const student = Student.create({
                id: '1',
                adNo: 'AD001',
                name: 'John Doe',
                className: 'S1',
                semester: 'Odd'
            });

            // Create marks that result in a repeating decimal
            const marks: SubjectMarks = { ta: 33, ce: 34, total: 67, status: 'Passed' };
            const updatedStudent = student.updateMarks('math', marks);

            expect(updatedStudent.average).toBe(67); // Should be exactly 67, not 66.999...
        });
    });
});