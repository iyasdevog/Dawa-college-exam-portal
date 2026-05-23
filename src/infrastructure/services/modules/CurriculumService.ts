import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { BaseDataService } from './BaseDataService';
import { CurriculumEntry } from '../../../domain/entities/types';

export class CurriculumService extends BaseDataService {
    public async getAllCurriculum(termKey?: string): Promise<CurriculumEntry[]> {
        try {
            const activeTerm = termKey || this.getCurrentTermKey();
            const q = query(
                collection(this.db, this.curriculumCollection),
                where('termKey', '==', activeTerm)
            );
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as CurriculumEntry));
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

    public async syncSubjectToCurriculum(id: string, updates: any): Promise<void> {
        if (!updates.details) return;

        try {
            let subjectConfigName = updates.name || '';
            let subjectType = updates.subjectType || 'general';

            // Infer curriculum stage & stream
            const stageStr = (updates.details.stage || '').toLowerCase();
            let curStage: 'Foundational' | 'Undergraduate' | 'Post Graduate' = 'Foundational';
            if (stageStr.includes('undergraduate')) curStage = 'Undergraduate';
            else if (stageStr.includes('post')) curStage = 'Post Graduate';

            let stream: '3-Year' | '5-Year' | 'None' = 'None';
            const semText = String(updates.details.semester || '').trim();
            const semNum = parseInt(semText) || 1;

            if (curStage === 'Foundational') {
                stream = '3-Year';
                if (stageStr.includes('5') || semText.includes('5') || ['7', '8', '9', '10'].includes(semText)) {
                    stream = '5-Year';
                }
            }

            // Format curriculum portions from course units
            let portionsStr = (updates.details.courseContent || [])
                .map((c: any) => `Unit ${c.unit}: ${c.description || ''}`.trim())
                .filter((c: any) => c !== 'Unit :')
                .join('\n\n');

            if (!portionsStr) {
                portionsStr = updates.details.summaryAndJustification || 'No syllabus available.';
            }

            const termKey = this.getCurrentTermKey();
            const [targetYear, targetSemester] = termKey.split('-').length === 3
                ? [`${termKey.split('-')[0]}-${termKey.split('-')[1]}`, termKey.split('-')[2]]
                : [termKey.split('-')[0], termKey.split('-')[1]];

            const curriculumData = {
                stage: curStage,
                stream: stream,
                semester: semNum,
                subjectCode: id, // Typically acts as code
                subjectName: subjectConfigName || updates.details.courseName || 'Unknown Subject',
                subjectType: subjectType,
                learningPeriod: updates.details.totalHours || 'TBD',
                portions: portionsStr.trim(),
                academicYear: targetYear,
                termKey: termKey
            };

            const curricula = await this.getAllCurriculum();
            // Match by name AND term to allow historical versions of the same subject
            const existing = curricula.find(c =>
                (c.subjectCode === id) ||
                (c.subjectName === curriculumData.subjectName && (c.termKey === termKey || c.academicYear === targetYear))
            );

            if (existing) {
                await this.updateCurriculumEntry(existing.id, curriculumData);
            } else {
                await this.addCurriculumEntry(curriculumData);
            }
        } catch (err) {
            console.error("Auto Sync Curriculum Error:", err);
            throw err;
        }
    }
}
