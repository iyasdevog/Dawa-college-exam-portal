// Offline Storage Service for AIC Da'wa College Exam Portal
// Manages local storage of draft marks entries and offline data synchronization

import { StudentRecord, SubjectConfig } from '../types';

export interface OfflineMarksEntry {
    id: string;
    studentId: string;
    subjectId: string;
    ta: number;
    ce: number;
    timestamp: number;
    synced: boolean;
    className: string;
    studentName: string;
    subjectName: string;
}

export interface OfflineDraft {
    id: string;
    studentId: string;
    subjectId: string;
    ta: string;
    ce: string;
    timestamp: number;
    className: string;
    studentName: string;
    subjectName: string;
    autoSaved: boolean;
}

export interface OfflineStatus {
    isOnline: boolean;
    lastSync: number | null;
    pendingEntries: number;
    pendingDrafts: number;
}

class OfflineStorageService {
    private dbName = 'AICDawaCollegeOfflineDB';
    private dbVersion = 1;
    private db: IDBDatabase | null = null;

    // Store names
    private readonly MARKS_STORE = 'marksEntries';
    private readonly DRAFTS_STORE = 'drafts';
    private readonly SYNC_STORE = 'syncStatus';

    // LocalStorage keys for fallback
    private readonly DRAFTS_KEY = 'aic_dawa_drafts';
    private readonly MARKS_KEY = 'aic_dawa_offline_marks';
    private readonly STATUS_KEY = 'aic_dawa_offline_status';

    constructor() {
        this.initializeDB();
        this.setupOnlineStatusListener();
    }

