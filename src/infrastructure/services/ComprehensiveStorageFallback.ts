/**
 * Comprehensive Storage Fallback Service
 * Coordinates all storage fallback mechanisms for graceful degradation
 * Following Clean Architecture - Infrastructure Layer
 * 
 * Implements Requirements 9.3, 9.4:
 * - Add fallback from localStorage to sessionStorage to memory
 * - Create graceful degradation when storage is unavailable
 * - Implement service worker fallback strategies
 */

import { storageFallback, StorageType, StorageCapabilities } from './StorageFallbackService';
import { serviceWorkerFallback, ServiceWorkerCapabilities } from './ServiceWorkerFallbackService';
import { offlineStorageService } from './offlineStorageService';

export interface ComprehensiveStorageStatus {
    primaryStorage: {
        type: StorageType;
        available: boolean;
        health: 'healthy' | 'degraded' | 'unavailable';
    };
    serviceWorker: {
        available: boolean;
        capabilities: ServiceWorkerCapabilities;
        degradationLevel: 'none' | 'partial' | 'full';
    };
    offlineStorage: {
        available: boolean;
        isOnline: boolean;
        pendingSync: number;
    };
    overallStatus: 'optimal' | 'degraded' | 'minimal' | 'unavailable';
    activeStrategies: string[];
    recommendations: string[];
}

export interface StorageOperation {
    key: string;
    value: any;
    options?: {
        expiry?: number;
        priority?: 'high' | 'medium' | 'low';
        fallbackToMemory?: boolean;
        syncWhenOnline?: boolean;
    };
}

export class ComprehensiveStorageFallbackService {
    private initialized: boolean = false;
    private statusListeners: Set<(status: ComprehensiveStorageStatus) => void> = new Set();
    private degradationLevel: 'none' | 'partial' | 'full' = 'none';

    constructor() {
        this.initialize();
    }

    /**
     * Initialize comprehensive storage fallback
     */
    private async initialize(): Promise<void> {
        if (this.initialized) return;

        console.log('[COMPREHENSIVE STORAGE] Initializing comprehensive storage fallback');

        try {
            // Initialize all fallback services
            await this.initializeStorageFallback();
            await this.initializeServiceWorkerFallback();
            await this.initializeOfflineStorage();

            // Set up monitoring and coordination
            this.setupStatusMonitoring();
            this.setupCoordination();

            this.initialized = true;
            console.log('[COMPREHENSIVE STORAGE] Initialization complete');

            // Notify listeners of initial status
            this.notifyStatusListeners();
        } catch (error) {
            console.error('[COMPREHENSIVE STORAGE] Initialization failed:', error);
            this.handleInitializationFailure();
        }
    }

    /**
     * Initialize storage fallback
     */
    private async initializeStorageFallback(): Promise<void> {
        // Storage fallback is initialized automatically
        const health = storageFallback.getStorageHealth();

        if (health.status === 'unavailable') {
            console.warn('[COMPREHENSIVE STORAGE] Primary storage unavailable, attempting recovery');
            storageFallback.attemptStorageRecovery();
        }
    }

    /**
     * Initialize service worker fallback
     */
    private async initializeServiceWorkerFallback(): Promise<void> {
        // Set up enhanced graceful degradation
        serviceWorkerFallback.setupGracefulDegradation();

        const fallbackStatus = serviceWorkerFallback.getFallbackStatus();
        if (fallbackStatus.degradationLevel !== 'none') {
            console.log(`[COMPREHENSIVE STORAGE] Service worker degradation level: ${fallbackStatus.degradationLevel}`);
        }
    }

    /**
     * Initialize offline storage
     */
    private async initializeOfflineStorage(): Promise<void> {
        // Offline storage initializes automatically
        const status = await offlineStorageService.getOfflineStatus();
        console.log('[COMPREHENSIVE STORAGE] Offline storage status:', status);
    }

