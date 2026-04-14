import {
    Firestore,
    collection,
    doc,
    getDoc,
    writeBatch,
    QueryConstraint,
    query,
    getDocs,
    DocumentData
} from 'firebase/firestore';
import { getDb } from '../../config/firebaseConfig';
import { 
    GlobalSettings, 
    StudentRecord, 
    SubjectConfig, 
    SupplementaryExam 
} from '../../../domain/entities/types';

export abstract class BaseDataService {
    protected db = getDb();
    
    public async initializeDatabase(): Promise<void> {
        // No-op: Firebase handles initialization via config
        return Promise.resolve();
    }
    
    // Collections
    protected readonly studentsCollection = 'students';
    protected readonly subjectsCollection = 'subjects';
    protected readonly supplementaryExamsCollection = 'supplementaryExams';
    protected readonly settingsCollection = 'settings';
    protected readonly applicationsCollection = 'applications';
    protected readonly attendanceCollection = 'attendance';
    protected readonly timetablesCollection = 'timetables';
    protected readonly specialDaysCollection = 'specialDays';
    protected readonly examTimetablesCollection = 'examTimetables';
    protected readonly hallTicketSettingsCollection = 'hallTicketSettings';
    protected readonly academicCalendarCollection = 'academicCalendar';
    protected readonly generatorConfigsCollection = 'generatorConfigs';
    protected readonly curriculumCollection = 'curriculum';

    // Cache
    protected studentsCache = new Map<string, StudentRecord[]>();
    protected subjectsCache: SubjectConfig[] | null = null;
    protected supplementaryCache = new Map<string, SupplementaryExam[]>();
    protected cacheTimestamp: number = 0;
    protected currentGlobalSettings: GlobalSettings | null = null;
    
    protected readonly DEFAULT_ACADEMIC_YEAR = "2025-2026";
    protected readonly DEFAULT_SEMESTER = "Odd";
    protected readonly CACHE_DURATION = 300000; // 5 minutes

    protected isCacheValid(): boolean {
        return this.cacheTimestamp > 0 && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
    }

    public getCurrentTermKey(settings?: GlobalSettings): string {
        const s = settings || this.currentGlobalSettings || { 
            currentAcademicYear: this.DEFAULT_ACADEMIC_YEAR, 
            currentSemester: this.DEFAULT_SEMESTER 
        };
        return `${s.currentAcademicYear}-${s.currentSemester}`;
    }

    public getNextAcademicTerm(currentTerm: string): string {
        if (!currentTerm) return currentTerm;
        const parts = currentTerm.split('-');
        if (!currentTerm.endsWith('-Odd')) return currentTerm; // Only handle Odd to Even transitions for now
        
        parts.pop(); // Remove 'Odd'
        
        if (parts.length === 2) {
            // Case: YYYY-YYYY-Odd (Existing students) -> YYYY(Second)-Even
            return `${parts[1]}-Even`;
        } else if (parts.length === 1) {
            // Case: YYYY-Odd (New students) -> YYYY-YYYY+1-Even
            const year = parseInt(parts[0]);
            return `${year}-${year + 1}-Even`;
        }
        
        return `${parts.join('-')}-Even`; // Fallback
    }

    public getDb(): Firestore {
        return this.db;
    }

    public invalidateCache(): void {
        this.studentsCache.clear();
        this.subjectsCache = null;
        this.supplementaryCache.clear();
        this.cacheTimestamp = 0;
        this.currentGlobalSettings = null;
    }

    protected getMarkValue(mark: any): number {
        if (mark === null || mark === undefined || mark === 'A') return 0;
        if (typeof mark === 'number') return isNaN(mark) ? 0 : mark;
        const num = parseInt(mark);
        return isNaN(num) ? 0 : num;
    }

    protected sanitize<T>(data: T): T {
        if (!data) return data;
        return JSON.parse(JSON.stringify(data));
    }

    /**
     * Helper to run batched operations in groups of 500 (Firestore limit).
     * @param items Array of items to process.
     * @param processor Function that adds operations to the batch.
     */
    protected async runBatchedOperation<T>(
        items: T[],
        processor: (batch: ReturnType<typeof writeBatch>, item: T) => void
    ): Promise<number> {
        let totalProcessed = 0;
        const BATCH_SIZE = 500;

        for (let i = 0; i < items.length; i += BATCH_SIZE) {
            const batch = writeBatch(this.db);
            const currentBatchItems = items.slice(i, i + BATCH_SIZE);
            
            for (const item of currentBatchItems) {
                processor(batch, item);
                totalProcessed++;
            }

            await batch.commit();
        }

        return totalProcessed;
    }
}