    // Initialize IndexedDB
    private async initializeDB(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('OfflineStorage: Failed to open IndexedDB');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('OfflineStorage: IndexedDB initialized successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create marks entries store
                if (!db.objectStoreNames.contains(this.MARKS_STORE)) {
                    const marksStore = db.createObjectStore(this.MARKS_STORE, { keyPath: 'id' });
                    marksStore.createIndex('studentId', 'studentId', { unique: false });
                    marksStore.createIndex('subjectId', 'subjectId', { unique: false });
                    marksStore.createIndex('timestamp', 'timestamp', { unique: false });
                    marksStore.createIndex('synced', 'synced', { unique: false });
                }

                // Create drafts store
                if (!db.objectStoreNames.contains(this.DRAFTS_STORE)) {
                    const draftsStore = db.createObjectStore(this.DRAFTS_STORE, { keyPath: 'id' });
                    draftsStore.createIndex('studentId', 'studentId', { unique: false });
                    draftsStore.createIndex('subjectId', 'subjectId', { unique: false });
                    draftsStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Create sync status store
                if (!db.objectStoreNames.contains(this.SYNC_STORE)) {
                    db.createObjectStore(this.SYNC_STORE, { keyPath: 'key' });
                }

                console.log('OfflineStorage: Database schema created/updated');
            };
        });
    }

    // Setup online/offline status listener
    private setupOnlineStatusListener(): void {
        window.addEventListener('online', () => {
            console.log('OfflineStorage: Device is online');
            this.updateOnlineStatus(true);
            this.triggerSync();
        });

        window.addEventListener('offline', () => {
            console.log('OfflineStorage: Device is offline');
            this.updateOnlineStatus(false);
        });
    }

    // Check if device is online
    public isOnline(): boolean {
        return navigator.onLine;
    }

    // Update online status
    private async updateOnlineStatus(isOnline: boolean): Promise<void> {
        const status: OfflineStatus = {
            isOnline,
            lastSync: isOnline ? Date.now() : await this.getLastSyncTime(),
            pendingEntries: await this.getPendingEntriesCount(),
            pendingDrafts: await this.getPendingDraftsCount()
        };

        await this.setOfflineStatus(status);
    }

    // Save draft marks entry
    public async saveDraft(
        studentId: string,
        subjectId: string,
        ta: string,
        ce: string,
        studentName: string,
        subjectName: string,
        className: string,
        autoSaved: boolean = false
    ): Promise<string> {
        const draft: OfflineDraft = {
            id: `draft_${studentId}_${subjectId}_${Date.now()}`,
            studentId,
            subjectId,
            ta,
            ce,
            timestamp: Date.now(),
            className,
            studentName,
            subjectName,
            autoSaved
        };

        try {
            if (this.db) {
                await this.saveToIndexedDB(this.DRAFTS_STORE, draft);
            } else {
                await this.saveToLocalStorage(this.DRAFTS_KEY, draft);
            }

            console.log('OfflineStorage: Draft saved:', draft.id);
            return draft.id;
        } catch (error) {
            console.error('OfflineStorage: Failed to save draft:', error);
            throw error;
        }
    }

    // Get all drafts
    public async getDrafts(): Promise<OfflineDraft[]> {
        try {
            if (this.db) {
                return await this.getAllFromIndexedDB(this.DRAFTS_STORE);
            } else {
                return await this.getAllFromLocalStorage(this.DRAFTS_KEY);
            }
        } catch (error) {
            console.error('OfflineStorage: Failed to get drafts:', error);
            return [];
        }
    }

    // Get drafts for specific student and subject
    public async getDraftForStudentSubject(studentId: string, subjectId: string): Promise<OfflineDraft | null> {
        try {
            const drafts = await this.getDrafts();
            return drafts.find(draft =>
                draft.studentId === studentId &&
                draft.subjectId === subjectId
            ) || null;
        } catch (error) {
            console.error('OfflineStorage: Failed to get draft for student/subject:', error);
            return null;
        }
    }

    // Delete draft
    public async deleteDraft(draftId: string): Promise<void> {
        try {
            if (this.db) {
                await this.deleteFromIndexedDB(this.DRAFTS_STORE, draftId);
            } else {
                await this.deleteFromLocalStorage(this.DRAFTS_KEY, draftId);
            }

            console.log('OfflineStorage: Draft deleted:', draftId);
        } catch (error) {
            console.error('OfflineStorage: Failed to delete draft:', error);
            throw error;
        }
    }

    // Save marks entry for offline sync
    public async saveMarksEntry(
        studentId: string,
        subjectId: string,
        ta: number,
        ce: number,
        studentName: string,
        subjectName: string,
        className: string
    ): Promise<string> {
        const entry: OfflineMarksEntry = {
            id: `marks_${studentId}_${subjectId}_${Date.now()}`,
            studentId,
            subjectId,
            ta,
            ce,
            timestamp: Date.now(),
            synced: false,
            className,
            studentName,
            subjectName
        };

        try {
            if (this.db) {
                await this.saveToIndexedDB(this.MARKS_STORE, entry);
            } else {
                await this.saveToLocalStorage(this.MARKS_KEY, entry);
            }

            console.log('OfflineStorage: Marks entry saved for sync:', entry.id);
            return entry.id;
        } catch (error) {
            console.error('OfflineStorage: Failed to save marks entry:', error);
            throw error;
        }
    }

    // Get pending marks entries (not synced)
    public async getPendingMarksEntries(): Promise<OfflineMarksEntry[]> {
        try {
            if (this.db) {
                return await this.getFromIndexedDBByIndex(this.MARKS_STORE, 'synced', false);
            } else {
                const entries = await this.getAllFromLocalStorage(this.MARKS_KEY);
                return entries.filter((entry: OfflineMarksEntry) => !entry.synced);
            }
        } catch (error) {
            console.error('OfflineStorage: Failed to get pending marks entries:', error);
            return [];
        }
    }

    // Mark entry as synced
    public async markEntryAsSynced(entryId: string): Promise<void> {
        try {
            if (this.db) {
                const entry = await this.getFromIndexedDB(this.MARKS_STORE, entryId);
                if (entry) {
                    entry.synced = true;
                    await this.saveToIndexedDB(this.MARKS_STORE, entry);
                }
            } else {
                const entries = await this.getAllFromLocalStorage(this.MARKS_KEY);
                const entryIndex = entries.findIndex((e: OfflineMarksEntry) => e.id === entryId);
                if (entryIndex !== -1) {
                    entries[entryIndex].synced = true;
                    localStorage.setItem(this.MARKS_KEY, JSON.stringify(entries));
                }
            }

            console.log('OfflineStorage: Entry marked as synced:', entryId);
        } catch (error) {
            console.error('OfflineStorage: Failed to mark entry as synced:', error);
            throw error;
        }
    }

    // Get offline status
    public async getOfflineStatus(): Promise<OfflineStatus> {
        try {
            const status = await this.getFromIndexedDB(this.SYNC_STORE, 'status') ||
                JSON.parse(localStorage.getItem(this.STATUS_KEY) || 'null');

            if (status) {
                return status.value || status;
            }

            // Default status
            return {
                isOnline: this.isOnline(),
                lastSync: null,
                pendingEntries: await this.getPendingEntriesCount(),
                pendingDrafts: await this.getPendingDraftsCount()
            };
        } catch (error) {
            console.error('OfflineStorage: Failed to get offline status:', error);
            return {
                isOnline: this.isOnline(),
                lastSync: null,
                pendingEntries: 0,
                pendingDrafts: 0
            };
        }
    }

    // Set offline status
    private async setOfflineStatus(status: OfflineStatus): Promise<void> {
        try {
            if (this.db) {
                await this.saveToIndexedDB(this.SYNC_STORE, { key: 'status', value: status });
            } else {
                localStorage.setItem(this.STATUS_KEY, JSON.stringify(status));
            }
        } catch (error) {
            console.error('OfflineStorage: Failed to set offline status:', error);
        }
    }

    // Get counts
    private async getPendingEntriesCount(): Promise<number> {
        const entries = await this.getPendingMarksEntries();
        return entries.length;
    }

    private async getPendingDraftsCount(): Promise<number> {
        const drafts = await this.getDrafts();
        return drafts.length;
    }

    private async getLastSyncTime(): Promise<number | null> {
        const status = await this.getOfflineStatus();
        return status.lastSync;
    }

    // Trigger sync when online
    public async triggerSync(): Promise<void> {
        if (!this.isOnline()) {
            console.log('OfflineStorage: Cannot sync - device is offline');
            return;
        }

        try {
            const pendingEntries = await this.getPendingMarksEntries();

            if (pendingEntries.length === 0) {
                console.log('OfflineStorage: No pending entries to sync');
                return;
            }

            console.log(`OfflineStorage: Syncing ${pendingEntries.length} pending entries...`);

            // Register background sync if available
            if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
                const registration = await navigator.serviceWorker.ready;
                await (registration as any).sync?.register('sync-marks-data');
                console.log('OfflineStorage: Background sync registered');
            } else {
                // Fallback: sync immediately
                await this.syncNow();
            }
        } catch (error) {
            console.error('OfflineStorage: Failed to trigger sync:', error);
        }
    }

    // Immediate sync
    private async syncNow(): Promise<void> {
        const pendingEntries = await this.getPendingMarksEntries();

        for (const entry of pendingEntries) {
            try {
                // This would integrate with the actual dataService
                // For now, we'll just mark as synced after a delay
                await new Promise(resolve => setTimeout(resolve, 100));
                await this.markEntryAsSynced(entry.id);
                console.log('OfflineStorage: Synced entry:', entry.id);
            } catch (error) {
                console.error('OfflineStorage: Failed to sync entry:', entry.id, error);
            }
        }

        // Update sync status
        await this.updateOnlineStatus(true);
    }

    // Clear all offline data
    public async clearAllOfflineData(): Promise<void> {
        try {
            if (this.db) {
                await this.clearIndexedDBStore(this.MARKS_STORE);
                await this.clearIndexedDBStore(this.DRAFTS_STORE);
                await this.clearIndexedDBStore(this.SYNC_STORE);
            }

            localStorage.removeItem(this.DRAFTS_KEY);
            localStorage.removeItem(this.MARKS_KEY);
            localStorage.removeItem(this.STATUS_KEY);

            console.log('OfflineStorage: All offline data cleared');
        } catch (error) {
            console.error('OfflineStorage: Failed to clear offline data:', error);
            throw error;
        }
    }

    // IndexedDB helper methods
    private async saveToIndexedDB(storeName: string, data: any): Promise<void> {
        if (!this.db) throw new Error('IndexedDB not initialized');

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    private async getFromIndexedDB(storeName: string, key: string): Promise<any> {
        if (!this.db) return null;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    private async getAllFromIndexedDB(storeName: string): Promise<any[]> {
        if (!this.db) return [];

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    private async getFromIndexedDBByIndex(storeName: string, indexName: string, value: any): Promise<any[]> {
        if (!this.db) return [];

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    private async deleteFromIndexedDB(storeName: string, key: string): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    private async clearIndexedDBStore(storeName: string): Promise<void> {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // LocalStorage helper methods (fallback)
    private async saveToLocalStorage(key: string, data: any): Promise<void> {
        try {
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            const index = existing.findIndex((item: any) => item.id === data.id);

            if (index !== -1) {
                existing[index] = data;
            } else {
                existing.push(data);
            }

            localStorage.setItem(key, JSON.stringify(existing));
        } catch (error) {
            console.error('OfflineStorage: LocalStorage save failed:', error);
            throw error;
        }
    }

    private async getAllFromLocalStorage(key: string): Promise<any[]> {
        try {
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch (error) {
            console.error('OfflineStorage: LocalStorage get failed:', error);
            return [];
        }
    }

    private async deleteFromLocalStorage(key: string, id: string): Promise<void> {
        try {
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            const filtered = existing.filter((item: any) => item.id !== id);
            localStorage.setItem(key, JSON.stringify(filtered));
        } catch (error) {
            console.error('OfflineStorage: LocalStorage delete failed:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const offlineStorageService = new OfflineStorageService();