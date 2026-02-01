/**
 * Enhanced Data Service with Storage Fallback
 * Extends the existing data service with storage fallback capabilities
 * Following Clean Architecture - Infrastructure Layer
 */

import { dataService, DataService } from './dataService';
import { storageFallback } from './StorageFallbackService';
import { serviceWorkerFallback } from './ServiceWorkerFallbackService';
import { StudentRecord, SubjectConfig, SupplementaryExam } from '../../domain/entities/types';

export interface DataSyncStatus {
    isOnline: boolean;
    pendingSyncCount: number;
    lastSyncTime: Date | null;
    syncInProgress: boolean;
}

export interface OfflineDataCache {
    students: StudentRecord[];
    subjects: SubjectConfig[];
    lastUpdated: number;
    version: string;
}

export class EnhancedDataServiceWithFallback extends DataService {
    private readonly CACHE_KEY = 'offline_data_cache';
    private readonly SYNC_QUEUE_KEY = 'data_sync_queue';
    private readonly CACHE_VERSION = '1.0.0';
    private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

    private syncStatus: DataSyncStatus = {
        isOnline: navigator.onLine,
        pendingSyncCount: 0,
        lastSyncTime: null,
        syncInProgress: false
    };

    private syncListeners: Set<(status: DataSyncStatus) => void> = new Set();

    constructor() {
        super();
        this.initializeFallbackService();
        this.setupNetworkListeners();
        this.loadSyncQueue();
    }

    /**
     * Initialize fallback service
     */
    private initializeFallbackService(): void {
        console.log('[DATA FALLBACK] Initializing enhanced data service with fallback');

        // Load cached data if available
        this.loadCachedData();

        // Set up periodic sync when online
        this.setupPeriodicSync();
    }

