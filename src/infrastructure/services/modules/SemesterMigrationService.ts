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
     * Deep clones selected configuration (Subjects, Curriculum) from one semester to another.
     *
     * @param fromTermKey  Source term key (e.g. "2025-2026-Odd")
     * @param toTermKey    Destination term key (e.g. "2025-2026-Even")
     * @param selectedSubjectIds  If provided, ONLY these subject IDs will be cloned.
     *                            If omitted/empty, NO subjects are cloned (clean slate).
     * @param selectedFacultyNames If provided, only subjects whose facultyName matches
     *                             one of these will be cloned (applied AFTER selectedSubjectIds).
     */
    public async initializeNewSemester(
        fromTermKey: string,
        toTermKey: string,
        selectedSubjectIds?: string[],
        selectedFacultyNames?: string[]
    ): Promise<{ subjectsCloned: number; curriculumCloned: number }> {
        try {
            console.log(`Initializing migration from ${fromTermKey} to ${toTermKey}...`);
            
            const [fromYear, fromSem] = this.parseTermKey(fromTermKey);
            const [toYear, toSem]     = this.parseTermKey(toTermKey);

            // 1. Clone Subjects (respecting user selections)
            const subjectsCloned = await this.cloneSubjects(
                fromYear, fromSem as 'Odd' | 'Even',
                toYear,   toSem   as 'Odd' | 'Even',
                selectedSubjectIds,
                selectedFacultyNames
            );

            // 2. Clone Curriculum (only for selected subjects when filter is active)
            const curriculumCloned = await this.cloneCurriculum(fromTermKey, toTermKey, toYear, selectedSubjectIds);

            console.log(`Migration Complete: ${subjectsCloned} subjects, ${curriculumCloned} curriculum entries.`);
            return { subjectsCloned, curriculumCloned };
        } catch (error) {
            console.error('Error during semester initialization:', error);
            throw error;
        }
    }

    private parseTermKey(termKey: string): [string, string] {
        const parts = termKey.split('-');
        const sem   = parts.pop() || '';
        const year  = parts.join('-');
        return [year, sem];
    }

    private async cloneSubjects(
        fromYear: string,
        fromSem: 'Odd' | 'Even',
        toYear: string,
        toSem: 'Odd' | 'Even',
        selectedSubjectIds?: string[],
        selectedFacultyNames?: string[]
    ): Promise<number> {
        // If no subjects were selected at all, clone nothing
        if (selectedSubjectIds !== undefined && selectedSubjectIds.length === 0) {
            console.log('[SemesterMigrationService] No subjects selected — skipping subject clone.');
            return 0;
        }

        const subjectsSnap = await getDocs(collection(this.db, this.subjectsCollection));
        let count = 0;

        const operations: SubjectConfig[] = [];
        const selectedIdSet     = selectedSubjectIds     ? new Set(selectedSubjectIds)     : null;
        const selectedFacultySet = selectedFacultyNames  ? new Set(selectedFacultyNames.map(f => (f || '').toLowerCase().trim())) : null;

        subjectsSnap.docs.forEach(docSnap => {
            const data = docSnap.data() as SubjectConfig;

            // Skip deleted subjects
            if (data.isDeleted) return;

            // Must match the source year and semester (or be 'Both')
            if (data.academicYear !== fromYear) return;
            if (data.activeSemester !== fromSem && data.activeSemester !== 'Both') return;

            // Honour whitelist: if a selection was passed, only clone listed subjects
            if (selectedIdSet && !selectedIdSet.has(docSnap.id)) return;

            // Honour faculty filter: if faculty names were passed, only clone subjects matching
            if (selectedFacultySet && data.facultyName) {
                const normalizedFaculty = (data.facultyName || '').toLowerCase().trim();
                if (!selectedFacultySet.has(normalizedFaculty)) return;
            }

            operations.push({ id: docSnap.id, ...data } as SubjectConfig);
        });

        await this.runBatchedOperation(operations, (batch, subject) => {
            const newRef = doc(collection(this.db, this.subjectsCollection));
            const { id, ...cloneData } = subject as any;
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

    private async cloneCurriculum(
        fromTermKey: string,
        toTermKey: string,
        toYear: string,
        selectedSubjectIds?: string[]
    ): Promise<number> {
        const curriculumSnap = await getDocs(collection(this.db, this.curriculumCollection));
        let count = 0;

        const selectedIdSet = selectedSubjectIds ? new Set(selectedSubjectIds) : null;

        const operations: CurriculumEntry[] = [];
        curriculumSnap.docs.forEach(docSnap => {
            const data = docSnap.data() as CurriculumEntry;
            if (data.termKey !== fromTermKey) return;

            // If a subject filter is active, only clone curriculum matching selected subjects
            if (selectedIdSet && data.subjectCode && !selectedIdSet.has(data.subjectCode)) return;

            operations.push({ id: docSnap.id, ...data } as CurriculumEntry);
        });

        await this.runBatchedOperation(operations, (batch, entry) => {
            const newRef = doc(collection(this.db, this.curriculumCollection));
            const { id, ...cloneData } = entry as any;
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
