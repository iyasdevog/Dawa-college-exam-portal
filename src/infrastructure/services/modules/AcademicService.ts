import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where
} from 'firebase/firestore';
import { BaseDataService } from './BaseDataService';
import { 
    SubjectConfig, 
    SubjectMarks, 
    PerformanceLevel,
    StudentRecord,
    GlobalSettings,
    AcademicHistory,
    SubjectSnapshot,
    TermRecord
} from '../../../domain/entities/types';
import { normalizeName } from '../formatUtils';
import { ExcelUtils } from '../../utils/excelUtils';

export class AcademicService extends BaseDataService {
    /**
     * Calculates the performance level (O, A+, etc.) based on subject marks.
     */
    public calculatePerformanceLevel(marks: Record<string, SubjectMarks>, subjects: SubjectConfig[]): PerformanceLevel {
        const marksEntries = Object.entries(marks);
        if (marksEntries.length === 0) return 'Pending' as PerformanceLevel;

        let hasMarks = false;
        let minPercentage = 100;
        let hasFailedSubject = false;

        for (const [subjectId, mark] of marksEntries) {
            const subject = subjects.find(s => s.id === subjectId);
            if (!subject) continue;

            const totalMax = (subject.maxINT || 0) + (subject.maxEXT || 0);
            if (totalMax === 0) continue;

            hasMarks = true;
            
            if (mark.status === 'Failed') {
                hasFailedSubject = true;
            }

            const percentage = (this.getMarkValue(mark.total) / totalMax) * 100;
            if (percentage < minPercentage) {
                minPercentage = percentage;
            }
        }

        if (hasFailedSubject || minPercentage < 40) return 'F (Failed)';
        if (!hasMarks) return 'C (Average)';

        if (minPercentage >= 95) return 'O (Outstanding)';
        if (minPercentage >= 85) return 'A+ (Excellent)';
        if (minPercentage >= 75) return 'A (Very Good)';
        if (minPercentage >= 65) return 'B+ (Good)';
        if (minPercentage >= 55) return 'B (Good)';
        return 'C (Average)';
    }

    /**
     * Centralized logic to calculate grandTotal, average and performanceLevel for a term.
     */
    public calculateTermMetrics(marks: Record<string, SubjectMarks>, subjects: SubjectConfig[], supplementaryMarks?: Record<string, SubjectMarks>): {
        grandTotal: number;
        average: number;
        performanceLevel: PerformanceLevel;
    } {
        const combinedMarks: Record<string, SubjectMarks> = { ...marks };
        
        if (supplementaryMarks) {
            Object.entries(supplementaryMarks).forEach(([subId, suppMark]) => {
                if (suppMark.status === 'Passed') {
                    combinedMarks[subId] = suppMark;
                }
            });
        }

        const marksEntries = Object.entries(combinedMarks);
        const grandTotal = marksEntries.reduce((sum, [_, mark]) => sum + this.getMarkValue(mark.total), 0);

        const subjectCount = Object.keys(combinedMarks).length;
        let average = subjectCount > 0 ? grandTotal / subjectCount : 0;
        if (isNaN(average)) average = 0;
        average = Math.round(average * 100) / 100;

        const performanceLevel = this.calculatePerformanceLevel(combinedMarks, subjects);

        return { grandTotal, average, performanceLevel };
    }

    public async getAllSubjects(termKey?: string): Promise<SubjectConfig[]> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            
            // Robust parsing: Semester is the part after the LAST hyphen
            const lastHyphenIndex = activeTerm.lastIndexOf('-');
            let targetYear = '';
            let targetSem = '';
            
            if (lastHyphenIndex !== -1) {
                targetYear = activeTerm.substring(0, lastHyphenIndex);
                targetSem = activeTerm.substring(lastHyphenIndex + 1);
            } else {
                targetYear = activeTerm;
                targetSem = '';
            }

