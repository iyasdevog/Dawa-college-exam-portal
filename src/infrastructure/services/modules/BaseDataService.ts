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
    protected db: Firestore | null = getDb();
    
    public async initializeDatabase(): Promise<void> {
        if (!this.db) {
            this.db = getDb();
        }
        if (!this.db) {
            console.warn("BaseDataService: Database initialization failed or returned null.");
        }
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
    protected static currentGlobalSettings: GlobalSettings | null = null;
    
    protected readonly DEFAULT_ACADEMIC_YEAR = "2025-2026";
    protected readonly DEFAULT_SEMESTER = "Odd";
    protected readonly CACHE_DURATION = 300000; // 5 minutes

    /**
     * Updates the shared global settings. 
     * This is called by the UI (TermContext) to ensure services stay in sync with the user's selection.
     */
    public static updateStaticSettings(settings: GlobalSettings): void {
        BaseDataService.currentGlobalSettings = settings;
    }

    protected isCacheValid(): boolean {
        return this.cacheTimestamp > 0 && (Date.now() - this.cacheTimestamp) < this.CACHE_DURATION;
    }

    public static getCurrentTermKey(className?: string): string {
        const settings = BaseDataService.currentGlobalSettings;
        if (!settings) return '2025-2026-Odd';
        
        let semester = settings.currentSemester;
        
        // If a class-specific semester is defined, use it for current term resolution
        if (className && settings.classSemesters && settings.classSemesters[className]) {
            semester = settings.classSemesters[className];
        }
        
        return `${settings.currentAcademicYear}-${semester}`;
    }

    public getCurrentTermKey(className?: string): string {
        return BaseDataService.getCurrentTermKey(className);
    }

    public getNextAcademicTerm(currentTerm: string): string {
        if (!currentTerm) return currentTerm;
        const parts = currentTerm.split('-');
        if (!currentTerm.endsWith('-Odd')) return currentTerm; // Only handle Odd to Even transitions for now
        
        parts.pop(); // Remove 'Odd'
        
        const yearStr = parts.join('-');
        const isYearRange = yearStr.includes('-');
        
        if (isYearRange) {
            // Case: YYYY-YYYY-Odd -> YYYY(Second)-Even
            const years = yearStr.split('-');
            return `${years[1]}-Even`;
        } else {
            // Case: YYYY-Odd -> YYYY-YYYY+1-Even or simply YYYY-Even?
            // If they use single year, let's just keep it single year for simplicity unless pattern says otherwise
            return `${yearStr}-Even`;
        }
    }

    public getDb(): Firestore {
        return this.db;
    }

    public invalidateCache(): void {
        this.studentsCache.clear();
        this.subjectsCache = null;
        this.supplementaryCache.clear();
        this.cacheTimestamp = 0;
        BaseDataService.currentGlobalSettings = null;
    }

    protected getMarkValue(mark: any): number {
        if (mark === null || mark === undefined || mark === 'A') return 0;
        if (typeof mark === 'number') return isNaN(mark) ? 0 : mark;
        const num = parseInt(mark);
        return isNaN(num) ? 0 : num;
    }

    protected async getDocData<T>(collectionName: string, docId: string): Promise<T | null> {
        if (!this.db) return null;
        try {
            const docRef = doc(this.db, collectionName, docId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as any as T;
            }
        } catch (error) {
            console.error(`Error fetching doc ${collectionName}/${docId}:`, error);
        }
        return null;
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
        if (!this.db) {
            throw new Error("Cannot run batched operation: Database not initialized.");
        }
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
