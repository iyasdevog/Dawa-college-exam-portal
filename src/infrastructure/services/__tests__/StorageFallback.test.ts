/**
 * Storage Fallback Tests
 * Tests for storage fallback mechanisms
 */

import { StorageFallbackService } from '../StorageFallbackService';
import { ServiceWorkerFallbackService } from '../ServiceWorkerFallbackService';

// Mock localStorage and sessionStorage
const mockStorage = () => {
    let store: Record<string, string> = {};
    return {
        getItem: jest.fn((key: string) => store[key] || null),
        setItem: jest.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            store = {};
        }),
        get length() {
            return Object.keys(store).length;
        },
        key: jest.fn((index: number) => Object.keys(store)[index] || null)
    };
};

// Mock IndexedDB
const mockIndexedDB = {
    open: jest.fn(() => ({
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
        result: null
    })),
    deleteDatabase: jest.fn()
};

// Mock window.localStorage and window.sessionStorage
Object.defineProperty(window, 'localStorage', {
    value: mockStorage(),
    writable: true
});

Object.defineProperty(window, 'sessionStorage', {
    value: mockStorage(),
    writable: true
});

// Mock IndexedDB
Object.defineProperty(window, 'indexedDB', {
    value: mockIndexedDB,
    writable: true
});

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
    value: true,
    writable: true
});

// Mock service worker
Object.defineProperty(navigator, 'serviceWorker', {
    value: undefined,
    writable: true
});

// Mock caches
Object.defineProperty(window, 'caches', {
    value: undefined,
    writable: true
});

describe('StorageFallbackService', () => {
    let storageFallback: StorageFallbackService;

    beforeEach(() => {
        storageFallback = new StorageFallbackService();
        jest.clearAllMocks();
    });

    describe('Basic Storage Operations', () => {
        test('should store and retrieve items successfully', () => {
            const key = 'test-key';
            const value = { data: 'test-value', number: 42 };

            const success = storageFallback.setItem(key, value);
            expect(success).toBe(true);

            const retrieved = storageFallback.getItem(key);
            expect(retrieved).toEqual(value);
        });

        test('should handle item removal', () => {
            const key = 'test-key';
            const value = 'test-value';

            storageFallback.setItem(key, value);
            expect(storageFallback.getItem(key)).toBe(value);

            const removed = storageFallback.removeItem(key);
            expect(removed).toBe(true);
            expect(storageFallback.getItem(key)).toBeNull();
        });

        test('should return null for non-existent keys', () => {
            const result = storageFallback.getItem('non-existent-key');
            expect(result).toBeNull();
        });
    });

    describe('Storage Capabilities Detection', () => {
        test('should detect storage capabilities', () => {
            const capabilities = storageFallback.getCapabilities();

            expect(capabilities).toHaveProperty('localStorage');
            expect(capabilities).toHaveProperty('sessionStorage');
            expect(capabilities).toHaveProperty('available');
            expect(typeof capabilities.localStorage).toBe('boolean');
            expect(typeof capabilities.sessionStorage).toBe('boolean');
            expect(typeof capabilities.available).toBe('boolean');
        });

        test('should report current storage type', () => {
            const currentType = storageFallback.getCurrentStorageType();
            expect(['localStorage', 'sessionStorage', 'memory', 'none']).toContain(currentType);
        });
    });

    describe('Storage Health Monitoring', () => {
        test('should provide storage health status', () => {
            const health = storageFallback.getStorageHealth();

            expect(health).toHaveProperty('status');
            expect(health).toHaveProperty('currentType');
            expect(health).toHaveProperty('capabilities');
            expect(health).toHaveProperty('issues');

            expect(['healthy', 'degraded', 'unavailable']).toContain(health.status);
            expect(Array.isArray(health.issues)).toBe(true);
        });

        test('should attempt storage recovery', () => {
            const recovered = storageFallback.attemptStorageRecovery();
            expect(typeof recovered).toBe('boolean');
        });
    });

    describe('Statistics and Monitoring', () => {
        test('should provide storage statistics', () => {
            const stats = storageFallback.getStats();

            expect(stats).toHaveProperty('currentType');
            expect(stats).toHaveProperty('itemCount');
            expect(stats).toHaveProperty('estimatedSize');

            expect(typeof stats.itemCount).toBe('number');
            expect(typeof stats.estimatedSize).toBe('number');
        });

        test('should test storage functionality', () => {
            const testResults = storageFallback.testStorage();

            expect(testResults).toHaveProperty('localStorage');
            expect(testResults).toHaveProperty('sessionStorage');
            expect(testResults).toHaveProperty('memory');

            expect(testResults.memory).toBe(true); // Memory storage should always work
        });
    });
});

