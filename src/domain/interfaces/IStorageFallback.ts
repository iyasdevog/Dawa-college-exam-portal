/**
 * Storage Fallback Interface
 * Domain interface for storage fallback capabilities
 * Following Clean Architecture - Domain Layer
 */

export interface IStorageFallback {
    /**
     * Store an item with fallback mechanisms
     */
    setItem(key: string, value: any, options?: StorageOptions): Promise<boolean>;

    /**
     * Retrieve an item with fallback mechanisms
     */
    getItem(key: string): Promise<any>;

    /**
     * Remove an item with fallback mechanisms
     */
    removeItem(key: string): Promise<boolean>;

    /**
     * Clear all storage
     */
    clear(): Promise<void>;

    /**
     * Get storage health status
     */
    getStorageHealth(): StorageHealthStatus;

    /**
     * Check if storage is available for critical operations
     */
    isCriticalStorageAvailable(): boolean;

    /**
     * Force recovery attempt
     */
    forceRecovery(): Promise<boolean>;

    /**
     * Add status change listener
     */
    addStatusListener(listener: (status: StorageHealthStatus) => void): void;

    /**
     * Remove status change listener
     */
    removeStatusListener(listener: (status: StorageHealthStatus) => void): void;
}

export interface StorageOptions {
    expiry?: number;
    priority?: 'high' | 'medium' | 'low';
    fallbackToMemory?: boolean;
    syncWhenOnline?: boolean;
}

export interface StorageHealthStatus {
    overallStatus: 'optimal' | 'degraded' | 'minimal' | 'unavailable';
    primaryStorageAvailable: boolean;
    serviceWorkerAvailable: boolean;
    offlineStorageAvailable: boolean;
    degradationLevel: 'none' | 'partial' | 'full';
    activeStrategies: string[];
    recommendations: string[];
}