    /**
     * Set up network listeners
     */
    private setupNetworkListeners(): void {
        const handleOnline = () => {
            this.syncStatus.isOnline = true;
            console.log('[DATA FALLBACK] Network back online, triggering sync');
            this.triggerSync();
            this.notifySyncListeners();
        };

        const handleOffline = () => {
            this.syncStatus.isOnline = false;
            console.log('[DATA FALLBACK] Network went offline');
            this.notifySyncListeners();
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
    }

    /**
     * Set up periodic sync
     */
    private setupPeriodicSync(): void {
        // Sync every 5 minutes when online
        setInterval(() => {
            if (this.syncStatus.isOnline && !this.syncStatus.syncInProgress) {
                this.triggerSync();
            }
        }, 5 * 60 * 1000);
    }

    /**
     * Load cached data
     */
    private loadCachedData(): void {
        try {
            const cachedData = storageFallback.getItem(this.CACHE_KEY) as OfflineDataCache;

            if (cachedData && this.isCacheValid(cachedData)) {
                console.log('[DATA FALLBACK] Loaded cached data:', {
                    students: cachedData.students.length,
                    subjects: cachedData.subjects.length,
                    lastUpdated: new Date(cachedData.lastUpdated)
                });
            } else {
                console.log('[DATA FALLBACK] No valid cached data found');
            }
        } catch (error) {
            console.error('[DATA FALLBACK] Error loading cached data:', error);
        }
    }

    /**
     * Check if cache is valid
     */
    private isCacheValid(cache: OfflineDataCache): boolean {
        const now = Date.now();
        const isExpired = (now - cache.lastUpdated) > this.CACHE_EXPIRY;
        const isVersionMatch = cache.version === this.CACHE_VERSION;

        return !isExpired && isVersionMatch;
    }

    /**
     * Cache data for offline use
     */
    private cacheData(students: StudentRecord[], subjects: SubjectConfig[]): void {
        try {
            const cacheData: OfflineDataCache = {
                students,
                subjects,
                lastUpdated: Date.now(),
                version: this.CACHE_VERSION
            };

            storageFallback.setItem(this.CACHE_KEY, cacheData, {
                expiry: this.CACHE_EXPIRY
            });

            console.log('[DATA FALLBACK] Data cached successfully');
        } catch (error) {
            console.error('[DATA FALLBACK] Error caching data:', error);
        }
    }

    /**
     * Load sync queue
     */
    private loadSyncQueue(): void {
        try {
            const syncQueue = storageFallback.getItem(this.SYNC_QUEUE_KEY) || [];
            this.syncStatus.pendingSyncCount = Array.isArray(syncQueue) ? syncQueue.length : 0;
            console.log(`[DATA FALLBACK] Loaded sync queue with ${this.syncStatus.pendingSyncCount} items`);
        } catch (error) {
            console.error('[DATA FALLBACK] Error loading sync queue:', error);
        }
    }

    /**
     * Add operation to sync queue
     */
    private addToSyncQueue(operation: any): void {
        try {
            const syncQueue = storageFallback.getItem(this.SYNC_QUEUE_KEY) || [];
            const queue = Array.isArray(syncQueue) ? syncQueue : [];

            queue.push({
                ...operation,
                timestamp: Date.now(),
                id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            });

            storageFallback.setItem(this.SYNC_QUEUE_KEY, queue);
            this.syncStatus.pendingSyncCount = queue.length;
            this.notifySyncListeners();

            console.log('[DATA FALLBACK] Added operation to sync queue:', operation.type);
        } catch (error) {
            console.error('[DATA FALLBACK] Error adding to sync queue:', error);
        }
    }

    /**
     * Trigger sync process
     */
    private async triggerSync(): Promise<void> {
        if (this.syncStatus.syncInProgress || !this.syncStatus.isOnline) {
            return;
        }

        this.syncStatus.syncInProgress = true;
        this.notifySyncListeners();

        try {
            console.log('[DATA FALLBACK] Starting sync process');

            // Process sync queue
            await this.processSyncQueue();

            // Refresh cached data
            await this.refreshCachedData();

            this.syncStatus.lastSyncTime = new Date();
            console.log('[DATA FALLBACK] Sync completed successfully');
        } catch (error) {
            console.error('[DATA FALLBACK] Sync failed:', error);
        } finally {
            this.syncStatus.syncInProgress = false;
            this.notifySyncListeners();
        }
    }

    /**
     * Process sync queue
     */
    private async processSyncQueue(): Promise<void> {
        try {
            const syncQueue = storageFallback.getItem(this.SYNC_QUEUE_KEY) || [];
            const queue = Array.isArray(syncQueue) ? syncQueue : [];

            if (queue.length === 0) {
                return;
            }

            console.log(`[DATA FALLBACK] Processing ${queue.length} sync operations`);

            const processedItems: string[] = [];

            for (const operation of queue) {
                try {
                    await this.processSyncOperation(operation);
                    processedItems.push(operation.id);
                } catch (error) {
                    console.error('[DATA FALLBACK] Failed to process sync operation:', operation, error);

                    // Remove failed operations that are too old (older than 24 hours)
                    if (Date.now() - operation.timestamp > 24 * 60 * 60 * 1000) {
                        processedItems.push(operation.id);
                        console.log('[DATA FALLBACK] Removing old failed operation:', operation.id);
                    }
                }
            }

            // Remove processed items from queue
            const remainingQueue = queue.filter(op => !processedItems.includes(op.id));
            storageFallback.setItem(this.SYNC_QUEUE_KEY, remainingQueue);
            this.syncStatus.pendingSyncCount = remainingQueue.length;

            console.log(`[DATA FALLBACK] Processed ${processedItems.length} operations, ${remainingQueue.length} remaining`);
        } catch (error) {
            console.error('[DATA FALLBACK] Error processing sync queue:', error);
        }
    }

    /**
     * Process individual sync operation
     */
    private async processSyncOperation(operation: any): Promise<void> {
        switch (operation.type) {
            case 'updateStudentMarks':
                await super.updateStudentMarks(
                    operation.data.studentId,
                    operation.data.subjectId,
                    operation.data.ta,
                    operation.data.ce
                );
                break;

            case 'addStudent':
                await super.addStudent(operation.data);
                break;

            case 'updateStudent':
                await super.updateStudent(operation.data.id, operation.data.updates);
                break;

            case 'deleteStudent':
                await super.deleteStudent(operation.data.id);
                break;

            case 'addSubject':
                await super.addSubject(operation.data);
                break;

            case 'updateSubject':
                await super.updateSubject(operation.data.id, operation.data.updates);
                break;

            case 'deleteSubject':
                await super.deleteSubject(operation.data.id);
                break;

            default:
                console.warn('[DATA FALLBACK] Unknown sync operation type:', operation.type);
        }
    }

    /**
     * Refresh cached data
     */
    private async refreshCachedData(): Promise<void> {
        try {
            const [students, subjects] = await Promise.all([
                super.getAllStudents(),
                super.getAllSubjects()
            ]);

            this.cacheData(students, subjects);
        } catch (error) {
            console.error('[DATA FALLBACK] Error refreshing cached data:', error);
        }
    }

    /**
     * Notify sync listeners
     */
    private notifySyncListeners(): void {
        this.syncListeners.forEach(listener => {
            try {
                listener({ ...this.syncStatus });
            } catch (error) {
                console.error('[DATA FALLBACK] Error in sync listener:', error);
            }
        });
    }

    // Override methods to add fallback functionality

    /**
     * Get all students with fallback
     */
    async getAllStudents(): Promise<StudentRecord[]> {
        try {
            if (this.syncStatus.isOnline) {
                const students = await super.getAllStudents();

                // Cache the data
                const subjects = await super.getAllSubjects();
                this.cacheData(students, subjects);

                return students;
            } else {
                // Use cached data when offline
                const cachedData = storageFallback.getItem(this.CACHE_KEY) as OfflineDataCache;
                if (cachedData && this.isCacheValid(cachedData)) {
                    console.log('[DATA FALLBACK] Using cached students data (offline)');
                    return cachedData.students;
                } else {
                    console.warn('[DATA FALLBACK] No valid cached students data available');
                    return [];
                }
            }
        } catch (error) {
            console.error('[DATA FALLBACK] Error getting students, trying cache:', error);

            // Fallback to cache on error
            const cachedData = storageFallback.getItem(this.CACHE_KEY) as OfflineDataCache;
            if (cachedData) {
                return cachedData.students;
            }

            return [];
        }
    }

    /**
     * Get all subjects with fallback
     */
    async getAllSubjects(): Promise<SubjectConfig[]> {
        try {
            if (this.syncStatus.isOnline) {
                const subjects = await super.getAllSubjects();

                // Cache the data
                const students = await super.getAllStudents();
                this.cacheData(students, subjects);

                return subjects;
            } else {
                // Use cached data when offline
                const cachedData = storageFallback.getItem(this.CACHE_KEY) as OfflineDataCache;
                if (cachedData && this.isCacheValid(cachedData)) {
                    console.log('[DATA FALLBACK] Using cached subjects data (offline)');
                    return cachedData.subjects;
                } else {
                    console.warn('[DATA FALLBACK] No valid cached subjects data available');
                    return [];
                }
            }
        } catch (error) {
            console.error('[DATA FALLBACK] Error getting subjects, trying cache:', error);

            // Fallback to cache on error
            const cachedData = storageFallback.getItem(this.CACHE_KEY) as OfflineDataCache;
            if (cachedData) {
                return cachedData.subjects;
            }

            return [];
        }
    }

    /**
     * Update student marks with offline support
     */
    async updateStudentMarks(studentId: string, subjectId: string, ta: number, ce: number): Promise<void> {
        const operation = {
            type: 'updateStudentMarks',
            data: { studentId, subjectId, ta, ce }
        };

        if (this.syncStatus.isOnline) {
            try {
                await super.updateStudentMarks(studentId, subjectId, ta, ce);
                console.log('[DATA FALLBACK] Student marks updated online');
            } catch (error) {
                console.error('[DATA FALLBACK] Failed to update marks online, queuing for sync:', error);
                this.addToSyncQueue(operation);
                throw error;
            }
        } else {
            console.log('[DATA FALLBACK] Offline: queuing marks update for sync');
            this.addToSyncQueue(operation);

            // Update local cache if available
            this.updateLocalCache(operation);
        }
    }

    /**
     * Add student with offline support
     */
    async addStudent(student: Omit<StudentRecord, 'id'>): Promise<string> {
        const operation = {
            type: 'addStudent',
            data: student
        };

        if (this.syncStatus.isOnline) {
            try {
                return await super.addStudent(student);
            } catch (error) {
                console.error('[DATA FALLBACK] Failed to add student online, queuing for sync:', error);
                this.addToSyncQueue(operation);
                throw error;
            }
        } else {
            console.log('[DATA FALLBACK] Offline: queuing student addition for sync');
            this.addToSyncQueue(operation);

            // Generate temporary ID for offline use
            const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Update local cache
            this.updateLocalCache({
                type: 'addStudent',
                data: { ...student, id: tempId }
            });

            return tempId;
        }
    }

    /**
     * Update local cache with operation
     */
    private updateLocalCache(operation: any): void {
        try {
            const cachedData = storageFallback.getItem(this.CACHE_KEY) as OfflineDataCache;
            if (!cachedData) return;

            let updated = false;

            switch (operation.type) {
                case 'updateStudentMarks':
                    const student = cachedData.students.find(s => s.id === operation.data.studentId);
                    if (student) {
                        student.marks[operation.data.subjectId] = {
                            ta: operation.data.ta,
                            ce: operation.data.ce,
                            total: operation.data.ta + operation.data.ce,
                            status: 'Pending' // Will be calculated on sync
                        };
                        updated = true;
                    }
                    break;

                case 'addStudent':
                    cachedData.students.push(operation.data);
                    updated = true;
                    break;
            }

            if (updated) {
                cachedData.lastUpdated = Date.now();
                storageFallback.setItem(this.CACHE_KEY, cachedData);
                console.log('[DATA FALLBACK] Local cache updated');
            }
        } catch (error) {
            console.error('[DATA FALLBACK] Error updating local cache:', error);
        }
    }

    /**
     * Get sync status
     */
    getSyncStatus(): DataSyncStatus {
        return { ...this.syncStatus };
    }

    /**
     * Add sync status listener
     */
    addSyncStatusListener(listener: (status: DataSyncStatus) => void): void {
        this.syncListeners.add(listener);
    }

    /**
     * Remove sync status listener
     */
    removeSyncStatusListener(listener: (status: DataSyncStatus) => void): void {
        this.syncListeners.delete(listener);
    }

    /**
     * Force sync
     */
    async forceSync(): Promise<void> {
        console.log('[DATA FALLBACK] Force sync requested');
        await this.triggerSync();
    }

    /**
     * Clear offline cache
     */
    clearOfflineCache(): void {
        storageFallback.removeItem(this.CACHE_KEY);
        storageFallback.removeItem(this.SYNC_QUEUE_KEY);
        this.syncStatus.pendingSyncCount = 0;
        this.notifySyncListeners();
        console.log('[DATA FALLBACK] Offline cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): {
        cacheSize: number;
        studentsCount: number;
        subjectsCount: number;
        lastUpdated: Date | null;
        pendingSyncCount: number;
    } {
        try {
            const cachedData = storageFallback.getItem(this.CACHE_KEY) as OfflineDataCache;

            if (cachedData) {
                return {
                    cacheSize: JSON.stringify(cachedData).length,
                    studentsCount: cachedData.students.length,
                    subjectsCount: cachedData.subjects.length,
                    lastUpdated: new Date(cachedData.lastUpdated),
                    pendingSyncCount: this.syncStatus.pendingSyncCount
                };
            }
        } catch (error) {
            console.error('[DATA FALLBACK] Error getting cache stats:', error);
        }

        return {
            cacheSize: 0,
            studentsCount: 0,
            subjectsCount: 0,
            lastUpdated: null,
            pendingSyncCount: this.syncStatus.pendingSyncCount
        };
    }

    /**
     * Check if offline mode is active
     */
    isOfflineMode(): boolean {
        return !this.syncStatus.isOnline;
    }

    /**
     * Check if data is available (online or cached)
     */
    isDataAvailable(): boolean {
        if (this.syncStatus.isOnline) {
            return true;
        }

        const cachedData = storageFallback.getItem(this.CACHE_KEY) as OfflineDataCache;
        return cachedData && this.isCacheValid(cachedData);
    }
}

// Export singleton instance
export const enhancedDataService = new EnhancedDataServiceWithFallback();