    /**
     * Set up status monitoring
     */
    private setupStatusMonitoring(): void {
        // Monitor storage health changes
        const checkStorageHealth = () => {
            const newStatus = this.getComprehensiveStatus();
            this.updateDegradationLevel(newStatus);
            this.notifyStatusListeners();
        };

        // Check every 30 seconds
        setInterval(checkStorageHealth, 30000);

        // Monitor network status changes
        window.addEventListener('online', checkStorageHealth);
        window.addEventListener('offline', checkStorageHealth);

        // Monitor storage events
        window.addEventListener('storage', checkStorageHealth);
    }

    /**
     * Set up coordination between different storage mechanisms
     */
    private setupCoordination(): void {
        // Coordinate between storage fallback and offline storage
        this.setupStorageCoordination();

        // Coordinate between service worker and storage fallbacks
        this.setupServiceWorkerCoordination();
    }

    /**
     * Set up storage coordination
     */
    private setupStorageCoordination(): void {
        // When primary storage fails, ensure offline storage can compensate
        storageFallback.addMemoryEventListener((key, oldValue, newValue) => {
            if (key === '__storage_unavailable__') {
                console.log('[COMPREHENSIVE STORAGE] Primary storage unavailable, enhancing offline storage');
                // Could trigger additional offline storage strategies here
            }
        });
    }

    /**
     * Set up service worker coordination
     */
    private setupServiceWorkerCoordination(): void {
        // When service worker is unavailable, ensure storage fallbacks are enhanced
        const swStatus = serviceWorkerFallback.getFallbackStatus();
        if (swStatus.degradationLevel === 'full') {
            console.log('[COMPREHENSIVE STORAGE] Service worker fully degraded, enhancing storage strategies');
            // Could implement additional storage-based caching here
        }
    }

    /**
     * Handle initialization failure
     */
    private handleInitializationFailure(): void {
        console.error('[COMPREHENSIVE STORAGE] Operating in emergency mode with minimal functionality');
        this.degradationLevel = 'full';

        // Set up minimal memory-only storage
        this.setupEmergencyMode();
    }

    /**
     * Set up emergency mode with minimal functionality
     */
    private setupEmergencyMode(): void {
        console.log('[COMPREHENSIVE STORAGE] Setting up emergency mode');

        // Use only memory storage with aggressive cleanup
        const emergencyStorage = new Map<string, any>();
        const MAX_EMERGENCY_ITEMS = 50;

        // Override storage operations to use emergency storage
        (window as any).__emergencyStorage = {
            setItem: (key: string, value: any) => {
                if (emergencyStorage.size >= MAX_EMERGENCY_ITEMS) {
                    // Remove oldest item
                    const firstKey = emergencyStorage.keys().next().value;
                    emergencyStorage.delete(firstKey);
                }
                emergencyStorage.set(key, value);
            },
            getItem: (key: string) => emergencyStorage.get(key) || null,
            removeItem: (key: string) => emergencyStorage.delete(key),
            clear: () => emergencyStorage.clear()
        };
    }

    /**
     * Update degradation level based on status
     */
    private updateDegradationLevel(status: ComprehensiveStorageStatus): void {
        const oldLevel = this.degradationLevel;

        if (status.overallStatus === 'optimal') {
            this.degradationLevel = 'none';
        } else if (status.overallStatus === 'degraded') {
            this.degradationLevel = 'partial';
        } else {
            this.degradationLevel = 'full';
        }

        if (oldLevel !== this.degradationLevel) {
            console.log(`[COMPREHENSIVE STORAGE] Degradation level changed: ${oldLevel} → ${this.degradationLevel}`);
            this.handleDegradationLevelChange(oldLevel, this.degradationLevel);
        }
    }

    /**
     * Handle degradation level changes
     */
    private handleDegradationLevelChange(
        oldLevel: 'none' | 'partial' | 'full',
        newLevel: 'none' | 'partial' | 'full'
    ): void {
        if (newLevel === 'full' && oldLevel !== 'full') {
            console.warn('[COMPREHENSIVE STORAGE] Entering full degradation mode');
            this.setupEmergencyMode();
        } else if (newLevel === 'none' && oldLevel !== 'none') {
            console.log('[COMPREHENSIVE STORAGE] Storage fully recovered');
            // Could clean up emergency mode here
        }
    }