            const snapshot = await getDocs(collection(this.db, this.subjectsCollection));
            const allSubjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubjectConfig));
            
            return allSubjects.filter(subject => {
                const subjectYear = subject.academicYear;
                
                // Use strict matching for year to prevent "2026" matching "2025-2026"
                const isYearMatch = !subjectYear || subjectYear === targetYear;

                if (subject.activeSemester && subject.activeSemester !== 'Both' && subject.activeSemester !== targetSem) {
                    return false;
                }
                
                if (subjectYear && !isYearMatch) {
                    return false;
                }

                if (!subjectYear) {
                    const hasYearSpecificVersion = allSubjects.some(s => 
                        s.name === subject.name && 
                        s.academicYear && (s.academicYear === targetYear || targetYear.includes(s.academicYear)) &&
                        (s.activeSemester === 'Both' || s.activeSemester === targetSem)
                    );
                    if (hasYearSpecificVersion) return false;
                }
                
                return true;
            });
        } catch (error) {
            console.error('Error fetching all subjects:', error);
            return [];
        }
    }

    public async getSubjectById(id: string): Promise<SubjectConfig | null> {
        try {
            const docRef = doc(this.db, this.subjectsCollection, id);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as SubjectConfig : null;
        } catch (error) {
            console.error('Error fetching subject:', error);
            return null;
        }
    }

    public async addSubject(subject: Omit<SubjectConfig, 'id'>): Promise<string> {
        try {
            const normalizedSubject = {
                ...subject,
                facultyName: subject.facultyName ? normalizeName(subject.facultyName) : ''
            };
            const docRef = await addDoc(collection(this.db, this.subjectsCollection), normalizedSubject);
            return docRef.id;
        } catch (error) {
            console.error('Error adding subject:', error);
            throw error;
        }
    }

    public async updateSubject(id: string, updates: Partial<SubjectConfig>): Promise<void> {
        try {
            const docRef = doc(this.db, this.subjectsCollection, id);
            const normalizedUpdates = { ...updates };
            if (updates.facultyName !== undefined) {
                normalizedUpdates.facultyName = updates.facultyName ? normalizeName(updates.facultyName) : '';
            }
            await updateDoc(docRef, normalizedUpdates);
        } catch (error) {
            console.error('Error updating subject:', error);
            throw error;
        }
    }

    public async deleteSubject(id: string): Promise<void> {
        try {
            const docRef = doc(this.db, this.subjectsCollection, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error('Error deleting subject:', error);
            throw error;
        }
    }

    public async getSupplementaryExamsByStudent(studentId: string): Promise<any[]> {
        // This will be properly implemented when we have a SupplementaryService link
        // For now, it's a bridge to satisfy DataService interface
        return [];
    }

    public async getSubjectsByClass(className: string, termKey?: string): Promise<SubjectConfig[]> {
        const subjects = await this.getAllSubjects(termKey);
        return subjects.filter(s => s.targetClasses?.includes(className));
    }

    public async enrollStudentInSubject(subjectId: string, studentId: string): Promise<void> {
        try {
            const subject = await this.getSubjectById(subjectId);
            if (subject) {
                const enrolled = subject.enrolledStudents || [];
                if (!enrolled.includes(studentId)) {
                    await this.updateSubject(subjectId, { enrolledStudents: [...enrolled, studentId] });
                }
            }
        } catch (error) {
            console.error('Error enrolling student in subject:', error);
            throw error;
        }
    }

    public async unenrollStudentFromSubject(subjectId: string, studentId: string): Promise<void> {
        try {
            const subject = await this.getSubjectById(subjectId);
            if (subject) {
                const enrolled = subject.enrolledStudents || [];
                const updated = enrolled.filter(id => id !== studentId);
                await this.updateSubject(subjectId, { enrolledStudents: updated });
            }
        } catch (error) {
            console.error('Error unenrolling student from subject:', error);
            throw error;
        }
    }

    public async updateMarks(studentId: string, subjectId: string, marks: Partial<SubjectMarks>, termKey?: string): Promise<void> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            const studentDocRef = doc(this.db, this.studentsCollection, studentId);
            const studentSnap = await getDoc(studentDocRef);
            
            if (studentSnap.exists()) {
                const data = studentSnap.data();
                const history = data.academicHistory || {};
                const termData = history[activeTerm] || {};
                const currentMarks = termData.marks || {};
                
                const existingMark = currentMarks[subjectId] || {};
                const newInt = marks.int !== undefined ? Number(marks.int) || 0 : (existingMark.int || 0);
                const newExt = marks.ext !== undefined ? Number(marks.ext) || 0 : (existingMark.ext || 0);
                
                const updatedMark: SubjectMarks = {
                    ...existingMark,
                    int: newInt,
                    ext: newExt,
                    total: newInt + newExt,
                    status: (newInt + newExt) >= 40 ? 'Passed' : 'Failed',
                    updatedAt: Date.now()
                };

                currentMarks[subjectId] = updatedMark;
                
                // --- METADATA SNAPSHOTTING ---
                const subjectMetadata = termData.subjectMetadata || {};
                const currentSubject = await this.getSubjectById(subjectId);
                if (currentSubject) {
                    subjectMetadata[subjectId] = {
                        name: currentSubject.name,
                        arabicName: currentSubject.arabicName,
                        maxINT: currentSubject.maxINT,
                        maxEXT: currentSubject.maxEXT,
                        passingTotal: currentSubject.passingTotal,
                        facultyName: currentSubject.facultyName,
                        subjectType: currentSubject.subjectType
                    };
                }
                
                const allSubjects = await this.getRawAllSubjects();
                const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(currentMarks, allSubjects);

                await updateDoc(studentDocRef, {
                    [`academicHistory.${activeTerm}.marks`]: currentMarks,
                    [`academicHistory.${activeTerm}.subjectMetadata`]: subjectMetadata,
                    [`academicHistory.${activeTerm}.grandTotal`]: grandTotal,
                    [`academicHistory.${activeTerm}.average`]: average,
                    [`academicHistory.${activeTerm}.performanceLevel`]: performanceLevel
                });
                
                this.invalidateCache();
            }
        } catch (error) {
            console.error('Error updating marks:', error);
            throw error;
        }
    }

    public async getRankings(className: string, termKey?: string): Promise<any[]> {
        // Implementation of getRankings usually involves fetching all students in the class
        // and sorting them by grandTotal. This is better coordinated via DataService facade
        // or a dedicated ReportingService, but for compatibility we'll implement it here.
        const activeTerm = termKey || this.getCurrentTermKey();
        const studentsSnap = await getDocs(query(collection(this.db, this.studentsCollection)));
        const classStudents = studentsSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .filter(s => (s.currentClass === className || s.className === className) && s.academicHistory?.[activeTerm])
            .map(s => {
                const history = s.academicHistory[activeTerm];
                return {
                    id: s.id,
                    name: s.name,
                    adNo: s.adNo,
                    grandTotal: history.grandTotal || 0,
                    average: history.average || 0,
                    performanceLevel: history.performanceLevel || ('Pending' as PerformanceLevel)
                };
            })
            .sort((a, b) => b.grandTotal - a.grandTotal);

        return classStudents.map((s, index) => ({ ...s, rank: index + 1 }));
    }

    /**
     * Internal raw fetch for all subjects, bypassing filters.
     */
    public async getRawAllSubjects(): Promise<SubjectConfig[]> {
        const snapshot = await getDocs(collection(this.db, this.subjectsCollection));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubjectConfig));
    }

    /**
     * Calculates summary metrics for all semesters discovered in student histories.
     */
    public async getSemesterSummaries(): Promise<any[]> {
        try {
            const students = await getDocs(collection(this.db, this.studentsCollection));
            const termStats: Record<string, { studentCount: number; passedCount: number; totalMarks: number }> = {};

            students.docs.forEach(doc => {
                const data = doc.data();
                if (data.academicHistory) {
                    Object.entries(data.academicHistory).forEach(([termKey, history]: [string, any]) => {
                        if (!termStats[termKey]) {
                            termStats[termKey] = { studentCount: 0, passedCount: 0, totalMarks: 0 };
                        }
                        termStats[termKey].studentCount++;
                        if (history.performanceLevel && !history.performanceLevel.includes('Failed')) {
                            termStats[termKey].passedCount++;
                        }
                        termStats[termKey].totalMarks += (history.grandTotal || 0);
                    });
                }
            });

            return Object.entries(termStats).map(([termKey, stats]) => {
                const lastHyphenIndex = termKey.lastIndexOf('-');
                let academicYear = termKey;
                let semester = '';

                if (lastHyphenIndex !== -1) {
                    academicYear = termKey.substring(0, lastHyphenIndex);
                    semester = termKey.substring(lastHyphenIndex + 1);
                    
                    // Further check: If the 'semester' part doesn't look like Odd/Even, 
                    // it might be part of a YYYY-YYYY year.
                    if (semester !== 'Odd' && semester !== 'Even') {
                        academicYear = termKey;
                        semester = 'Inconsistent';
                    }
                } else {
                    semester = 'Inconsistent';
                }

                return {
                    termKey,
                    academicYear,
                    semester,
                    studentCount: stats.studentCount,
                    passPercentage: stats.studentCount > 0 ? Math.round((stats.passedCount / stats.studentCount) * 100) : 0,
                    averageScore: stats.studentCount > 0 ? Math.round(stats.totalMarks / stats.studentCount) : 0
                };
            }).sort((a, b) => b.termKey.localeCompare(a.termKey));
        } catch (error) {
            console.error('Error fetching semester summaries:', error);
            return [];
        }
    }

    /**
     * Normalizes all faculty names in the subjects collection.
     */
    public async normalizeAllFacultyNames(): Promise<number> {
        try {
            const subjects = await this.getRawAllSubjects();
            let count = 0;
            
            await this.runBatchedOperation(subjects, (batch, subject) => {
                if (subject.facultyName) {
                    const normalized = normalizeName(subject.facultyName);
                    if (normalized !== subject.facultyName) {
                        const docRef = doc(this.db, this.subjectsCollection, subject.id);
                        batch.update(docRef, { facultyName: normalized });
                        count++;
                    }
                }
            });
            
            this.invalidateCache();
            return count;
        } catch (error) {
            console.error('Error normalizing faculty names:', error);
            throw error;
        }
    }

    public async recalculateAllMarkStatuses(targetTermKey?: string): Promise<{ updated: number }> {
        try {
            const students = await getDocs(collection(this.db, this.studentsCollection));
            let updatedCount = 0;

            await this.runBatchedOperation(students.docs, (batch, d) => {
                const data = d.data();
                const history = data.academicHistory || {};
                let changed = false;

                const keys = targetTermKey ? [targetTermKey] : Object.keys(history);

                keys.forEach(termKey => {
                    const termData = history[termKey];
                    if (termData && termData.marks) {
                        Object.entries(termData.marks).forEach(([subId, mark]: [string, any]) => {
                            const total = (mark.int || 0) + (mark.ext || 0);
                            const status = total >= 40 ? 'Passed' : 'Failed';
                            if (mark.total !== total || mark.status !== status) {
                                termData.marks[subId] = { ...mark, total, status };
                                changed = true;
                            }
                        });
                    }
                });

                if (changed) {
                    batch.update(d.ref, { academicHistory: history });
                    updatedCount++;
                }
            });

            return { updated: updatedCount };
        } catch (error) {
            console.error('Error recalculating mark statuses:', error);
            throw error;
        }
    }

    public async recalculateAllStudentTotals(targetTermKey?: string): Promise<{ updated: number }> {
        try {
            const subjects = await this.getRawAllSubjects();
            const students = await getDocs(collection(this.db, this.studentsCollection));
            let updatedCount = 0;

            await this.runBatchedOperation(students.docs, (batch, d) => {
                const data = d.data();
                const history = data.academicHistory || {};
                let changed = false;

                const keys = targetTermKey ? [targetTermKey] : Object.keys(history);

                keys.forEach(termKey => {
                    const termData = history[termKey];
                    if (termData && termData.marks) {
                        const { grandTotal, average } = this.calculateTermMetrics(termData.marks, subjects);
                        if (termData.grandTotal !== grandTotal || termData.average !== average) {
                            termData.grandTotal = grandTotal;
                            termData.average = average;
                            changed = true;
                        }
                    }
                });

                if (changed) {
                    batch.update(d.ref, { academicHistory: history });
                    updatedCount++;
                }
            });

            return { updated: updatedCount };
        } catch (error) {
            console.error('Error recalculating student totals:', error);
            throw error;
        }
    }

    public async recalculateAllStudentPerformanceLevels(targetTermKey?: string): Promise<{ updated: number }> {
        try {
            const subjects = await this.getRawAllSubjects();
            const students = await getDocs(collection(this.db, this.studentsCollection));
            let updatedCount = 0;

            await this.runBatchedOperation(students.docs, (batch, d) => {
                const data = d.data();
                const history = data.academicHistory || {};
                let changed = false;

                const keys = targetTermKey ? [targetTermKey] : Object.keys(history);

                keys.forEach(termKey => {
                    const termData = history[termKey];
                    if (termData && termData.marks) {
                        const { performanceLevel } = this.calculateTermMetrics(termData.marks, subjects);
                        if (termData.performanceLevel !== performanceLevel) {
                            termData.performanceLevel = performanceLevel;
                            changed = true;
                        }
                    }
                });

                if (changed) {
                    batch.update(d.ref, { academicHistory: history });
                    updatedCount++;
                }
            });

            return { updated: updatedCount };
        } catch (error) {
            console.error('Error recalculating performance levels:', error);
            throw error;
        }
    }








    public async exportMarksToExcel(className: string, termKey: string): Promise<void> {
        try {
            const studentsSnapshot = await getDocs(collection(this.db, this.studentsCollection));
            const classStudents = studentsSnapshot.docs
                .map(d => ({ id: d.id, ...d.data() } as StudentRecord))
                .filter(s => (s.currentClass === className || s.className === className) && s.academicHistory?.[termKey]);
            
            if (classStudents.length === 0) {
                throw new Error('No student data found for this class and term.');
            }

            const subjects = await this.getAllSubjects(termKey);
            const classSubjects = subjects.filter(s => s.targetClasses?.includes(className));

            const excelData = classStudents.map(student => {
                const row: any = {
                    'Admission No': student.adNo,
                    'Student Name': student.name
                };

                classSubjects.forEach(sub => {
                    const mark = student.academicHistory![termKey].marks[sub.id];
                    row[`${sub.name} (INT)`] = mark?.int || 0;
                    row[`${sub.name} (EXT)`] = mark?.ext || 0;
                    row[`${sub.name} (Total)`] = mark?.total || 0;
                });

                row['Grand Total'] = student.academicHistory![termKey].grandTotal;
                row['Average'] = student.academicHistory![termKey].average;
                row['Performance'] = student.academicHistory![termKey].performanceLevel;
                return row;
            });

            await ExcelUtils.exportToExcel(`Marks_${className}_${termKey}.xlsx`, [
                { name: 'Marks', data: excelData }
            ]);
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            throw error;
        }
    }

    public async importMarksFromExcel(file: File, termKey: string): Promise<{ updated: number; errors: string[] }> {
        try {
            const json = await ExcelUtils.parseExcelFile(file);
            const subjects = await this.getRawAllSubjects();
            let updated = 0;
            const errors: string[] = [];

            for (const row of json) {
                const adNo = row['Admission No']?.toString();
                if (!adNo) continue;

                const q = query(collection(this.db, this.studentsCollection), where('adNo', '==', adNo));
                const snap = await getDocs(q);
                if (snap.empty) {
                    errors.push(`Student with AdNo ${adNo} not found.`);
                    continue;
                }

                const studentDoc = snap.docs[0];
                const studentData = studentDoc.data();
                const history = studentData.academicHistory || {};
                const termData = history[termKey] || { marks: {} };
                const newMarks = { ...termData.marks };

                let rowChanged = false;
                Object.keys(row).forEach(key => {
                    if (key.includes('(INT)') || key.includes('(EXT)')) {
                        const subName = key.split('(')[0].trim();
                        const isInt = key.includes('(INT)');
                        const subject = subjects.find(s => s.name === subName);
                        if (subject) {
                            const val = parseInt(row[key]) || 0;
                            const subId = subject.id;
                            if (!newMarks[subId]) newMarks[subId] = { int: 0, ext: 0, total: 0, status: 'Pending' };
                            
                            if (isInt) newMarks[subId].int = val;
                            else newMarks[subId].ext = val;
                            
                            newMarks[subId].total = (newMarks[subId].int || 0) + (newMarks[subId].ext || 0);
                            newMarks[subId].status = newMarks[subId].total >= 40 ? 'Passed' : 'Failed';
                            rowChanged = true;
                        }
                    }
                });

                if (rowChanged) {
                    const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(newMarks, subjects);
                    
                    // Capture snapshots for imported subjects
                    const snapshotData: Record<string, SubjectSnapshot> = termData.subjectMetadata || {};
                    Object.keys(newMarks).forEach(subId => {
                        const subConfig = subjects.find(s => s.id === subId);
                        if (subConfig && !snapshotData[subId]) {
                            snapshotData[subId] = {
                                name: subConfig.name,
                                arabicName: subConfig.arabicName || '',
                                facultyName: subConfig.facultyName || '',
                                maxINT: subConfig.maxINT,
                                maxEXT: subConfig.maxEXT,
                                passingTotal: subConfig.passingTotal || 40,
                                subjectType: subConfig.subjectType || 'general',
                                timestamp: Date.now()
                            };
                        }
                    });

                    await updateDoc(studentDoc.ref, {
                        [`academicHistory.${termKey}.marks`]: newMarks,
                        [`academicHistory.${termKey}.subjectMetadata`]: snapshotData,
                        [`academicHistory.${termKey}.grandTotal`]: grandTotal,
                        [`academicHistory.${termKey}.average`]: average,
                        [`academicHistory.${termKey}.performanceLevel`]: performanceLevel
                    });
                    updated++;
                }
            }
            return { updated, errors };
        } catch (err) {
            console.error('Error importing marks from Excel:', err);
            throw err;
        }
    }
    public async getEnrolledStudentsForSubject(subjectId: string, termKey?: string): Promise<string[]> {
        const subject = await this.getSubjectById(subjectId);
        return subject?.enrolledStudents || [];
    }

    public async clearStudentSubjectMarks(studentId: string, subjectId: string, termKey?: string): Promise<void> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            const studentDocRef = doc(this.db, this.studentsCollection, studentId);
            const studentSnap = await getDoc(studentDocRef);

            if (studentSnap.exists()) {
                const data = studentSnap.data();
                const history = data.academicHistory || {};
                const termData = history[activeTerm] || {};
                const currentMarks = termData.marks || {};

                delete currentMarks[subjectId];

                const allSubjects = await this.getRawAllSubjects();
                const { grandTotal, average, performanceLevel } = this.calculateTermMetrics(currentMarks, allSubjects);

                await updateDoc(studentDocRef, {
                    [`academicHistory.${activeTerm}.marks`]: currentMarks,
                    [`academicHistory.${activeTerm}.grandTotal`]: grandTotal,
                    [`academicHistory.${activeTerm}.average`]: average,
                    [`academicHistory.${activeTerm}.performanceLevel`]: performanceLevel
                });
                this.invalidateCache();
            }
        } catch (error) {
            console.error('Error clearing student marks:', error);
            throw error;
        }
    }

    public async clearSubjectMarks(subjectId: string, studentIds: string[], termKey?: string): Promise<void> {
        for (const id of studentIds) {
            await this.clearStudentSubjectMarks(id, subjectId, termKey);
        }
    }

    public async clearSubjectINTMarks(subjectId: string, studentIds: string[], termKey?: string): Promise<void> {
        const activeTerm = termKey || this.getCurrentTermKey();
        for (const id of studentIds) {
            const studentDocRef = doc(this.db, this.studentsCollection, id);
            const studentSnap = await getDoc(studentDocRef);
            if (studentSnap.exists()) {
                const marks = studentSnap.data().academicHistory?.[activeTerm]?.marks?.[subjectId];
                if (marks) {
                    await this.updateMarks(id, subjectId, { ...marks, int: 0 }, termKey);
                }
            }
        }
    }

    public async clearSubjectEXTMarks(subjectId: string, studentIds: string[], termKey?: string): Promise<void> {
        const activeTerm = termKey || this.getCurrentTermKey();
        for (const id of studentIds) {
            const studentDocRef = doc(this.db, this.studentsCollection, id);
            const studentSnap = await getDoc(studentDocRef);
            if (studentSnap.exists()) {
                const marks = studentSnap.data().academicHistory?.[activeTerm]?.marks?.[subjectId];
                if (marks) {
                    await this.updateMarks(id, subjectId, { ...marks, ext: 0 }, termKey);
                }
            }
        }
    }

    public async bulkUpdateMarks(updates: Array<{ studentId: string, subjectId: string, marks: Partial<SubjectMarks> }>, termKey?: string): Promise<void> {
        for (const update of updates) {
            await this.updateMarks(update.studentId, update.subjectId, update.marks, termKey);
        }
    }

    public async updateStudentINTMarks(studentId: string, subjectId: string, marks: Partial<SubjectMarks>, termKey?: string): Promise<void> {
        return this.updateMarks(studentId, subjectId, marks, termKey);
    }

    public async bulkUpdateEXTMarks(updates: Array<{ studentId: string, subjectId: string, ext: number }>, termKey?: string): Promise<void> {
        for (const update of updates) {
            await this.updateMarks(update.studentId, update.subjectId, { ext: update.ext }, termKey);
        }
    }
}
