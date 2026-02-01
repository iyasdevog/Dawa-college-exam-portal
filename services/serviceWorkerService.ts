// Service Worker Registration and Management Service
// Handles service worker lifecycle and communication

export interface ServiceWorkerStatus {
    isSupported: boolean;
    isRegistered: boolean;
    isActive: boolean;
    registration: ServiceWorkerRegistration | null;
    updateAvailable: boolean;
}

class ServiceWorkerService {
    private registration: ServiceWorkerRegistration | null = null;
    private updateAvailable = false;
    private listeners: Map<string, Function[]> = new Map();

    constructor() {
        this.setupMessageListener();
    }

    // Register service worker
    public async register(): Promise<ServiceWorkerStatus> {
        if (!this.isSupported()) {
            console.log('ServiceWorker: Not supported in this browser');
            return this.getStatus();
        }

        try {
            console.log('ServiceWorker: Registering...');

            this.registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
                updateViaCache: 'none'
            });

            console.log('ServiceWorker: Registered successfully');

            // Setup update detection
            this.setupUpdateDetection();

            // Setup state change listeners
            this.setupStateChangeListeners();

            return this.getStatus();
        } catch (error) {
            console.error('ServiceWorker: Registration failed:', error);
            throw error;
        }
    }

    // Check if service workers are supported
    public isSupported(): boolean {
        return 'serviceWorker' in navigator;
    }

    // Get current status
    public getStatus(): ServiceWorkerStatus {
        return {
            isSupported: this.isSupported(),
            isRegistered: this.registration !== null,
            isActive: this.registration?.active !== null,
            registration: this.registration,
            updateAvailable: this.updateAvailable
        };
    }

    // Setup update detection
    private setupUpdateDetection(): void {
        if (!this.registration) return;

        this.registration.addEventListener('updatefound', () => {
            console.log('ServiceWorker: Update found');
            const newWorker = this.registration!.installing;

            if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('ServiceWorker: Update available');
                        this.updateAvailable = true;
                        this.emit('updateAvailable', newWorker);
                    }
                });
            }
        });
    }

    // Setup state change listeners
    private setupStateChangeListeners(): void {
        if (!this.registration) return;

        // Listen for controlling service worker changes
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('ServiceWorker: Controller changed');
            this.emit('controllerChange');

            // Reload the page to ensure fresh content
            if (!window.location.pathname.includes('/admin')) {
                window.location.reload();
            }
        });

        // Listen for service worker messages
        navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('ServiceWorker: Message received:', event.data);
            this.handleServiceWorkerMessage(event.data);
        });
    }

    // Setup message listener for service worker communication
    private setupMessageListener(): void {
        if (!this.isSupported()) return;

        navigator.serviceWorker.addEventListener('message', (event) => {
            this.handleServiceWorkerMessage(event.data);
        });
    }

    // Handle messages from service worker
    private handleServiceWorkerMessage(data: any): void {
        if (!data || !data.type) return;

        switch (data.type) {
            case 'SYNC_COMPLETE':
                console.log('ServiceWorker: Sync completed:', data.data);
                this.emit('syncComplete', data.data);
                break;

            case 'CACHE_UPDATED':
                console.log('ServiceWorker: Cache updated:', data.data);
                this.emit('cacheUpdated', data.data);
                break;

            case 'OFFLINE_READY':
                console.log('ServiceWorker: Offline ready');
                this.emit('offlineReady');
                break;

            default:
                console.log('ServiceWorker: Unknown message type:', data.type);
        }
    }

    // Update service worker
    public async update(): Promise<void> {
        if (!this.registration) {
            throw new Error('Service worker not registered');
        }

        try {
            console.log('ServiceWorker: Checking for updates...');
            await this.registration.update();
            console.log('ServiceWorker: Update check completed');
        } catch (error) {
            console.error('ServiceWorker: Update failed:', error);
            throw error;
        }
    }

    // Skip waiting and activate new service worker
    public async skipWaiting(): Promise<void> {
        if (!this.registration || !this.registration.waiting) {
            throw new Error('No waiting service worker found');
        }

        try {
            console.log('ServiceWorker: Skipping waiting...');

            // Send skip waiting message
            this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

            // Wait for controller change
            await new Promise<void>((resolve) => {
                const handleControllerChange = () => {
                    navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
                    resolve();
                };
                navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
            });

            this.updateAvailable = false;
            console.log('ServiceWorker: Skip waiting completed');
        } catch (error) {
            console.error('ServiceWorker: Skip waiting failed:', error);
            throw error;
        }
    }

    // Unregister service worker
    public async unregister(): Promise<boolean> {
        if (!this.registration) {
            console.log('ServiceWorker: No registration to unregister');
            return true;
        }

        try {
            console.log('ServiceWorker: Unregistering...');
            const result = await this.registration.unregister();

            if (result) {
                this.registration = null;
                this.updateAvailable = false;
                console.log('ServiceWorker: Unregistered successfully');
            }

            return result;
        } catch (error) {
            console.error('ServiceWorker: Unregistration failed:', error);
            throw error;
        }
    }

    // Send message to service worker
    public async sendMessage(message: any): Promise<any> {
        if (!navigator.serviceWorker.controller) {
            throw new Error('No active service worker controller');
        }

        return new Promise((resolve, reject) => {
            const messageChannel = new MessageChannel();

            messageChannel.port1.onmessage = (event) => {
                if (event.data.error) {
                    reject(new Error(event.data.error));
                } else {
                    resolve(event.data);
                }
            };

            navigator.serviceWorker.controller.postMessage(message, [messageChannel.port2]);
        });
    }

    // Get cache status from service worker
    public async getCacheStatus(): Promise<any> {
        try {
            return await this.sendMessage({ type: 'GET_CACHE_STATUS' });
        } catch (error) {
            console.error('ServiceWorker: Failed to get cache status:', error);
            return null;
        }
    }

    // Register background sync
    public async registerBackgroundSync(tag: string): Promise<void> {
        if (!this.registration || !('sync' in this.registration)) {
            throw new Error('Background sync not supported');
        }

        try {
            console.log('ServiceWorker: Registering background sync:', tag);
            await this.registration.sync.register(tag);
            console.log('ServiceWorker: Background sync registered:', tag);
        } catch (error) {
            console.error('ServiceWorker: Background sync registration failed:', error);
            throw error;
        }
    }

    // Check if background sync is supported
    public isBackgroundSyncSupported(): boolean {
        return this.registration !== null && 'sync' in ServiceWorkerRegistration.prototype;
    }

    // Event listener management
    public on(event: string, callback: Function): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }

    public off(event: string, callback: Function): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            const index = eventListeners.indexOf(callback);
            if (index !== -1) {
                eventListeners.splice(index, 1);
            }
        }
    }

    private emit(event: string, data?: any): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('ServiceWorker: Event listener error:', error);
                }
            });
        }
    }

    // Utility methods for offline detection
    public isOnline(): boolean {
        return navigator.onLine;
    }

    public onOnlineStatusChange(callback: (isOnline: boolean) => void): () => void {
        const handleOnline = () => callback(true);
        const handleOffline = () => callback(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Return cleanup function
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }

    // Pre-cache critical resources
    public async precacheResources(urls: string[]): Promise<void> {
        if (!this.registration) {
            throw new Error('Service worker not registered');
        }

        try {
            console.log('ServiceWorker: Pre-caching resources:', urls);

            await this.sendMessage({
                type: 'PRECACHE_RESOURCES',
                urls
            });

            console.log('ServiceWorker: Pre-caching completed');
        } catch (error) {
            console.error('ServiceWorker: Pre-caching failed:', error);
            throw error;
        }
    }

    // Clear all caches
    public async clearCaches(): Promise<void> {
        try {
            console.log('ServiceWorker: Clearing all caches...');

            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );

            console.log('ServiceWorker: All caches cleared');
        } catch (error) {
            console.error('ServiceWorker: Failed to clear caches:', error);
            throw error;
        }
    }
}

// Export singleton instance
export const serviceWorkerService = new ServiceWorkerService();