import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot
} from 'firebase/firestore';
import { getDb } from '../config/firebaseConfig';
import { Subject } from '../../domain/entities/Subject';
import { ISubjectRepository } from '../../domain/interfaces/ISubjectRepository';

export class FirebaseSubjectRepository implements ISubjectRepository {
    private readonly collectionName = 'subjects';

    private get db() {
        const database = getDb();
        if (!database) {
            throw new Error('Firebase not initialized');
        }
        return database;
    }

    async findById(id: string): Promise<Subject | null> {
        try {
            const docRef = doc(this.db, this.collectionName, id);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                return null;
            }

            const data = docSnap.data();
            return Subject.create({
                id: docSnap.id,
                ...data
            } as any);
        } catch (error) {
            console.error('Error finding subject by ID:', error);
            throw error;
        }
    }

    async findByClass(className: string): Promise<Subject[]> {
        try {
            const allSubjects = await this.findAll();
            return allSubjects.filter(subject => subject.isApplicableToClass(className));
        } catch (error) {
            console.error('Error finding subjects by class:', error);
            throw error;
        }
    }

    async findAll(): Promise<Subject[]> {
        try {
            const querySnapshot = await getDocs(collection(this.db, this.collectionName));

            return querySnapshot.docs.map(doc => {
                const data = doc.data();
                return Subject.create({
                    id: doc.id,
                    ...data
                } as any);
            });
        } catch (error) {
            console.error('Error finding all subjects:', error);
            throw error;
        }
    }

    async save(subject: Subject): Promise<string> {
        try {
            const subjectData = {
                name: subject.name,
                arabicName: subject.arabicName,
                maxTA: subject.maxTA,
                maxCE: subject.maxCE,
                passingTotal: subject.passingTotal,
                facultyName: subject.facultyName,
                targetClasses: subject.targetClasses,
                subjectType: subject.subjectType,
                enrolledStudents: subject.enrolledStudents
            };

            const docRef = await addDoc(collection(this.db, this.collectionName), subjectData);
            return docRef.id;
        } catch (error) {
            console.error('Error saving subject:', error);
            throw error;
        }
    }

    async update(id: string, updates: Partial<Subject>): Promise<void> {
        try {
            const docRef = doc(this.db, this.collectionName, id);
            await updateDoc(docRef, updates as any);
        } catch (error) {
            console.error('Error updating subject:', error);
            throw error;
        }
    }

    async delete(id: string): Promise<void> {
        try {
            const docRef = doc(this.db, this.collectionName, id);
            const docSnap = await getDoc(docRef);

            if (!docSnap.exists()) {
                throw new Error(`Subject with ID ${id} does not exist`);
            }

            await deleteDoc(docRef);
        } catch (error) {
            console.error('Error deleting subject:', error);
            throw error;
        }
    }

    async enrollStudent(subjectId: string, studentId: string): Promise<void> {
        try {
            const subject = await this.findById(subjectId);
            if (!subject) {
                throw new Error('Subject not found');
            }

            if (subject.subjectType !== 'elective') {
                throw new Error('Cannot enroll students in general subjects');
            }

            const updatedSubject = subject.enrollStudent(studentId);
            await this.update(subjectId, {
                enrolledStudents: updatedSubject.enrolledStudents
            });
        } catch (error) {
            console.error('Error enrolling student:', error);
            throw error;
        }
    }

    async unenrollStudent(subjectId: string, studentId: string): Promise<void> {
        try {
            const subject = await this.findById(subjectId);
            if (!subject) {
                throw new Error('Subject not found');
            }

            const updatedSubject = subject.unenrollStudent(studentId);
            await this.update(subjectId, {
                enrolledStudents: updatedSubject.enrolledStudents
            });
        } catch (error) {
            console.error('Error unenrolling student:', error);
            throw error;
        }
    }

    async getEnrolledStudents(subjectId: string): Promise<string[]> {
        try {
            const subject = await this.findById(subjectId);
            if (!subject) {
                throw new Error('Subject not found');
            }

            return subject.enrolledStudents;
        } catch (error) {
            console.error('Error getting enrolled students:', error);
            throw error;
        }
    }

    subscribe(callback: (subjects: Subject[]) => void): () => void {
        const unsubscribe = onSnapshot(
            collection(this.db, this.collectionName),
            (snapshot) => {
                const subjects = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return Subject.create({
                        id: doc.id,
                        ...data
                    } as any);
                });

                callback(subjects);
            },
            (error) => {
                console.error('Error in subjects subscription:', error);
            }
        );

        return unsubscribe;
    }
}