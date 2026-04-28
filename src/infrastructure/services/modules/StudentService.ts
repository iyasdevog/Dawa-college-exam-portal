import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    writeBatch,
    query,
    where
} from 'firebase/firestore';
import { BaseDataService } from './BaseDataService';
import { 
    StudentRecord, 
    SubjectMarks, 
    PerformanceLevel,
    GlobalSettings
} from '../../../domain/entities/types';
import { ExcelUtils } from '../../utils/excelUtils';

export class StudentService extends BaseDataService {
    /**
     * Imports students from an Excel file.
     */
    public async importStudentsFromExcel(file: File): Promise<{ updated: number; created: number; errors: string[] }> {
        try {
            const json = await ExcelUtils.parseExcelFile(file);
            const studentData = ExcelUtils.parseStudentData(json);
            return await this.bulkImportStudents(studentData);
        } catch (error) {
            console.error('Error importing students from Excel:', error);
            throw error;
        }
    }

    /**
     * Parses student CSV data from a File or raw string.
     */
    public async parseStudentCSV(input: File | string): Promise<{ students: any[], errors: string[] }> {
        if (typeof input === 'string') {
            try {
                const lines = input.split('\n');
                if (lines.length === 0) return { students: [], errors: ['CSV data is empty'] };
                
                const headers = lines[0].split(',').map(h => h.trim());
                const data = lines.slice(1).filter(line => line.trim()).map(line => {
                    const values = line.split(',').map(v => v.trim());
                    const obj: any = {};
                    headers.forEach((header, index) => {
                        obj[header] = values[index];
                    });
                    return obj;
                });
                const parsed = ExcelUtils.parseStudentData(data);
                return { students: parsed, errors: [] };
            } catch (error) {
                return { students: [], errors: [error instanceof Error ? error.message : 'Unknown CSV parsing error'] };
            }
        }

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target?.result as string;
                    this.parseStudentCSV(text).then(resolve);
                } catch (error) {
                    resolve({ students: [], errors: [error instanceof Error ? error.message : 'Unknown CSV parsing error'] });
                }
            };
            reader.onerror = () => resolve({ students: [], errors: ['File reading error'] });
            reader.readAsText(input);
        });
    }

    /**
     * Deactivates a student record.
     */
    public async archiveStudent(id: string): Promise<void> {
        try {
            const docRef = doc(this.db, this.studentsCollection, id);
            await updateDoc(docRef, { isActive: false });
            this.invalidateCache();
        } catch (error) {
            console.error('Error archiving student:', error);
            throw error;
        }
    }

    /**
     * Bulk imports students into Firestore.
     * Phase 1: Async lookups to determine update vs create for each row.
     * Phase 2: Synchronous batch writes (no async inside the batch processor).
     */
    public async bulkImportStudents(students: any[]): Promise<{ updated: number; created: number; errors: string[] }> {
        let created = 0;
        let updated = 0;
        const errors: string[] = [];
        const termKey = this.getCurrentTermKey();

        // Phase 1: Resolve all async lookups BEFORE batching
        const operations: Array<{ type: 'update' | 'create'; data: any; existingId?: string }> = [];

        for (const studentData of students) {
            try {
                const adNo = studentData.adNo?.toString();
                if (!adNo) {
                    errors.push(`Row ${studentData.importRowNumber || '?'}: Missing admission number`);
                    continue;
                }

                const existing = await this.getStudentByAdNo(adNo);
                if (existing) {
                    operations.push({ type: 'update', data: studentData, existingId: existing.id });
                } else {
                    operations.push({ type: 'create', data: studentData });
                }
            } catch (err: any) {
                errors.push(`Row ${studentData.importRowNumber || studentData.adNo}: ${err.message}`);
            }
        }

        // Phase 2: Synchronous batch writes (no async inside the processor)
        await this.runBatchedOperation(operations, (batch, op) => {
            try {
                if (op.type === 'update' && op.existingId) {
                    const docRef = doc(this.db!, this.studentsCollection, op.existingId);
                    batch.update(docRef, {
                        name: op.data.name,
                        currentClass: op.data.className,
                        [`academicHistory.${termKey}.className`]: op.data.className,
                        [`academicHistory.${termKey}.semester`]: op.data.semester
                    });
                    updated++;
                } else if (op.type === 'create') {
                    const newStudentRef = doc(collection(this.db!, this.studentsCollection));
                    let rawSem = op.data.semester?.toString() || '';
                    let normalizedSem: 'Odd' | 'Even' = 'Odd';
                    if (rawSem.toLowerCase().includes('even') || rawSem.includes('2')) normalizedSem = 'Even';
                    else if (rawSem.toLowerCase().includes('odd') || rawSem.includes('1')) normalizedSem = 'Odd';

                    const newStudent = {
                        adNo: op.data.adNo?.toString(),
                        name: op.data.name,
                        currentClass: op.data.className,
                        isActive: true,
                        academicHistory: {
                            [termKey]: {
                                className: op.data.className,
                                semester: normalizedSem,
                                marks: {},
                                grandTotal: 0,
                                average: 0,
                                rank: 0,
                                performanceLevel: 'Pending'
                            }
                        }
                    };
                    batch.set(newStudentRef, newStudent);
                    created++;
                }
            } catch (err: any) {
                errors.push(`Row ${op.data.adNo}: ${err.message}`);
                console.error('Error in batch write for student:', err);
            }
        });

        this.invalidateCache();
        return { updated, created, errors };
    }

    /**
     * Bulk clones active students into a newly created semester.
     */
    public async bulkCloneStudentsToSemester(targetTermKey: string, semesterType: 'Odd' | 'Even'): Promise<number> {
        try {
            const snapshot = await getDocs(collection(this.db, this.studentsCollection));
            let clonedCount = 0;
            
            await this.runBatchedOperation(snapshot.docs, (batch, docSnap) => {
                const student = docSnap.data() as StudentRecord;
                
                // Only clone active students who don't already have this term
                if (student.isActive !== false && (!student.academicHistory || !student.academicHistory[targetTermKey])) {
                    const newHistory = student.academicHistory ? { ...student.academicHistory } : {};
                    newHistory[targetTermKey] = {
                        className: student.currentClass || student.className || 'Unknown',
                        semester: semesterType,
                        marks: {},
                        grandTotal: 0,
                        average: 0,
                        rank: 0,
                        performanceLevel: 'Needs Improvement'
                    };
                    
                    batch.update(docSnap.ref, {
                        semester: semesterType,
                        academicHistory: newHistory
                    });
                    
                    clonedCount++;
                }
            });
            
            this.invalidateCache();
            return clonedCount;
        } catch (error) {
            console.error('Error cloning students to new semester:', error);
            throw error;
        }
    }

    /**
     * Normalizes a student record from Firestore.
     * Maps legacy 'ta' and 'ce' fields in marks to 'int' and 'ext'.
     */
    // processStudentRecord moved to BaseDataService for shared usage


    public async isEligibleForHallTicket(studentId: string, termKey?: string): Promise<boolean> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            const student = await this.getStudentById(studentId);
            if (!student) return false;

            // Simple check: Is attendance >= 75%?
            // In a real system, this would involve more complex logic
            // For now, we'll assume they are eligible if they have a record in the term
            const history = student.academicHistory || {};
            return !!history[activeTerm];
        } catch (error) {
            console.error('Error checking eligibility:', error);
            return false;
        }
    }

    public async getAllStudents(termKey?: string): Promise<StudentRecord[]> {
        const activeTerm = termKey || this.getCurrentTermKey();

        if (this.isCacheValid() && this.studentsCache.has(activeTerm)) {
            return this.studentsCache.get(activeTerm)!;
        }

        try {
            const querySnapshot = await getDocs(collection(this.db, this.studentsCollection));
            const students = querySnapshot.docs.map(doc => this.processStudentRecord(doc.data(), doc.id, activeTerm));

            students.sort((a, b) => {
                if (a.importRowNumber !== undefined && b.importRowNumber !== undefined) {
                    return a.importRowNumber - b.importRowNumber;
                }
                if (a.importRowNumber !== undefined) return -1;
                if (b.importRowNumber !== undefined) return 1;
                return (a.rank || 0) - (b.rank || 0);
            });

            const currentGlobalTerm = this.getCurrentTermKey();
            const isCurrentTerm = activeTerm === currentGlobalTerm;

            const filteredStudents = students.filter(student => {
                const isActive = student.isActive !== false;
                if (activeTerm === 'All') {
                    return true; // Return everyone for raw data gathering
                }
                if (isCurrentTerm) {
                    return isActive;
                } else {
                    return !!(student.academicHistory && student.academicHistory[activeTerm]);
                }
            });

            this.studentsCache.set(activeTerm, filteredStudents);
            this.cacheTimestamp = Date.now();

            return filteredStudents;
        } catch (error) {
            console.error('Error fetching students:', error);
            return [];
        }
    }

    public async getStudentById(id: string, termKey?: string): Promise<StudentRecord | null> {
        try {
            const docRef = doc(this.db, this.studentsCollection, id);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? this.processStudentRecord(docSnap.data(), docSnap.id, termKey) : null;
        } catch (error) {
            console.error('Error fetching student by ID:', error);
            return null;
        }
    }

    public async getStudentByAdNo(adNo: string, termKey?: string): Promise<StudentRecord | null> {
        try {
            const q = query(
                collection(this.db, this.studentsCollection),
                where('adNo', '==', adNo)
            );
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) return null;
            const docSnap = querySnapshot.docs[0];
            return this.processStudentRecord(docSnap.data(), docSnap.id, termKey);
        } catch (error) {
            console.error('Error fetching student by admission number:', error);
            return null;
        }
    }

    public async addStudent(student: Omit<StudentRecord, 'id'>): Promise<string> {
        try {
            const cleanStudent = this.sanitize({ ...student, isActive: true });
            const docRef = await addDoc(collection(this.db, this.studentsCollection), cleanStudent);
            this.updateStudentInCache(docRef.id, this.processStudentRecord(cleanStudent, docRef.id));
            return docRef.id;
        } catch (error) {
            console.error('Error adding student:', error);
            throw error;
        }
    }

    public async updateStudent(id: string, updates: Partial<StudentRecord>): Promise<void> {
        try {
            const docRef = doc(this.db, this.studentsCollection, id);
            
            // Sync currentClass and className if one is missing but the other is provided
            const finalUpdates = { ...updates };
            if (updates.className && !updates.currentClass) {
                finalUpdates.currentClass = updates.className;
            } else if (updates.currentClass && !updates.className) {
                finalUpdates.className = updates.currentClass;
            }

            // Also update active term history if class is changing
            const newClassName = finalUpdates.currentClass;
            if (newClassName) {
                const termKey = this.getCurrentTermKey();
                const student = await this.getStudentById(id);
                if (student && student.academicHistory?.[termKey]) {
                    const updatedHistory = { ...student.academicHistory };
                    updatedHistory[termKey] = {
                        ...updatedHistory[termKey],
                        className: newClassName
                    };
                    finalUpdates.academicHistory = updatedHistory;
                }
            }

            const cleanUpdates = this.sanitize(finalUpdates);
            await updateDoc(docRef, cleanUpdates);
            this.updateStudentInCache(id, cleanUpdates);
        } catch (error) {
            console.error('Error updating student:', error);
            throw error;
        }
    }

    public async deleteStudent(id: string): Promise<void> {
        try {
            await deleteDoc(doc(this.db, this.studentsCollection, id));
            this.invalidateCache();
        } catch (error) {
            console.error('Error deleting student:', error);
            throw error;
        }
    }

    public async promoteStudents(studentIds: string[], targetClass: string, targetYear: string, targetSemester: 'Odd' | 'Even'): Promise<void> {
        try {
            const batch = writeBatch(this.db);
            const termKey = `${targetYear}-${targetSemester}`;

            for (const id of studentIds) {
                const docRef = doc(this.db, this.studentsCollection, id);
                const student = await this.getStudentById(id);
                if (student) {
                    const academicHistory = { ...student.academicHistory };
                    academicHistory[termKey] = {
                        className: targetClass,
                        semester: targetSemester,
                        marks: {},
                        grandTotal: 0,
                        average: 0,
                        rank: 0,
                        performanceLevel: 'Pending' as PerformanceLevel
                    };
                    batch.update(docRef, {
                        currentClass: targetClass,
                        academicHistory
                    });
                }
            }
            await batch.commit();
            this.invalidateCache();
        } catch (error) {
            console.error('Error promoting students:', error);
            throw error;
        }
    }

    /**
     * Promotes all students in a class to a new class for a specific term.
     */
    public async promoteClass(fromClass: string, toClass: string, termKey: string): Promise<void> {
        try {
            const students = await this.getStudentsByClass(fromClass);
            if (students.length === 0) return;

            const parts = termKey.split('-');
            const semester = parts.pop() as 'Odd' | 'Even';
            const year = parts.join('-');
            
            const studentIds = students.map(s => s.id);
            await this.promoteStudents(studentIds, toClass, year, semester);
        } catch (error) {
            console.error('Error promoting class:', error);
            throw error;
        }
    }

    public async getStudentsByClass(className: string, termKey?: string): Promise<StudentRecord[]> {
        const students = await this.getAllStudents(termKey);
        const activeTerm = termKey || this.getCurrentTermKey();
        const isCurrentTerm = activeTerm === this.getCurrentTermKey();

        return students.filter(s => {
            if (isCurrentTerm) {
                // Current semester: include if current or primary matches
                return s.currentClass === className || s.className === className;
            } else {
                // Historical semester: ONLY include if they were in this class AT THAT TIME
                // className at this point is already resolved to termData.className in processStudentRecord
                return s.className === className;
            }
        });
    }

    public updateStudentInCache(studentId: string, updates: Partial<StudentRecord>, termKey?: string): void {
        const activeTerm = termKey || this.getCurrentTermKey();
        const cachedStudents = this.studentsCache.get(activeTerm);
        if (cachedStudents && this.isCacheValid()) {
            const index = cachedStudents.findIndex(s => s.id === studentId);
            if (index !== -1) {
                cachedStudents[index] = { ...cachedStudents[index], ...updates };
            }
        }
    }
}
