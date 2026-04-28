import { 
    collection, 
    getDocs, 
    addDoc, 
    writeBatch, 
    doc 
} from 'firebase/firestore';
import { BaseDataService } from './BaseDataService';
import { 
    SubjectConfig, 
    CurriculumEntry, 
    GlobalSettings 
} from '../../../domain/entities/types';

export class SemesterMigrationService extends BaseDataService {
    /**
     * Deep clones all configuration (Subjects, Curriculum) from one semester to another.
     */
    public async initializeNewSemester(fromTermKey: string, toTermKey: string): Promise<{ subjectsCloned: number; curriculumCloned: number }> {
        try {
            console.log(`Initializing migration from ${fromTermKey} to ${toTermKey}...`);
            
            const [fromYear, fromSem] = this.parseTermKey(fromTermKey);
            const [toYear, toSem] = this.parseTermKey(toTermKey);

            // 1. Clone Subjects
            const subjectsCloned = await this.cloneSubjects(fromYear, fromSem as 'Odd' | 'Even', toYear, toSem as 'Odd' | 'Even');
            
            // 2. Clone Curriculum
            const curriculumCloned = await this.cloneCurriculum(fromTermKey, toTermKey, toYear);

            console.log(`Migration Complete: ${subjectsCloned} subjects, ${curriculumCloned} curriculum entries.`);
            return { subjectsCloned, curriculumCloned };
        } catch (error) {
            console.error('Error during semester initialization:', error);
            throw error;
        }
    }

    private parseTermKey(termKey: string): [string, string] {
        const parts = termKey.split('-');
        const sem = parts.pop() || '';
        const year = parts.join('-');
        return [year, sem];
    }

    private async cloneSubjects(fromYear: string, fromSem: 'Odd' | 'Even', toYear: string, toSem: 'Odd' | 'Even'): Promise<number> {
        const subjectsSnap = await getDocs(collection(this.db, this.subjectsCollection));
        let count = 0;

        const operations: SubjectConfig[] = [];
        subjectsSnap.docs.forEach(docSnap => {
            const data = docSnap.data() as SubjectConfig;
            // Only clone if it matches the 'from' configuration or is a generic subject
            if (data.academicYear === fromYear && (data.activeSemester === fromSem || data.activeSemester === 'Both')) {
                operations.push(data);
            }
        });

        await this.runBatchedOperation(operations, (batch, subject) => {
            const newRef = doc(collection(this.db, this.subjectsCollection));
            const { id, ...cloneData } = subject;
            batch.set(newRef, {
                ...cloneData,
                academicYear: toYear,
                activeSemester: toSem,
                enrolledStudents: [] // Clear enrollment for new term
            });
            count++;
        });

        return count;
    }

    private async cloneCurriculum(fromTermKey: string, toTermKey: string, toYear: string): Promise<number> {
        const curriculumSnap = await getDocs(collection(this.db, this.curriculumCollection));
        let count = 0;

        const operations: CurriculumEntry[] = [];
        curriculumSnap.docs.forEach(docSnap => {
            const data = docSnap.data() as CurriculumEntry;
            if (data.termKey === fromTermKey) {
                operations.push(data);
            }
        });

        await this.runBatchedOperation(operations, (batch, entry) => {
            const newRef = doc(collection(this.db, this.curriculumCollection));
            const { id, ...cloneData } = entry;
            batch.set(newRef, {
                ...cloneData,
                termKey: toTermKey,
                academicYear: toYear
            });
            count++;
        });

        return count;
    }
}
