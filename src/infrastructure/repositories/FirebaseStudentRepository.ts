import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    writeBatch,
    onSnapshot,
    Unsubscribe
} from 'firebase/firestore';
import { getDb } from '../config/firebaseConfig';
import { Student, SubjectMarks } from '../../domain/entities/Student';
import { IStudentRepository } from '../../domain/interfaces/IStudentRepository';

export class FirebaseStudentRepository implements IStudentRepository {
    private readonly collectionName = 'students';
    private cache: Student[] | null = null;
    private cacheTimestamp: number = 0;
    private readonly CACHE_DURATION = 30000; // 30 seconds

    private get db() {
        const database = getDb();
        if (!database) {
            throw new Error('Firebase not initialized');
        }
        return database;
    }

    private isCacheValid(): boolean {
        return this.cacheTimestamp > 0 && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
    }

    private updateCache(students: Student[]): void {
        this.cache = students;
        this.cacheTimestamp = Date.now();
    }

    private invalidateCache(): void {
        this.cache = null;
        this.cacheTimestamp = 0;
    }

    async findById(id: string): Promise<Student | null> {
        try {
            const docRef = doc(this.db, this.collectionName, id);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                return null;
            }

            const data = docSnap.data();
            return Student.create({
                id: docSnap.id,
                ...data
            } as any);
        } catch (error) {
            console.error('Error finding student by ID:', error);
            throw error;
        }
    }

    async findByAdmissionNumber(adNo: string): Promise<Student | null> {
        try {
            const q = query(
                collection(this.db, this.collectionName),
                where('adNo', '==', adNo)
            );

            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                return null;
            }

            const doc = querySnapshot.docs[0];
            const data = doc.data();
            return Student.create({
                id: doc.id,
                ...data
            } as any);
        } catch (error) {
            console.error('Error finding student by admission number:', error);
            throw error;
        }
    }

    async findByClass(className: string): Promise<Student[]> {
        try {
            const allStudents = await this.findAll();
            return allStudents.filter(student => student.className === className);
        } catch (error) {
            console.error('Error finding students by class:', error);
            throw error;
        }
    }

    async findAll(): Promise<Student[]> {
        // Return cached data if valid
        if (this.isCacheValid() && this.cache) {
            return this.cache;
        }

        try {
            const querySnapshot = await getDocs(collection(this.db, this.collectionName));

            const students = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return Student.create({
                    id: doc.id,
                    ...data
                } as any);
            });

            // Sort by rank
            students.sort((a, b) => (a.rank || 0) - (b.rank || 0));

            // Update cache
            this.updateCache(students);

            return students;
        } catch (error) {
            console.error('Error finding all students:', error);
            throw error;
        }
    }

    async save(student: Student): Promise<string> {
        try {
            const studentData = {
                adNo: student.adNo,
                name: student.name,
                className: student.className,
                semester: student.semester,
                marks: student.marks,
                supplementaryExams: student.supplementaryExams,
                grandTotal: student.grandTotal,
                average: student.average,
                rank: student.rank,
                performanceLevel: student.performanceLevel
            };

            const docRef = await addDoc(collection(this.db, this.collectionName), studentData);
            this.invalidateCache();
            return docRef.id;
        } catch (error) {
            console.error('Error saving student:', error);
            throw error;
        }
    }

    async update(id: string, updates: Partial<Student>): Promise<void> {
        try {
            const docRef = doc(this.db, this.collectionName, id);
            await updateDoc(docRef, updates as any);
            this.invalidateCache();
        } catch (error) {
            console.error('Error updating student:', error);
            throw error;
        }
    }

    async delete(id: string): Promise<void> {
        try {
            const docRef = doc(this.db, this.collectionName, id);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                throw new Error(`Student with ID ${id} does not exist`);
            }

            await deleteDoc(docRef);
            this.invalidateCache();
        } catch (error) {
            console.error('Error deleting student:', error);
            throw error;
        }
    }

    async updateStudentMarks(studentId: string, subjectId: string, marks: SubjectMarks): Promise<void> {
        try {
            const student = await this.findById(studentId);
            if (!student) {
                throw new Error('Student not found');
            }

            const updatedStudent = student.updateMarks(subjectId, marks);
            await this.update(studentId, {
                marks: updatedStudent.marks,
                grandTotal: updatedStudent.grandTotal,
                average: updatedStudent.average,
                performanceLevel: updatedStudent.performanceLevel
            });
        } catch (error) {
            console.error('Error updating student marks:', error);
            throw error;
        }
    }

    async clearStudentMarks(studentId: string, subjectId: string): Promise<void> {
        try {
            const student = await this.findById(studentId);
            if (!student) {
                throw new Error('Student not found');
            }

            const updatedMarks = { ...student.marks };
            delete updatedMarks[subjectId];

            const updatedStudent = Student.create({
                ...student,
                marks: updatedMarks
            });

            await this.update(studentId, {
                marks: updatedStudent.marks,
                grandTotal: updatedStudent.grandTotal,
                average: updatedStudent.average,
                performanceLevel: updatedStudent.performanceLevel
            });
        } catch (error) {
            console.error('Error clearing student marks:', error);
            throw error;
        }
    }

    async clearSubjectMarks(subjectId: string, studentIds: string[]): Promise<void> {
        try {
            const batch = writeBatch(this.db);

            for (const studentId of studentIds) {
                const student = await this.findById(studentId);
                if (!student) continue;

                const updatedMarks = { ...student.marks };
                delete updatedMarks[subjectId];

                const updatedStudent = Student.create({
                    ...student,
                    marks: updatedMarks
                });

                const docRef = doc(this.db, this.collectionName, studentId);
                batch.update(docRef, {
                    marks: updatedStudent.marks,
                    grandTotal: updatedStudent.grandTotal,
                    average: updatedStudent.average,
                    performanceLevel: updatedStudent.performanceLevel
                });
            }

            await batch.commit();
            this.invalidateCache();
        } catch (error) {
            console.error('Error clearing subject marks:', error);
            throw error;
        }
    }

    async bulkImport(students: Omit<Student, 'id'>[]): Promise<{ success: number; errors: string[] }> {
        const results = { success: 0, errors: [] as string[] };

        try {
            const batchSize = 500;

            for (let i = 0; i < students.length; i += batchSize) {
                const batch = writeBatch(this.db);
                const currentBatch = students.slice(i, i + batchSize);

                for (const studentData of currentBatch) {
                    try {
                        // Validate required fields
                        if (!studentData.adNo || !studentData.name || !studentData.className) {
                            results.errors.push(`Row ${i + currentBatch.indexOf(studentData) + 1}: Missing required fields`);
                            continue;
                        }

                        // Check for duplicate admission numbers
                        const existingStudent = await this.findByAdmissionNumber(studentData.adNo);
                        if (existingStudent) {
                            results.errors.push(`Row ${i + currentBatch.indexOf(studentData) + 1}: Duplicate admission number ${studentData.adNo}`);
                            continue;
                        }

                        const docRef = doc(collection(this.db, this.collectionName));
                        batch.set(docRef, {
                            adNo: studentData.adNo,
                            name: studentData.name,
                            className: studentData.className,
                            semester: studentData.semester,
                            marks: studentData.marks || {},
                            supplementaryExams: studentData.supplementaryExams || [],
                            grandTotal: studentData.grandTotal || 0,
                            average: studentData.average || 0,
                            rank: studentData.rank || 0,
                            performanceLevel: studentData.performanceLevel || 'Needs Improvement'
                        });

                        results.success++;
                    } catch (error) {
                        results.errors.push(`Row ${i + currentBatch.indexOf(studentData) + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }

                if (results.success > 0) {
                    await batch.commit();
                }
            }

            this.invalidateCache();
            return results;
        } catch (error) {
            console.error('Error in bulk import:', error);
            throw error;
        }
    }

    async bulkExport(): Promise<any[]> {
        try {
            const students = await this.findAll();
            return students.map(student => ({
                id: student.id,
                adNo: student.adNo,
                name: student.name,
                className: student.className,
                semester: student.semester,
                marks: student.marks,
                grandTotal: student.grandTotal,
                average: student.average,
                rank: student.rank,
                performanceLevel: student.performanceLevel
            }));
        } catch (error) {
            console.error('Error in bulk export:', error);
            throw error;
        }
    }

    async calculateClassRankings(className: string): Promise<void> {
        try {
            const students = await this.findByClass(className);

            // Sort by grand total (descending)
            const sortedStudents = students.sort((a, b) => b.grandTotal - a.grandTotal);

            // Update ranks
            const batch = writeBatch(this.db);
            sortedStudents.forEach((student, index) => {
                const docRef = doc(this.db, this.collectionName, student.id);
                batch.update(docRef, { rank: index + 1 });
            });

            await batch.commit();
            this.invalidateCache();
        } catch (error) {
            console.error('Error calculating class rankings:', error);
            throw error;
        }
    }

    subscribe(callback: (students: Student[]) => void): () => void {
        const unsubscribe = onSnapshot(
            collection(this.db, this.collectionName),
            (snapshot) => {
                const students = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return Student.create({
                        id: doc.id,
                        ...data
                    } as any);
                });

                // Sort by rank
                students.sort((a, b) => (a.rank || 0) - (b.rank || 0));

                // Update cache
                this.updateCache(students);

                callback(students);
            },
            (error) => {
                console.error('Error in students subscription:', error);
            }
        );

        return unsubscribe;
    }
}