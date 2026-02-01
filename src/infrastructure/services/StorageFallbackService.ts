/**
 * Storage Fallback Service
 * Provides graceful degradation from localStorage to sessionStorage to memory storage
 * Following Clean Architecture - Infrastructure Layer
 */

export type StorageType = 'localStorage' | 'sessionStorage' | 'memory' | 'none';

export interface StorageCapabilities {
    localStorage: boolean;
    sessionStorage: boolean;
    quotaExceeded: boolean;
    available: boolean;
}

export interface StorageItem {
    value: any;
    timestamp: number;
    expiry?: number;
    compressed?: boolean;
}

export interface StorageOptions {
    expiry?: number; // TTL in milliseconds
    compress?: boolean; // Whether to compress large values
    fallbackToMemory?: boolean; // Whether to fallback to memory storage
    syncAcrossStorages?: boolean; // Whether to sync data across storage types
}

export interface StorageStats {
    currentType: StorageType;
    itemCount: number;
    estimatedSize: number;
    quotaUsed?: number;
    quotaRemaining?: number;
}

export class StorageFallbackService {
    private currentStorageType: StorageType = 'none';
    private memoryStorage: Map<string, StorageItem> = new Map();
    private capabilities: StorageCapabilities;
    private storageEventListeners: Set<(event: StorageEvent) => void> = new Set();
    private memoryEventListeners: Set<(key: string, oldValue: any, newValue: any) => void> = new Set();
    private compressionEnabled: boolean = false;

    constructor() {
        this.capabilities = this.detectStorageCapabilities();
        this.currentStorageType = this.selectBestStorage();
        this.initializeStorage();
        this.setupStorageEventHandlers();
    }

    /**
     * Detect storage capabilities
     */
    private detectStorageCapabilities(): StorageCapabilities {
        const capabilities: StorageCapabilities = {
            localStorage: false,
            sessionStorage: false,
            quotaExceeded: false,
            available: false
        };

        // Test localStorage
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            capabilities.localStorage = true;
        } catch (error) {
            console.warn('[STORAGE] localStorage not available:', error);
            if (error instanceof DOMException && error.code === 22) {
                capabilities.quotaExceeded = true;
            }
        }

        // Test sessionStorage
        try {
            const test = '__storage_test__';
            sessionStorage.setItem(test, test);
            sessionStorage.removeItem(test);
            capabilities.sessionStorage = true;
        } catch (error) {
            console.warn('[STORAGE] sessionStorage not available:', error);
        }

