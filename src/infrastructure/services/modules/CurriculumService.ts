import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { BaseDataService } from './BaseDataService';
import { CurriculumEntry } from '../../../domain/entities/types';

export class CurriculumService extends BaseDataService {
    public async getAllCurriculum(): Promise<CurriculumEntry[]> {
        try {
            const snapshot = await getDocs(collection(this.db, this.curriculumCollection));
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CurriculumEntry));
        } catch (error) {
            console.error('Error fetching curriculum:', error);
            return [];
        }
    }

    public async addCurriculumEntry(entry: Omit<CurriculumEntry, 'id'>): Promise<string> {
        try {
            const docRef = await addDoc(collection(this.db, this.curriculumCollection), entry);
            return docRef.id;
        } catch (error) {
            console.error('Error adding curriculum entry:', error);
            throw error;
        }
    }

    public async updateCurriculumEntry(id: string, updates: Partial<CurriculumEntry>): Promise<void> {
        try {
            const docRef = doc(this.db, this.curriculumCollection, id);
            await updateDoc(docRef, updates);
        } catch (error) {
            console.error('Error updating curriculum entry:', error);
            throw error;
        }
    }

    public async deleteCurriculumEntry(id: string): Promise<void> {
        try {
            const docRef = doc(this.db, this.curriculumCollection, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error('Error deleting curriculum entry:', error);
            throw error;
        }
    }
}
