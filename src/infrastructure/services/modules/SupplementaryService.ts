import {
    collection,
    doc,
    getDocs,
    addDoc,
    updateDoc,
    query,
    where,
    writeBatch,
    deleteDoc
} from 'firebase/firestore';
import { BaseDataService } from './BaseDataService';
import { StudentService } from './StudentService';
import { AcademicService } from './AcademicService';
import { 
    SupplementaryExam, 
    StudentRecord, 
    StudentApplication,
    SupplementaryExamType
} from '../../../domain/entities/types';

export class SupplementaryService extends BaseDataService {
    constructor(
        private studentService: StudentService,
        private academicService: AcademicService
    ) {
        super();
    }

    public async getAllSupplementaryExams(termKey?: string): Promise<(SupplementaryExam & { studentName?: string; studentAdNo?: string; subjectName?: string, studentClass?: string })[]> {
        try {
            let q = query(collection(this.db, this.supplementaryExamsCollection));
            
            if (termKey && termKey !== 'All') {
                q = query(q, where('examTerm', '==', termKey));
            }

            const snapshot = await getDocs(q);
            const exams = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SupplementaryExam));

            // Enrich with student and subject details
            const [allStudents, allSubjects] = await Promise.all([
                this.studentService.getAllStudents('All'),
                this.academicService.getRawAllSubjects()
            ]);
            
            const studentMap = new Map(allStudents.map(s => [s.id, s]));
            const subjectMap = new Map(allSubjects.map(s => [s.id, s]));