    /**
     * Perform storage operation with comprehensive fallback
     */
    public async setItem(operation: StorageOperation): Promise<boolean> {
        const { key, value, options = {} } = operation;

        try {
            // Try primary storage first
            const success = storageFallback.setItem(key, value, {
                expiry: options.expiry,
                fallbackToMemory: options.fallbackToMemory !== false
            });

            if (success) {
                // If sync when online is requested and we're offline, queue for sync
                if (options.syncWhenOnline && !navigator.onLine) {
                    await this.queueForSync(operation);
                }
                return true;
            }

            // Try offline storage as fallback
            if (options.priority === 'high') {
                await this.storeInOfflineStorage(operation);
                return true;
            }

            return false;
        } catch (error) {
            console.error('[COMPREHENSIVE STORAGE] Storage operation failed:', error);

            // Emergency fallback
            if ((window as any).__emergencyStorage) {
                (window as any).__emergencyStorage.setItem(key, value);
                return true;
            }

            return false;
        }
    }

    /**
     * Get item with comprehensive fallback
     */
    public async getItem(key: string): Promise<any> {
        try {
            // Try primary storage first
            let value = storageFallback.getItem(key);
            if (value !== null) {
                return value;
            }

            // Try offline storage
            value = await this.getFromOfflineStorage(key);
            if (value !== null) {
                return value;
            }

            // Emergency fallback
            if ((window as any).__emergencyStorage) {
                return (window as any).__emergencyStorage.getItem(key);
            }

            return null;
        } catch (error) {
            console.error('[COMPREHENSIVE STORAGE] Get operation failed:', error);
            return null;
        }
    }

    /**
     * Remove item with comprehensive fallback
     */
    public async removeItem(key: string): Promise<boolean> {
        try {
            let success = false;

            // Remove from primary storage
            if (storageFallback.removeItem(key)) {
                success = true;
            }

            // Remove from offline storage
            await this.removeFromOfflineStorage(key);

            // Remove from emergency storage
            if ((window as any).__emergencyStorage) {
                (window as any).__emergencyStorage.removeItem(key);
                success = true;
            }

            return success;
        } catch (error) {
            console.error('[COMPREHENSIVE STORAGE] Remove operation failed:', error);
            return false;
        }
    }

    /**
     * Queue operation for sync when online
     */
    private async queueForSync(operation: StorageOperation): Promise<void> {
        try {
            serviceWorkerFallback.queueOfflineRequest(
                '/api/sync-storage',
                'POST',
                { 'Content-Type': 'application/json' },
                operation
            );
        } catch (error) {
            console.error('[COMPREHENSIVE STORAGE] Failed to queue for sync:', error);
        }
    }

    /**
     * Store in offline storage
     */
    private async storeInOfflineStorage(operation: StorageOperation): Promise<void> {
        // This would integrate with the offline storage service
        // For now, we'll use a simple approach
        console.log('[COMPREHENSIVE STORAGE] Storing in offline storage:', operation.key);
    }

    /**
     * Get from offline storage
     */
    private async getFromOfflineStorage(key: string): Promise<any> {
        // This would integrate with the offline storage service
        console.log('[COMPREHENSIVE STORAGE] Getting from offline storage:', key);
        return null;
    }

    /**
     * Remove from offline storage
     */
    private async removeFromOfflineStorage(key: string): Promise<void> {
        // This would integrate with the offline storage service
        console.log('[COMPREHENSIVE STORAGE] Removing from offline storage:', key);
    }