describe('ServiceWorkerFallbackService', () => {
    let serviceWorkerFallback: ServiceWorkerFallbackService;

    beforeEach(() => {
        serviceWorkerFallback = new ServiceWorkerFallbackService();
    });

    describe('Capability Detection', () => {
        test('should detect service worker capabilities', () => {
            const capabilities = serviceWorkerFallback.getCapabilities();

            expect(capabilities).toHaveProperty('serviceWorker');
            expect(capabilities).toHaveProperty('pushManager');
            expect(capabilities).toHaveProperty('backgroundSync');
            expect(capabilities).toHaveProperty('cacheAPI');
            expect(capabilities).toHaveProperty('notifications');

            Object.values(capabilities).forEach(capability => {
                expect(typeof capability).toBe('boolean');
            });
        });

        test('should check storage availability', () => {
            const availability = serviceWorkerFallback.checkStorageAvailability();

            expect(availability).toHaveProperty('localStorage');
            expect(availability).toHaveProperty('sessionStorage');
            expect(availability).toHaveProperty('indexedDB');
            expect(availability).toHaveProperty('cacheAPI');
            expect(availability).toHaveProperty('available');

            Object.values(availability).forEach(available => {
                expect(typeof available).toBe('boolean');
            });
        });
    });

    describe('Fallback Status', () => {
        test('should provide comprehensive fallback status', () => {
            const status = serviceWorkerFallback.getFallbackStatus();

            expect(status).toHaveProperty('serviceWorkerAvailable');
            expect(status).toHaveProperty('storageAvailability');
            expect(status).toHaveProperty('capabilities');
            expect(status).toHaveProperty('activeStrategies');
            expect(status).toHaveProperty('degradationLevel');

            expect(typeof status.serviceWorkerAvailable).toBe('boolean');
            expect(Array.isArray(status.activeStrategies)).toBe(true);
            expect(['none', 'partial', 'full']).toContain(status.degradationLevel);
        });
    });

    describe('Offline Queue Management', () => {
        test('should queue offline requests', () => {
            const requestId = serviceWorkerFallback.queueOfflineRequest(
                '/api/test',
                'POST',
                { 'Content-Type': 'application/json' },
                { data: 'test' }
            );

            expect(typeof requestId).toBe('string');
            expect(requestId).toMatch(/^offline_/);
        });

        test('should provide offline queue status', () => {
            const status = serviceWorkerFallback.getOfflineQueueStatus();

            expect(status).toHaveProperty('count');
            expect(status).toHaveProperty('items');

            expect(typeof status.count).toBe('number');
            expect(Array.isArray(status.items)).toBe(true);
        });
    });

    describe('Cache Management', () => {
        test('should provide cache status', () => {
            const status = serviceWorkerFallback.getCacheStatus();

            expect(status).toHaveProperty('count');
            expect(status).toHaveProperty('size');

            expect(typeof status.count).toBe('number');
            expect(typeof status.size).toBe('number');
        });

        test('should clear cache', () => {
            expect(() => serviceWorkerFallback.clearCache()).not.toThrow();
        });

        test('should clear offline queue', () => {
            expect(() => serviceWorkerFallback.clearOfflineQueue()).not.toThrow();
        });
    });
});