            return exams.map(exam => {
                const student = studentMap.get(exam.studentId);
                const subject = subjectMap.get(exam.subjectId);
                
                // Prioritize resolving class from the term being viewed or recorded
                const resolutionTerm = (termKey && termKey !== 'All') ? termKey : (exam.examTerm || exam.originalTerm);
                let historicalClass = (resolutionTerm && student?.academicHistory?.[resolutionTerm]?.className) || 
                                      (exam.originalTerm && student?.academicHistory?.[exam.originalTerm]?.className) ||
                                      student?.currentClass || 
                                      student?.className || 
                                      'Unknown';

                // Restore historical nomenclature using centralized helper
                historicalClass = this.getHistoricalClassName(resolutionTerm, historicalClass);

                return {
                    ...exam,
                    studentName: student?.name || (exam as any).studentName || 'Not Registered',
                    studentAdNo: student?.adNo || (exam as any).studentAdNo || exam.studentId,
                    subjectName: subject?.name || 'Unknown Subject',
                    studentClass: historicalClass
                };
            })
            .filter(exam => exam.subjectName !== 'Unknown Subject' && exam.subjectId);
        } catch (error) {
            console.error('Error fetching all supplementary exams:', error);
            return [];
        }
    }

    public async syncApplicationToSupplementary(
        application: StudentApplication, 
        existingStudent?: StudentRecord,
        originalYear?: string,
        originalSemester?: string,
        examTerm?: string
    ): Promise<void> {
        try {
            let studentId = application.studentId;
            if (!studentId && !existingStudent) {
                let student = await this.studentService.getStudentByAdNo(application.adNo.trim());
                if (!student) {
                    const allStudents = await this.studentService.getAllStudents();
                    student = allStudents.find(s => s.adNo.trim().toLowerCase() === application.adNo.trim().toLowerCase());
                }
                if (student) {
                    studentId = student.id;
                    existingStudent = student;
                }
            } else if (existingStudent) {
                studentId = existingStudent.id;
            }

            const activeTerm = this.getCurrentTermKey();
            const targetExamTerm = examTerm || activeTerm;
            
            let failureTerm = (originalYear && originalSemester) ? `${originalYear}-${originalSemester}` : undefined;
            let failureMarks = undefined;

            if (existingStudent && existingStudent.academicHistory) {
                const historyEntries = Object.entries(existingStudent.academicHistory);
                for (const [termKey, termRecord] of historyEntries) {
                    const subMark = termRecord.marks[application.subjectId];
                    if (subMark && subMark.status === 'Failed') {
                        if (!failureTerm) failureTerm = termKey;
                        failureMarks = { int: subMark.int || 0, ext: subMark.ext || 0 };
                        break; 
                    }
                }
            }

            if (!failureTerm) {
                failureTerm = `${application.appliedYear}-${application.appliedSemester}`;
            }

            const q = query(collection(this.db, this.supplementaryExamsCollection), where('applicationId', '==', application.id));
            const snapshot = await getDocs(q);
            
            const updates: any = { 
                studentId: studentId || application.adNo,
                studentName: existingStudent?.name || application.studentName || '',
                studentAdNo: application.adNo,
                applicationId: application.id,
                applicationType: application.type,
                subjectId: application.subjectId,
                examTerm: targetExamTerm,
                originalTerm: failureTerm,
                updatedAt: Date.now()
            };

            if (failureMarks) {
                updates.previousMarks = failureMarks;
            }

            if (!snapshot.empty) {
                const existingDoc = snapshot.docs[0];
                await updateDoc(existingDoc.ref, updates);
            } else {
                const suppExam: SupplementaryExam = {
                    ...updates,
                    examType: 'CurrentSemester' as SupplementaryExamType,
                    attemptNumber: 1,
                    originalSemester: (failureTerm.split('-').pop() as 'Odd' | 'Even') || 'Odd',
                    originalYear: parseInt(failureTerm.split('-')[0]),
                    supplementaryYear: parseInt(targetExamTerm.split('-')[0]),
                    status: 'Pending',
                    marks: { int: 0, ext: 0, total: 0, status: 'Pending' },
                    appliedAt: application.createdAt || Date.now(),
                    createdAt: Date.now()
                };
                await addDoc(collection(this.db, this.supplementaryExamsCollection), suppExam);
            }
        } catch (error) {
            console.error('Error syncing application:', error);
        }
    }

    public async addSupplementaryExam(exam: Omit<SupplementaryExam, 'id'>): Promise<string> {
        try {
            const docRef = await addDoc(collection(this.db, this.supplementaryExamsCollection), {
                ...exam,
                appliedAt: Date.now(),
                updatedAt: Date.now()
            });
            return docRef.id;
        } catch (error) {
            console.error('Error adding supplementary exam:', error);
            throw error;
        }
    }

    public async deleteSupplementaryExam(examId: string): Promise<void> {
        try {
            await deleteDoc(doc(this.db, this.supplementaryExamsCollection, examId));
        } catch (error) {
            console.error('Error deleting supplementary exam:', error);
            throw error;
        }
    }

    public async getSupplementaryExamHistory(studentId: string, subjectId: string): Promise<SupplementaryExam[]> {
        try {
            const q = query(
                collection(this.db, this.supplementaryExamsCollection),
                where('studentId', '==', studentId),
                where('subjectId', '==', subjectId)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SupplementaryExam));
        } catch (error) {
            console.error('Error fetching supplementary exam history:', error);
            return [];
        }
    }

    public async updateSupplementaryExamMarks(
        examId: string, 
        marks: { int: number | 'A'; ext: number | 'A'; total: number; status: 'Passed' | 'Failed' | 'Pending' },
        previousMarks?: { int: number | 'A'; ext: number | 'A' },
        attemptNumber?: number,
        originalTerm?: string
    ): Promise<void> {
        try {
            const docRef = doc(this.db, this.supplementaryExamsCollection, examId);
            const status = marks.status === 'Passed' ? 'Completed' : marks.status;
            
            const updateData: any = {
                marks,
                status,
                updatedAt: Date.now()
            };
            if (previousMarks) updateData.previousMarks = previousMarks;
            if (attemptNumber) updateData.attemptNumber = attemptNumber;
            if (originalTerm) updateData.originalTerm = originalTerm;

            await updateDoc(docRef, updateData);

            if (marks.status === 'Passed') {
                const exams = await this.getAllSupplementaryExams();
                const exam = exams.find(e => e.id === examId);
                
                if (exam && exam.studentId && exam.originalTerm) {
                    const student = await this.studentService.getStudentById(exam.studentId);
                    if (student && student.academicHistory && student.academicHistory[exam.originalTerm]) {
                        const history = student.academicHistory[exam.originalTerm];
                        
                        const updatedMarks = { ...history.marks };
                        updatedMarks[exam.subjectId] = {
                            ...updatedMarks[exam.subjectId],
                            ...marks,
                            isSupplementary: true,
                            supplementaryYear: exam.supplementaryYear
                        };

                        const allSubjects = await this.academicService.getRawAllSubjects();
                        const { grandTotal, average, performanceLevel } = this.academicService.calculateTermMetrics(updatedMarks, allSubjects);

                        const studentDocRef = doc(this.db, this.studentsCollection, exam.studentId);
                        await updateDoc(studentDocRef, {
                            [`academicHistory.${exam.originalTerm}.marks`]: updatedMarks,
                            [`academicHistory.${exam.originalTerm}.grandTotal`]: grandTotal,
                            [`academicHistory.${exam.originalTerm}.average`]: average,
                            [`academicHistory.${exam.originalTerm}.performanceLevel`]: performanceLevel
                        });

                        this.studentService.updateStudentInCache(exam.studentId, {
                            academicHistory: {
                                ...student.academicHistory,
                                [exam.originalTerm]: {
                                    ...history,
                                    marks: updatedMarks,
                                    grandTotal,
                                    average,
                                    performanceLevel
                                }
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error updating supplementary marks:', error);
            throw error;
        }
    }
}
