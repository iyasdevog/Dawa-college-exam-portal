/**
 * Service Worker Fallback Service
 * Provides graceful degradation when service workers are not available
 * Following Clean Architecture - Infrastructure Layer
 */

import { storageFallback } from './StorageFallbackService';

export interface ServiceWorkerCapabilities {
    serviceWorker: boolean;
    pushManager: boolean;
    backgroundSync: boolean;
    cacheAPI: boolean;
    notifications: boolean;
}

export interface CacheFallbackConfig {
    maxItems: number;
    maxAge: number; // in milliseconds
    storageKey: string;
}

export interface SyncFallbackConfig {
    retryInterval: number; // in milliseconds
    maxRetries: number;
    storageKey: string;
}

export interface OfflineQueueItem {
    id: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
    timestamp: number;
    retryCount: number;
}

export class ServiceWorkerFallbackService {
    private capabilities: ServiceWorkerCapabilities;
    private cacheConfig: CacheFallbackConfig;
    private syncConfig: SyncFallbackConfig;
    private offlineQueue: OfflineQueueItem[] = [];
    private syncInterval: number | null = null;
    private isOnline: boolean = navigator.onLine;

    constructor() {
        this.capabilities = this.detectCapabilities();
        this.cacheConfig = {
            maxItems: 100,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            storageKey: 'sw_fallback_cache'
        };
        this.syncConfig = {
            retryInterval: 30000, // 30 seconds
            maxRetries: 5,
            storageKey: 'sw_fallback_sync_queue'
        };

        this.initializeFallbacks();
    }

    /**
     * Detect service worker capabilities
     */
    private detectCapabilities(): ServiceWorkerCapabilities {
        return {
            serviceWorker: 'serviceWorker' in navigator,
            pushManager: 'PushManager' in window,
            backgroundSync: 'serviceWorker' in navigator &&
                typeof window !== 'undefined' &&
                'ServiceWorkerRegistration' in window &&
                window.ServiceWorkerRegistration &&
                'sync' in window.ServiceWorkerRegistration.prototype,
            cacheAPI: 'caches' in window,
            notifications: 'Notification' in window
        };
    }

    /**
     * Initialize fallback mechanisms
     */
    private initializeFallbacks(): void {
        console.log('[SW FALLBACK] Initializing service worker fallbacks');
        console.log('[SW FALLBACK] Capabilities:', this.capabilities);

        // Set up network status monitoring
        this.setupNetworkMonitoring();

        // Load persisted offline queue
        this.loadOfflineQueue();

        // Set up cache fallback if Cache API is not available
        if (!this.capabilities.cacheAPI) {
            this.setupCacheFallback();
        }

        // Set up sync fallback if background sync is not available
        if (!this.capabilities.backgroundSync) {
            this.setupSyncFallback();
        }

        // Set up notification fallback if notifications are not available
        if (!this.capabilities.notifications) {
            this.setupNotificationFallback();
        }
    }

    /**
     * Set up network status monitoring
     */
    private setupNetworkMonitoring(): void {
        const handleOnline = () => {
            this.isOnline = true;
            console.log('[SW FALLBACK] Network back online');
            this.processPendingSync();
        };

        const handleOffline = () => {
            this.isOnline = false;
            console.log('[SW FALLBACK] Network went offline');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
    }

    /**
     * Set up cache fallback using storage
     */
    private setupCacheFallback(): void {
        console.log('[SW FALLBACK] Setting up cache fallback using storage');

        // Intercept fetch requests if possible
        if ('fetch' in window) {
            this.interceptFetchRequests();
        }
    }

    /**
     * Intercept fetch requests for caching fallback
     */
    private interceptFetchRequests(): void {
        // Store original fetch
        const originalFetch = window.fetch;

        // Override fetch with caching fallback
        window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            const request = new Request(input, init);
            const cacheKey = this.getCacheKey(request);

            try {
                // Try network first
                const response = await originalFetch(request);

                // Cache successful responses
                if (response.ok && this.shouldCache(request)) {
                    this.cacheResponse(cacheKey, response.clone());
                }

                return response;
            } catch (error) {
                console.warn('[SW FALLBACK] Network request failed, trying cache:', error);

                // Try cache fallback
                const cachedResponse = this.getCachedResponse(cacheKey);
                if (cachedResponse) {
                    console.log('[SW FALLBACK] Serving from cache fallback');
                    return cachedResponse;
                }

                // If no cache, throw original error
                throw error;
            }
        };
    }