        capabilities.available = capabilities.localStorage || capabilities.sessionStorage;
        return capabilities;
    }

    /**
     * Select the best available storage type
     */
    private selectBestStorage(): StorageType {
        if (this.capabilities.localStorage) {
            return 'localStorage';
        } else if (this.capabilities.sessionStorage) {
            return 'sessionStorage';
        } else {
            return 'memory';
        }
    }

    /**
     * Initialize storage
     */
    private initializeStorage(): void {
        console.log(`[STORAGE] Initialized with ${this.currentStorageType} storage`);

        // Enable compression for memory storage to save RAM
        if (this.currentStorageType === 'memory') {
            this.compressionEnabled = true;
        }

        // Migrate data if needed
        this.migrateDataIfNeeded();

        // Clean up expired items
        this.cleanupExpiredItems();
    }

    /**
     * Set up storage event handlers
     */
    private setupStorageEventHandlers(): void {
        // Listen for storage events (only works for localStorage/sessionStorage)
        if (this.currentStorageType !== 'memory') {
            window.addEventListener('storage', (event) => {
                this.storageEventListeners.forEach(listener => {
                    try {
                        listener(event);
                    } catch (error) {
                        console.error('[STORAGE] Error in storage event listener:', error);
                    }
                });
            });
        }

        // Listen for quota exceeded errors
        window.addEventListener('error', (event) => {
            if (event.error instanceof DOMException && event.error.code === 22) {
                console.warn('[STORAGE] Storage quota exceeded, attempting fallback');
                this.handleQuotaExceeded();
            }
        });
    }

    /**
     * Migrate data from higher priority storage to current storage
     */
    private migrateDataIfNeeded(): void {
        const migrationSources: StorageType[] = [];

        if (this.currentStorageType === 'sessionStorage' && this.capabilities.localStorage) {
            migrationSources.push('localStorage');
        } else if (this.currentStorageType === 'memory') {
            if (this.capabilities.localStorage) migrationSources.push('localStorage');
            if (this.capabilities.sessionStorage) migrationSources.push('sessionStorage');
        }

        migrationSources.forEach(sourceType => {
            try {
                this.migrateFromStorage(sourceType);
            } catch (error) {
                console.warn(`[STORAGE] Failed to migrate from ${sourceType}:`, error);
            }
        });
    }

    /**
     * Migrate data from a specific storage type
     */
    private migrateFromStorage(sourceType: StorageType): void {
        const sourceStorage = this.getStorageByType(sourceType);
        if (!sourceStorage) return;

        const keys = Object.keys(sourceStorage);
        let migratedCount = 0;

        keys.forEach(key => {
            try {
                const value = sourceStorage.getItem(key);
                if (value !== null) {
                    this.setItem(key, JSON.parse(value), { fallbackToMemory: false });
                    migratedCount++;
                }
            } catch (error) {
                console.warn(`[STORAGE] Failed to migrate key ${key} from ${sourceType}:`, error);
            }
        });

        if (migratedCount > 0) {
            console.log(`[STORAGE] Migrated ${migratedCount} items from ${sourceType}`);
        }
    }

    /**
     * Get storage object by type
     */
    private getStorageByType(type: StorageType): Storage | null {
        switch (type) {
            case 'localStorage':
                return this.capabilities.localStorage ? localStorage : null;
            case 'sessionStorage':
                return this.capabilities.sessionStorage ? sessionStorage : null;
            default:
                return null;
        }
    }

    /**
     * Handle quota exceeded error
     */
    private handleQuotaExceeded(): void {
        console.warn('[STORAGE] Storage quota exceeded, attempting cleanup and fallback');

        // Try to clean up expired items first
        const cleanedCount = this.cleanupExpiredItems();

        if (cleanedCount > 0) {
            console.log(`[STORAGE] Cleaned up ${cleanedCount} expired items`);
            return;
        }

        // If cleanup didn't help, fallback to next storage type
        this.fallbackToNextStorage();
    }

    /**
     * Fallback to the next available storage type
     */
    private fallbackToNextStorage(): void {
        const currentType = this.currentStorageType;

        if (currentType === 'localStorage' && this.capabilities.sessionStorage) {
            this.currentStorageType = 'sessionStorage';
            console.log('[STORAGE] Falling back to sessionStorage');
        } else if (currentType !== 'memory') {
            this.currentStorageType = 'memory';
            console.log('[STORAGE] Falling back to memory storage');
        } else {
            console.error('[STORAGE] No fallback storage available');
            return;
        }

        // Migrate critical data to new storage
        this.migrateFromStorage(currentType);
    }

    /**
     * Clean up expired items
     */
    private cleanupExpiredItems(): number {
        let cleanedCount = 0;
        const now = Date.now();

        if (this.currentStorageType === 'memory') {
            // Clean memory storage
            this.memoryStorage.forEach((item, key) => {
                if (item.expiry && item.expiry < now) {
                    this.memoryStorage.delete(key);
                    cleanedCount++;
                }
            });
        } else {
            // Clean web storage
            const storage = this.getStorageByType(this.currentStorageType);
            if (storage) {
                const keys = Object.keys(storage);
                keys.forEach(key => {
                    try {
                        const rawValue = storage.getItem(key);
                        if (rawValue) {
                            const item: StorageItem = JSON.parse(rawValue);
                            if (item.expiry && item.expiry < now) {
                                storage.removeItem(key);
                                cleanedCount++;
                            }
                        }
                    } catch (error) {
                        // Invalid JSON, remove the item
                        storage.removeItem(key);
                        cleanedCount++;
                    }
                });
            }
        }

        return cleanedCount;
    }

    /**
     * Compress data if needed
     */
    private compressData(data: any): string {
        const jsonString = JSON.stringify(data);

        if (!this.compressionEnabled || jsonString.length < 1000) {
            return jsonString;
        }

        // Simple compression using repeated character replacement
        // In a real implementation, you might use a proper compression library
        return jsonString
            .replace(/\s+/g, ' ')
            .replace(/,"/g, ',"')
            .replace(/":"/g, '":"')
            .replace(/","/g, '","');
    }

    /**
     * Decompress data if needed
     */
    private decompressData(compressedData: string): any {
        try {
            return JSON.parse(compressedData);
        } catch (error) {
            console.error('[STORAGE] Failed to decompress data:', error);
            return null;
        }
    }

    /**
     * Set an item in storage with fallback
     */
    public setItem(key: string, value: any, options: StorageOptions = {}): boolean {
        const item: StorageItem = {
            value,
            timestamp: Date.now(),
            expiry: options.expiry ? Date.now() + options.expiry : undefined,
            compressed: this.compressionEnabled
        };

        const serializedItem = this.compressData(item);

        // Try current storage first
        if (this.trySetItem(key, serializedItem)) {
            this.notifyMemoryListeners(key, this.getItem(key), value);
            return true;
        }

        // If current storage fails and fallback is enabled, try memory storage
        if (options.fallbackToMemory !== false && this.currentStorageType !== 'memory') {
            console.warn(`[STORAGE] Failed to set item in ${this.currentStorageType}, falling back to memory`);
            this.memoryStorage.set(key, item);
            this.notifyMemoryListeners(key, null, value);
            return true;
        }

        return false;
    }

    /**
     * Try to set an item in the current storage
     */
    private trySetItem(key: string, serializedItem: string): boolean {
        try {
            if (this.currentStorageType === 'memory') {
                const item: StorageItem = JSON.parse(serializedItem);
                this.memoryStorage.set(key, item);
                return true;
            } else {
                const storage = this.getStorageByType(this.currentStorageType);
                if (storage) {
                    storage.setItem(key, serializedItem);
                    return true;
                }
            }
        } catch (error) {
            if (error instanceof DOMException && error.code === 22) {
                this.handleQuotaExceeded();
            } else {
                console.error(`[STORAGE] Error setting item in ${this.currentStorageType}:`, error);
            }
        }
        return false;
    }

    /**
     * Get an item from storage with fallback
     */
    public getItem(key: string): any {
        try {
            let item: StorageItem | null = null;

            if (this.currentStorageType === 'memory') {
                item = this.memoryStorage.get(key) || null;
            } else {
                const storage = this.getStorageByType(this.currentStorageType);
                if (storage) {
                    const rawValue = storage.getItem(key);
                    if (rawValue) {
                        item = this.decompressData(rawValue);
                    }
                }
            }

            if (!item) {
                // Try fallback storages
                return this.getItemFromFallback(key);
            }

            // Check if item has expired
            if (item.expiry && item.expiry < Date.now()) {
                this.removeItem(key);
                return null;
            }

            return item.value;
        } catch (error) {
            console.error(`[STORAGE] Error getting item from ${this.currentStorageType}:`, error);
            return this.getItemFromFallback(key);
        }
    }

    /**
     * Get item from fallback storages
     */
    private getItemFromFallback(key: string): any {
        const fallbackTypes: StorageType[] = [];

        if (this.currentStorageType !== 'localStorage' && this.capabilities.localStorage) {
            fallbackTypes.push('localStorage');
        }
        if (this.currentStorageType !== 'sessionStorage' && this.capabilities.sessionStorage) {
            fallbackTypes.push('sessionStorage');
        }
        if (this.currentStorageType !== 'memory') {
            fallbackTypes.push('memory');
        }

        for (const type of fallbackTypes) {
            try {
                if (type === 'memory') {
                    const item = this.memoryStorage.get(key);
                    if (item && (!item.expiry || item.expiry > Date.now())) {
                        return item.value;
                    }
                } else {
                    const storage = this.getStorageByType(type);
                    if (storage) {
                        const rawValue = storage.getItem(key);
                        if (rawValue) {
                            const item: StorageItem = JSON.parse(rawValue);
                            if (!item.expiry || item.expiry > Date.now()) {
                                return item.value;
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn(`[STORAGE] Error accessing fallback storage ${type}:`, error);
            }
        }

        return null;
    }

    /**
     * Remove an item from storage
     */
    public removeItem(key: string): boolean {
        try {
            const oldValue = this.getItem(key);

            if (this.currentStorageType === 'memory') {
                const existed = this.memoryStorage.has(key);
                this.memoryStorage.delete(key);
                if (existed) {
                    this.notifyMemoryListeners(key, oldValue, null);
                }
                return existed;
            } else {
                const storage = this.getStorageByType(this.currentStorageType);
                if (storage) {
                    const existed = storage.getItem(key) !== null;
                    storage.removeItem(key);
                    if (existed) {
                        this.notifyMemoryListeners(key, oldValue, null);
                    }
                    return existed;
                }
            }
        } catch (error) {
            console.error(`[STORAGE] Error removing item from ${this.currentStorageType}:`, error);
        }
        return false;
    }

    /**
     * Clear all items from current storage
     */
    public clear(): void {
        try {
            if (this.currentStorageType === 'memory') {
                this.memoryStorage.clear();
            } else {
                const storage = this.getStorageByType(this.currentStorageType);
                if (storage) {
                    storage.clear();
                }
            }
        } catch (error) {
            console.error(`[STORAGE] Error clearing ${this.currentStorageType}:`, error);
        }
    }

    /**
     * Get all keys from current storage
     */
    public keys(): string[] {
        try {
            if (this.currentStorageType === 'memory') {
                return Array.from(this.memoryStorage.keys());
            } else {
                const storage = this.getStorageByType(this.currentStorageType);
                if (storage) {
                    return Object.keys(storage);
                }
            }
        } catch (error) {
            console.error(`[STORAGE] Error getting keys from ${this.currentStorageType}:`, error);
        }
        return [];
    }

    /**
     * Get storage statistics
     */
    public getStats(): StorageStats {
        const keys = this.keys();
        let estimatedSize = 0;

        keys.forEach(key => {
            try {
                const value = this.getItem(key);
                estimatedSize += JSON.stringify(value).length;
            } catch (error) {
                // Ignore errors for individual items
            }
        });

        const stats: StorageStats = {
            currentType: this.currentStorageType,
            itemCount: keys.length,
            estimatedSize
        };

        // Add quota information for web storage
        if (this.currentStorageType !== 'memory' && 'navigator' in window && 'storage' in navigator && 'estimate' in navigator.storage) {
            navigator.storage.estimate().then(estimate => {
                if (estimate.quota && estimate.usage) {
                    stats.quotaUsed = estimate.usage;
                    stats.quotaRemaining = estimate.quota - estimate.usage;
                }
            }).catch(() => {
                // Quota API not available
            });
        }

        return stats;
    }

    /**
     * Get storage capabilities
     */
    public getCapabilities(): StorageCapabilities {
        return { ...this.capabilities };
    }

    /**
     * Get current storage type
     */
    public getCurrentStorageType(): StorageType {
        return this.currentStorageType;
    }

    /**
     * Check if storage is available
     */
    public isAvailable(): boolean {
        return this.currentStorageType !== 'none';
    }

    /**
     * Add storage event listener
     */
    public addEventListener(listener: (event: StorageEvent) => void): void {
        this.storageEventListeners.add(listener);
    }

    /**
     * Remove storage event listener
     */
    public removeEventListener(listener: (event: StorageEvent) => void): void {
        this.storageEventListeners.delete(listener);
    }

    /**
     * Add memory storage event listener
     */
    public addMemoryEventListener(listener: (key: string, oldValue: any, newValue: any) => void): void {
        this.memoryEventListeners.add(listener);
    }

    /**
     * Remove memory storage event listener
     */
    public removeMemoryEventListener(listener: (key: string, oldValue: any, newValue: any) => void): void {
        this.memoryEventListeners.delete(listener);
    }

    /**
     * Notify memory event listeners
     */
    private notifyMemoryListeners(key: string, oldValue: any, newValue: any): void {
        this.memoryEventListeners.forEach(listener => {
            try {
                listener(key, oldValue, newValue);
            } catch (error) {
                console.error('[STORAGE] Error in memory event listener:', error);
            }
        });
    }

    /**
     * Force fallback to a specific storage type
     */
    public forceFallback(targetType: StorageType): boolean {
        if (targetType === this.currentStorageType) {
            return true;
        }

        const oldType = this.currentStorageType;

        // Validate target type is available
        if (targetType === 'localStorage' && !this.capabilities.localStorage) {
            return false;
        }
        if (targetType === 'sessionStorage' && !this.capabilities.sessionStorage) {
            return false;
        }

        // Migrate data to new storage
        try {
            this.migrateFromStorage(oldType);
            this.currentStorageType = targetType;
            console.log(`[STORAGE] Forced fallback from ${oldType} to ${targetType}`);
            return true;
        } catch (error) {
            console.error(`[STORAGE] Failed to force fallback to ${targetType}:`, error);
            return false;
        }
    }

    /**
     * Graceful degradation when all storage is unavailable
     */
    public handleStorageUnavailable(): void {
        console.warn('[STORAGE] All storage mechanisms unavailable, operating in degraded mode');
        this.currentStorageType = 'none';
        this.capabilities.available = false;

        // Clear memory storage to free up resources
        this.memoryStorage.clear();

        // Notify listeners about storage unavailability
        this.notifyMemoryListeners('__storage_unavailable__', null, 'unavailable');
    }

    /**
     * Attempt to recover storage capabilities
     */
    public attemptStorageRecovery(): boolean {
        console.log('[STORAGE] Attempting storage recovery...');

        // Re-detect capabilities
        this.capabilities = this.detectStorageCapabilities();

        if (this.capabilities.available) {
            const newStorageType = this.selectBestStorage();
            if (newStorageType !== 'none') {
                this.currentStorageType = newStorageType;
                console.log(`[STORAGE] Storage recovered, using ${newStorageType}`);
                return true;
            }
        }

        console.warn('[STORAGE] Storage recovery failed');
        return false;
    }

    /**
     * Get storage health status
     */
    public getStorageHealth(): {
        status: 'healthy' | 'degraded' | 'unavailable';
        currentType: StorageType;
        capabilities: StorageCapabilities;
        issues: string[];
    } {
        const issues: string[] = [];
        let status: 'healthy' | 'degraded' | 'unavailable' = 'healthy';

        if (!this.capabilities.available) {
            status = 'unavailable';
            issues.push('No storage mechanisms available');
        } else if (this.currentStorageType === 'memory') {
            status = 'degraded';
            issues.push('Using memory storage only - data will not persist');
        } else if (this.capabilities.quotaExceeded) {
            status = 'degraded';
            issues.push('Storage quota exceeded');
        }

        if (!this.capabilities.localStorage) {
            issues.push('localStorage unavailable');
        }
        if (!this.capabilities.sessionStorage) {
            issues.push('sessionStorage unavailable');
        }

        return {
            status,
            currentType: this.currentStorageType,
            capabilities: { ...this.capabilities },
            issues
        };
    }

    /**
     * Test storage functionality
     */
    public testStorage(): { [key in StorageType]?: boolean } {
        const results: { [key in StorageType]?: boolean } = {};

        // Test localStorage
        try {
            const test = '__test_storage__';
            localStorage.setItem(test, 'test');
            localStorage.removeItem(test);
            results.localStorage = true;
        } catch {
            results.localStorage = false;
        }

        // Test sessionStorage
        try {
            const test = '__test_storage__';
            sessionStorage.setItem(test, 'test');
            sessionStorage.removeItem(test);
            results.sessionStorage = true;
        } catch {
            results.sessionStorage = false;
        }

        // Memory storage is always available
        results.memory = true;

        return results;
    }
}

// Export singleton instance
export const storageFallback = new StorageFallbackService();