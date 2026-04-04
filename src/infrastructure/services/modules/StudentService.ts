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
     * Parses student CSV data.
     */
    public parseStudentCSV(csvData: string): any[] {
        const lines = csvData.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = lines.slice(1).filter(line => line.trim()).map(line => {
            const values = line.split(',').map(v => v.trim());
            const obj: any = {};
            headers.forEach((header, index) => {
                obj[header] = values[index];
            });
            return obj;
        });
        return ExcelUtils.parseStudentData(data);
    }

    /**
     * Bulk imports students into Firestore.
     */
    public async bulkImportStudents(students: any[]): Promise<{ updated: number; created: number; errors: string[] }> {
        let created = 0;
        let updated = 0;
        const errors: string[] = [];
        const termKey = this.getCurrentTermKey();

        await this.runBatchedOperation(students, async (batch, studentData) => {
            try {
                const adNo = studentData.adNo?.toString();
                if (!adNo) return;

                const existing = await this.getStudentByAdNo(adNo);
                if (existing) {
                    const docRef = doc(this.db, this.studentsCollection, existing.id);
                    batch.update(docRef, {
                        name: studentData.name,
                        currentClass: studentData.className,
                        [`academicHistory.${termKey}.className`]: studentData.className,
                        [`academicHistory.${termKey}.semester`]: studentData.semester
                    });
                    updated++;
                } else {
                    const newStudentRef = doc(collection(this.db, this.studentsCollection));
                    const newStudent = {
                        adNo,
                        name: studentData.name,
                        currentClass: studentData.className,
                        isActive: true,
                        academicHistory: {
                            [termKey]: {
                                className: studentData.className,
                                semester: studentData.semester,
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
                errors.push(`Error with student ${studentData.adNo}: ${err.message}`);
            }
        });

        this.invalidateCache();
        return { created, updated, errors };
    }
    /**
     * Normalizes a student record from Firestore.
     * Maps legacy 'ta' and 'ce' fields in marks to 'int' and 'ext'.
     */
    public processStudentRecord(data: any, id: string, termKey?: string): StudentRecord {
        const currentTermKey = termKey || this.getCurrentTermKey();
        let academicHistory = { ...(data.academicHistory || {}) };
        const currentClass = data.currentClass || data.className || '';

        // 1. Legacy Migration: If top-level marks exist, ensure they are in history
        if (data.marks && Object.keys(data.marks).length > 0) {
            // Determine which term these legacy marks belong to
            // Default to 2025-2026-Odd if not specified (legacy fallback)
            const legacyTerm = data.termKey || '2025-2026-Odd';
            
            if (!academicHistory[legacyTerm]) {
                academicHistory[legacyTerm] = {
                    className: currentClass,
                    semester: data.semester || (legacyTerm.includes('Odd') ? 'Odd' : 'Even'),
                    marks: data.marks,
                    grandTotal: data.grandTotal || 0,
                    average: data.average || 0,
                    rank: data.rank || 0,
                    performanceLevel: data.performanceLevel || 'C (Average)'
                };
            }
        }

        // 2. Normalize and calculate data for the REQUESTED term
        const termData = academicHistory[currentTermKey];
        const rawMarks = termData?.marks || {};

        const normalizedMarks: Record<string, SubjectMarks> = {};
        Object.entries(rawMarks).forEach(([subjectId, marks]: [string, any]) => {
            normalizedMarks[subjectId] = {
                int: marks.int !== undefined ? marks.int : (marks.ce !== undefined ? marks.ce : 0),
                ext: marks.ext !== undefined ? marks.ext : (marks.ta !== undefined ? marks.ta : 0),
                total: marks.total || 0,
                status: marks.status || 'Pending',
                isSupplementary: marks.isSupplementary,
                supplementaryYear: marks.supplementaryYear
            };
        });

        // 3. Populate derived top-level fields for compatibility with current views
        const currentTotals = academicHistory[currentTermKey] || {
            grandTotal: 0,
            average: 0,
            rank: 0,
            performanceLevel: 'Pending' as PerformanceLevel
        };

        return {
            ...data,
            id,
            currentClass,
            academicHistory,
            className: termData?.className || currentClass,
            marks: normalizedMarks,
            semester: currentTermKey.split('-').length === 3 
                ? currentTermKey.split('-')[2] as 'Odd' | 'Even' 
                : (currentTermKey.split('-')[1] as 'Odd' | 'Even'),
            grandTotal: currentTotals.grandTotal,
            average: currentTotals.average,
            rank: currentTotals.rank,
            performanceLevel: currentTotals.performanceLevel as PerformanceLevel
        } as StudentRecord;
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
            const cleanUpdates = this.sanitize(updates);
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

    public async getStudentsByClass(className: string, termKey?: string): Promise<StudentRecord[]> {
        const students = await this.getAllStudents(termKey);
        return students.filter(s => s.currentClass === className || s.className === className);
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