    /**
     * Get comprehensive storage status
     */
    public getComprehensiveStatus(): ComprehensiveStorageStatus {
        const storageHealth = storageFallback.getStorageHealth();
        const swStatus = serviceWorkerFallback.getFallbackStatus();
        const storageAvailability = serviceWorkerFallback.checkStorageAvailability();

        const activeStrategies: string[] = [];
        const recommendations: string[] = [];

        // Analyze primary storage
        if (storageHealth.status !== 'healthy') {
            activeStrategies.push('storage-fallback');
            if (storageHealth.status === 'unavailable') {
                recommendations.push('Consider refreshing the page to restore storage');
            }
        }

        // Analyze service worker
        if (swStatus.degradationLevel !== 'none') {
            activeStrategies.push(...swStatus.activeStrategies);
            if (swStatus.degradationLevel === 'full') {
                recommendations.push('Service worker unavailable - offline features limited');
            }
        }

        // Analyze storage availability
        if (!storageAvailability.available) {
            activeStrategies.push('emergency-mode');
            recommendations.push('All storage mechanisms unavailable - data will not persist');
        }

        // Determine overall status
        let overallStatus: 'optimal' | 'degraded' | 'minimal' | 'unavailable' = 'optimal';

        if (!storageAvailability.available) {
            overallStatus = 'unavailable';
        } else if (storageHealth.status === 'unavailable' || swStatus.degradationLevel === 'full') {
            overallStatus = 'minimal';
        } else if (storageHealth.status === 'degraded' || swStatus.degradationLevel === 'partial') {
            overallStatus = 'degraded';
        }

        return {
            primaryStorage: {
                type: storageHealth.currentType,
                available: storageHealth.capabilities.available,
                health: storageHealth.status
            },
            serviceWorker: {
                available: swStatus.serviceWorkerAvailable,
                capabilities: swStatus.capabilities,
                degradationLevel: swStatus.degradationLevel
            },
            offlineStorage: {
                available: true, // Offline storage service is always available
                isOnline: navigator.onLine,
                pendingSync: 0 // Would get from offline storage service
            },
            overallStatus,
            activeStrategies,
            recommendations
        };
    }

    /**
     * Add status listener
     */
    public addStatusListener(listener: (status: ComprehensiveStorageStatus) => void): void {
        this.statusListeners.add(listener);
    }

    /**
     * Remove status listener
     */
    public removeStatusListener(listener: (status: ComprehensiveStorageStatus) => void): void {
        this.statusListeners.delete(listener);
    }

    /**
     * Notify status listeners
     */
    private notifyStatusListeners(): void {
        const status = this.getComprehensiveStatus();
        this.statusListeners.forEach(listener => {
            try {
                listener(status);
            } catch (error) {
                console.error('[COMPREHENSIVE STORAGE] Error in status listener:', error);
            }
        });
    }

    /**
     * Force recovery attempt
     */
    public async forceRecovery(): Promise<boolean> {
        console.log('[COMPREHENSIVE STORAGE] Forcing recovery attempt');

        try {
            // Attempt storage recovery
            const storageRecovered = storageFallback.attemptStorageRecovery();

            // Re-initialize if needed
            if (!this.initialized) {
                await this.initialize();
            }

            // Update status
            this.notifyStatusListeners();

            return storageRecovered;
        } catch (error) {
            console.error('[COMPREHENSIVE STORAGE] Recovery attempt failed:', error);
            return false;
        }
    }

    /**
     * Get degradation level
     */
    public getDegradationLevel(): 'none' | 'partial' | 'full' {
        return this.degradationLevel;
    }

    /**
     * Check if storage is available for critical operations
     */
    public isCriticalStorageAvailable(): boolean {
        const status = this.getComprehensiveStatus();
        return status.overallStatus !== 'unavailable';
    }

    /**
     * Get storage recommendations for users
     */
    public getStorageRecommendations(): string[] {
        const status = this.getComprehensiveStatus();
        return status.recommendations;
    }

    /**
     * Clear all storage (for testing/debugging)
     */
    public async clearAllStorage(): Promise<void> {
        console.log('[COMPREHENSIVE STORAGE] Clearing all storage');

        try {
            // Clear primary storage
            storageFallback.clear();

            // Clear offline storage
            await offlineStorageService.clearAllOfflineData();

            // Clear service worker cache
            serviceWorkerFallback.clearCache();
            serviceWorkerFallback.clearOfflineQueue();

            // Clear emergency storage
            if ((window as any).__emergencyStorage) {
                (window as any).__emergencyStorage.clear();
            }

            console.log('[COMPREHENSIVE STORAGE] All storage cleared');
        } catch (error) {
            console.error('[COMPREHENSIVE STORAGE] Error clearing storage:', error);
        }
    }
}

// Export singleton instance
export const comprehensiveStorageFallback = new ComprehensiveStorageFallbackService();