    /**
     * Generate cache key for request
     */
    private getCacheKey(request: Request): string {
        return `${request.method}:${request.url}`;
    }

    /**
     * Check if request should be cached
     */
    private shouldCache(request: Request): boolean {
        // Only cache GET requests
        if (request.method !== 'GET') {
            return false;
        }

        // Don't cache requests with authentication headers
        if (request.headers.get('Authorization')) {
            return false;
        }

        // Cache static assets and API responses
        const url = new URL(request.url);
        return url.pathname.includes('/api/') ||
            url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/);
    }

    /**
     * Cache response using storage fallback
     */
    private cacheResponse(cacheKey: string, response: Response): void {
        response.text().then(text => {
            const cacheItem = {
                url: response.url,
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: text,
                timestamp: Date.now()
            };

            // Get current cache
            const cache = this.getCache();

            // Add new item
            cache[cacheKey] = cacheItem;

            // Clean up old items
            this.cleanupCache(cache);

            // Save cache
            storageFallback.setItem(this.cacheConfig.storageKey, cache, {
                expiry: this.cacheConfig.maxAge
            });
        }).catch(error => {
            console.warn('[SW FALLBACK] Failed to cache response:', error);
        });
    }

    /**
     * Get cached response
     */
    private getCachedResponse(cacheKey: string): Response | null {
        try {
            const cache = this.getCache();
            const cacheItem = cache[cacheKey];

            if (!cacheItem) {
                return null;
            }

            // Check if cache item is expired
            if (Date.now() - cacheItem.timestamp > this.cacheConfig.maxAge) {
                delete cache[cacheKey];
                storageFallback.setItem(this.cacheConfig.storageKey, cache);
                return null;
            }

            // Create response from cached data
            return new Response(cacheItem.body, {
                status: cacheItem.status,
                statusText: cacheItem.statusText,
                headers: cacheItem.headers
            });
        } catch (error) {
            console.error('[SW FALLBACK] Error retrieving cached response:', error);
            return null;
        }
    }

    /**
     * Get cache from storage
     */
    private getCache(): Record<string, any> {
        return storageFallback.getItem(this.cacheConfig.storageKey) || {};
    }

    /**
     * Clean up old cache items
     */
    private cleanupCache(cache: Record<string, any>): void {
        const keys = Object.keys(cache);
        const now = Date.now();

        // Remove expired items
        keys.forEach(key => {
            const item = cache[key];
            if (item && now - item.timestamp > this.cacheConfig.maxAge) {
                delete cache[key];
            }
        });

        // Remove oldest items if over limit
        const remainingKeys = Object.keys(cache);
        if (remainingKeys.length > this.cacheConfig.maxItems) {
            const sortedKeys = remainingKeys.sort((a, b) =>
                cache[a].timestamp - cache[b].timestamp
            );

            const keysToRemove = sortedKeys.slice(0, remainingKeys.length - this.cacheConfig.maxItems);
            keysToRemove.forEach(key => delete cache[key]);
        }
    }

    /**
     * Set up sync fallback using periodic retry
     */
    private setupSyncFallback(): void {
        console.log('[SW FALLBACK] Setting up sync fallback using periodic retry');

        // Start periodic sync processing
        this.startSyncInterval();
    }

    /**
     * Start sync interval
     */
    private startSyncInterval(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = window.setInterval(() => {
            if (this.isOnline && this.offlineQueue.length > 0) {
                this.processPendingSync();
            }
        }, this.syncConfig.retryInterval);
    }

    /**
     * Add request to offline queue
     */
    public queueOfflineRequest(
        url: string,
        method: string = 'GET',
        headers: Record<string, string> = {},
        body?: any
    ): string {
        const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const queueItem: OfflineQueueItem = {
            id,
            url,
            method,
            headers,
            body,
            timestamp: Date.now(),
            retryCount: 0
        };

        this.offlineQueue.push(queueItem);
        this.saveOfflineQueue();

        console.log('[SW FALLBACK] Queued offline request:', id);
        return id;
    }

    /**
     * Process pending sync requests
     */
    private async processPendingSync(): Promise<void> {
        if (!this.isOnline || this.offlineQueue.length === 0) {
            return;
        }

        console.log(`[SW FALLBACK] Processing ${this.offlineQueue.length} pending sync requests`);

        const itemsToProcess = [...this.offlineQueue];

        for (const item of itemsToProcess) {
            try {
                await this.processQueueItem(item);

                // Remove successful item from queue
                this.offlineQueue = this.offlineQueue.filter(q => q.id !== item.id);
            } catch (error) {
                console.warn(`[SW FALLBACK] Failed to process queue item ${item.id}:`, error);

                // Increment retry count
                const queueItem = this.offlineQueue.find(q => q.id === item.id);
                if (queueItem) {
                    queueItem.retryCount++;

                    // Remove if max retries exceeded
                    if (queueItem.retryCount >= this.syncConfig.maxRetries) {
                        console.error(`[SW FALLBACK] Max retries exceeded for ${item.id}, removing from queue`);
                        this.offlineQueue = this.offlineQueue.filter(q => q.id !== item.id);
                    }
                }
            }
        }

        this.saveOfflineQueue();
    }

    /**
     * Process individual queue item
     */
    private async processQueueItem(item: OfflineQueueItem): Promise<void> {
        const response = await fetch(item.url, {
            method: item.method,
            headers: item.headers,
            body: item.body ? JSON.stringify(item.body) : undefined
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        console.log(`[SW FALLBACK] Successfully processed queue item ${item.id}`);
    }

    /**
     * Load offline queue from storage
     */
    private loadOfflineQueue(): void {
        const savedQueue = storageFallback.getItem(this.syncConfig.storageKey);
        if (savedQueue && Array.isArray(savedQueue)) {
            this.offlineQueue = savedQueue;
            console.log(`[SW FALLBACK] Loaded ${this.offlineQueue.length} items from offline queue`);
        }
    }

    /**
     * Save offline queue to storage
     */
    private saveOfflineQueue(): void {
        storageFallback.setItem(this.syncConfig.storageKey, this.offlineQueue);
    }

    /**
     * Set up notification fallback
     */
    private setupNotificationFallback(): void {
        console.log('[SW FALLBACK] Setting up notification fallback using DOM alerts');
    }

    /**
     * Show notification fallback
     */
    public showNotificationFallback(title: string, options: NotificationOptions = {}): void {
        if (this.capabilities.notifications) {
            // Use native notifications if available
            if (Notification.permission === 'granted') {
                new Notification(title, options);
            } else if (Notification.permission !== 'denied') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        new Notification(title, options);
                    }
                });
            }
        } else {
            // Fallback to DOM-based notification
            this.showDOMNotification(title, options.body || '');
        }
    }

    /**
     * Show DOM-based notification
     */
    private showDOMNotification(title: string, body: string): void {
        const notification = document.createElement('div');
        notification.className = 'sw-fallback-notification';
        notification.innerHTML = `
            <div class="sw-fallback-notification-content">
                <h4>${title}</h4>
                <p>${body}</p>
                <button onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #333;
            color: white;
            padding: 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 300px;
            font-family: system-ui, -apple-system, sans-serif;
        `;

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    /**
     * Clear cache fallback
     */
    public clearCache(): void {
        storageFallback.removeItem(this.cacheConfig.storageKey);
        console.log('[SW FALLBACK] Cache cleared');
    }

    /**
     * Clear offline queue
     */
    public clearOfflineQueue(): void {
        this.offlineQueue = [];
        storageFallback.removeItem(this.syncConfig.storageKey);
        console.log('[SW FALLBACK] Offline queue cleared');
    }

    /**
     * Get service worker capabilities
     */
    public getCapabilities(): ServiceWorkerCapabilities {
        return { ...this.capabilities };
    }

    /**
     * Get offline queue status
     */
    public getOfflineQueueStatus(): { count: number; items: OfflineQueueItem[] } {
        return {
            count: this.offlineQueue.length,
            items: [...this.offlineQueue]
        };
    }

    /**
     * Get cache status
     */
    public getCacheStatus(): { count: number; size: number } {
        const cache = this.getCache();
        const keys = Object.keys(cache);
        const size = JSON.stringify(cache).length;

        return {
            count: keys.length,
            size
        };
    }

    /**
     * Force sync processing
     */
    public async forceSyncProcessing(): Promise<void> {
        console.log('[SW FALLBACK] Forcing sync processing');
        await this.processPendingSync();
    }

    /**
     * Check if service worker features are available
     */
    public isServiceWorkerAvailable(): boolean {
        return this.capabilities.serviceWorker;
    }

    /**
     * Check if background sync is available
     */
    public isBackgroundSyncAvailable(): boolean {
        return this.capabilities.backgroundSync;
    }

    /**
     * Check if cache API is available
     */
    public isCacheAPIAvailable(): boolean {
        return this.capabilities.cacheAPI;
    }

    /**
     * Enhanced graceful degradation for service worker unavailability
     */
    public setupGracefulDegradation(): void {
        console.log('[SW FALLBACK] Setting up enhanced graceful degradation');

        // Set up comprehensive fallback strategies
        this.setupNetworkFallback();
        this.setupCacheFallback();
        this.setupSyncFallback();
        this.setupNotificationFallback();
        this.setupPushFallback();
    }

    /**
     * Set up network request fallback
     */
    private setupNetworkFallback(): void {
        if (!this.capabilities.serviceWorker) {
            console.log('[SW FALLBACK] Service worker unavailable, setting up network fallback');

            // Enhanced fetch interception with better error handling
            const originalFetch = window.fetch;

            window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
                try {
                    const response = await originalFetch(input, init);

                    // Cache successful responses if possible
                    if (response.ok && this.shouldCache(new Request(input, init))) {
                        this.cacheResponse(this.getCacheKey(new Request(input, init)), response.clone());
                    }

                    return response;
                } catch (error) {
                    console.warn('[SW FALLBACK] Network request failed, trying fallback strategies:', error);

                    // Try cache first
                    const cachedResponse = this.getCachedResponse(this.getCacheKey(new Request(input, init)));
                    if (cachedResponse) {
                        console.log('[SW FALLBACK] Serving from cache fallback');
                        return cachedResponse;
                    }

                    // Try offline queue for POST/PUT/PATCH requests
                    const request = new Request(input, init);
                    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
                        const headers = Object.fromEntries(request.headers.entries());
                        const body = init?.body ? await request.text() : undefined;

                        this.queueOfflineRequest(request.url, request.method, headers, body);

                        // Return a synthetic success response for queued operations
                        return new Response(JSON.stringify({
                            success: true,
                            message: 'Request queued for sync when online',
                            queued: true
                        }), {
                            status: 202,
                            statusText: 'Accepted',
                            headers: { 'Content-Type': 'application/json' }
                        });
                    }

                    // For GET requests, return a meaningful error
                    return new Response(JSON.stringify({
                        error: 'Network unavailable and no cached data available',
                        offline: true
                    }), {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: { 'Content-Type': 'application/json' }
                    });
                }
            };
        }
    }

    /**
     * Set up push notification fallback
     */
    private setupPushFallback(): void {
        if (!this.capabilities.pushManager) {
            console.log('[SW FALLBACK] Push manager unavailable, setting up push fallback');

            // Create a simple push simulation using localStorage and polling
            this.setupPushSimulation();
        }
    }

    /**
     * Set up push simulation for browsers without push support
     */
    private setupPushSimulation(): void {
        const PUSH_SIMULATION_KEY = 'sw_fallback_push_queue';
        const POLL_INTERVAL = 30000; // 30 seconds

        // Poll for simulated push messages
        setInterval(() => {
            try {
                const pushQueue = storageFallback.getItem(PUSH_SIMULATION_KEY) || [];

                if (Array.isArray(pushQueue) && pushQueue.length > 0) {
                    pushQueue.forEach((message: any) => {
                        this.showNotificationFallback(message.title, {
                            body: message.body,
                            icon: message.icon,
                            badge: message.badge
                        });
                    });

                    // Clear processed messages
                    storageFallback.removeItem(PUSH_SIMULATION_KEY);
                }
            } catch (error) {
                console.error('[SW FALLBACK] Error in push simulation:', error);
            }
        }, POLL_INTERVAL);
    }

    /**
     * Enhanced storage availability check
     */
    public checkStorageAvailability(): {
        localStorage: boolean;
        sessionStorage: boolean;
        indexedDB: boolean;
        cacheAPI: boolean;
        available: boolean;
    } {
        const availability = {
            localStorage: false,
            sessionStorage: false,
            indexedDB: false,
            cacheAPI: false,
            available: false
        };

        // Test localStorage
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            availability.localStorage = true;
        } catch (error) {
            console.warn('[SW FALLBACK] localStorage unavailable:', error);
        }

        // Test sessionStorage
        try {
            const test = '__storage_test__';
            sessionStorage.setItem(test, test);
            sessionStorage.removeItem(test);
            availability.sessionStorage = true;
        } catch (error) {
            console.warn('[SW FALLBACK] sessionStorage unavailable:', error);
        }

        // Test IndexedDB
        try {
            availability.indexedDB = 'indexedDB' in window && indexedDB !== null;
        } catch (error) {
            console.warn('[SW FALLBACK] IndexedDB unavailable:', error);
        }

        // Test Cache API
        try {
            availability.cacheAPI = 'caches' in window;
        } catch (error) {
            console.warn('[SW FALLBACK] Cache API unavailable:', error);
        }

        availability.available = availability.localStorage ||
            availability.sessionStorage ||
            availability.indexedDB ||
            availability.cacheAPI;

        return availability;
    }

    /**
     * Get comprehensive fallback status
     */
    public getFallbackStatus(): {
        serviceWorkerAvailable: boolean;
        storageAvailability: ReturnType<typeof this.checkStorageAvailability>;
        capabilities: ServiceWorkerCapabilities;
        activeStrategies: string[];
        degradationLevel: 'none' | 'partial' | 'full';
    } {
        const storageAvailability = this.checkStorageAvailability();
        const activeStrategies: string[] = [];

        if (!this.capabilities.serviceWorker) {
            activeStrategies.push('network-fallback');
        }
        if (!this.capabilities.cacheAPI) {
            activeStrategies.push('storage-cache-fallback');
        }
        if (!this.capabilities.backgroundSync) {
            activeStrategies.push('periodic-sync-fallback');
        }
        if (!this.capabilities.notifications) {
            activeStrategies.push('dom-notification-fallback');
        }
        if (!this.capabilities.pushManager) {
            activeStrategies.push('push-simulation-fallback');
        }

        let degradationLevel: 'none' | 'partial' | 'full' = 'none';
        if (activeStrategies.length > 0) {
            degradationLevel = activeStrategies.length >= 3 ? 'full' : 'partial';
        }

        return {
            serviceWorkerAvailable: this.capabilities.serviceWorker,
            storageAvailability,
            capabilities: { ...this.capabilities },
            activeStrategies,
            degradationLevel
        };
    }
    /**
     * Cleanup resources
     */
    public cleanup(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        // Remove event listeners
        window.removeEventListener('online', () => { });
        window.removeEventListener('offline', () => { });

        console.log('[SW FALLBACK] Cleanup completed');
    }
}

// Export singleton instance
export const serviceWorkerFallback = new ServiceWorkerFallbackService();