// Enhanced Service Worker for AIC Da'wa College Exam Portal
// Provides comprehensive PWA functionality with advanced caching strategies

const CACHE_VERSION = '2.0.0';
const CACHE_NAME = `aic-dawa-college-v${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `aic-dawa-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `aic-dawa-dynamic-v${CACHE_VERSION}`;
const IMAGES_CACHE_NAME = `aic-dawa-images-v${CACHE_VERSION}`;
const API_CACHE_NAME = `aic-dawa-api-v${CACHE_VERSION}`;

// Critical resources to cache for offline functionality
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon-192x192.png',
    '/icon-512x512.png',
    '/apple-touch-icon.png',
    '/favicon.ico',
    // Core JS and CSS files will be added by Vite build process
];

// Advanced caching strategies configuration
const CACHE_STRATEGIES = {
    CACHE_FIRST: 'cache-first',
    NETWORK_FIRST: 'network-first',
    STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
    NETWORK_ONLY: 'network-only',
    CACHE_ONLY: 'cache-only'
};

// Cache expiration times (in milliseconds)
const CACHE_EXPIRATION = {
    STATIC: 30 * 24 * 60 * 60 * 1000, // 30 days
    DYNAMIC: 7 * 24 * 60 * 60 * 1000, // 7 days
    API: 1 * 60 * 60 * 1000, // 1 hour
    IMAGES: 30 * 24 * 60 * 60 * 1000 // 30 days
};

// API endpoints that should be cached with different strategies
const CACHEABLE_APIS = [
    '/api/students',
    '/api/subjects',
    '/api/marks'
];

// Routes that should use different caching strategies
const CACHE_ROUTE_STRATEGIES = {
    '/api/': CACHE_STRATEGIES.NETWORK_FIRST,
    '/assets/': CACHE_STRATEGIES.CACHE_FIRST,
    '/images/': CACHE_STRATEGIES.STALE_WHILE_REVALIDATE,
    '/fonts/': CACHE_STRATEGIES.CACHE_FIRST,
    '/': CACHE_STRATEGIES.NETWORK_FIRST
};

// Install event - cache static assets with advanced precaching
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing v' + CACHE_VERSION);

    event.waitUntil(
        Promise.all([
            // Cache static assets
            caches.open(STATIC_CACHE_NAME)
                .then((cache) => {
                    console.log('Service Worker: Caching static assets');
                    return cache.addAll(STATIC_ASSETS);
                }),

            // Initialize other caches
            caches.open(DYNAMIC_CACHE_NAME),
            caches.open(IMAGES_CACHE_NAME),
            caches.open(API_CACHE_NAME)
        ])
            .then(() => {
                console.log('Service Worker: All caches initialized successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Error during installation:', error);
            })
    );
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating v' + CACHE_VERSION);

    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (!cacheName.includes(CACHE_VERSION)) {
                            console.log('Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),

            // Claim all clients immediately
            self.clients.claim()
        ])
            .then(() => {
                console.log('Service Worker: Activated successfully');

                // Notify all clients about activation
                return self.clients.matchAll().then(clients => {
                    clients.forEach(client => {
                        client.postMessage({
                            type: 'SW_ACTIVATED',
                            version: CACHE_VERSION
                        });
                    });
                });
            })
    );
});

// Enhanced fetch event with intelligent routing and caching strategies
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests and chrome-extension requests
    if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
        return;
    }

    // Determine caching strategy based on request type and route
    const strategy = determineCachingStrategy(request);

    switch (strategy) {
        case CACHE_STRATEGIES.CACHE_FIRST:
            event.respondWith(cacheFirstStrategy(request, getCacheNameForRequest(request)));
            break;
        case CACHE_STRATEGIES.NETWORK_FIRST:
            event.respondWith(networkFirstStrategy(request, getCacheNameForRequest(request)));
            break;
        case CACHE_STRATEGIES.STALE_WHILE_REVALIDATE:
            event.respondWith(staleWhileRevalidateStrategy(request, getCacheNameForRequest(request)));
            break;
        case CACHE_STRATEGIES.NETWORK_ONLY:
            event.respondWith(fetch(request));
            break;
        case CACHE_STRATEGIES.CACHE_ONLY:
            event.respondWith(caches.match(request));
            break;
        default:
            if (isNavigationRequest(request)) {
                event.respondWith(navigationStrategy(request));
            } else {
                event.respondWith(staleWhileRevalidateStrategy(request, DYNAMIC_CACHE_NAME));
            }
    }
});

// Enhanced Cache First Strategy with expiration
async function cacheFirstStrategy(request, cacheName) {
    try {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            // Check if cached response is still valid
            if (await isCacheValid(cachedResponse, cacheName)) {
                console.log('Service Worker: Serving fresh cache:', request.url);
                return cachedResponse;
            } else {
                console.log('Service Worker: Cache expired, fetching fresh:', request.url);
                await cache.delete(request);
            }
        }

        console.log('Service Worker: Fetching and caching:', request.url);
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            await addTimestampToResponse(responseToCache);
            cache.put(request, responseToCache);
        }

        return networkResponse;
    } catch (error) {
        console.error('Service Worker: Cache First strategy failed:', error);

        // Try to serve stale cache as fallback
        const cache = await caches.open(cacheName);
        const staleResponse = await cache.match(request);
        if (staleResponse) {
            console.log('Service Worker: Serving stale cache as fallback');
            return staleResponse;
        }

        throw error;
    }
}

// Enhanced Network First Strategy with intelligent fallback
async function networkFirstStrategy(request, cacheName) {
    try {
        console.log('Service Worker: Attempting network request:', request.url);

        // Add timeout to network request
        const networkResponse = await fetchWithTimeout(request, 5000);

        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            const responseToCache = networkResponse.clone();
            await addTimestampToResponse(responseToCache);
            cache.put(request, responseToCache);
            console.log('Service Worker: Network response cached:', request.url);
        }

        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Network failed, trying cache:', request.url);

        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            console.log('Service Worker: Serving cached response:', request.url);

            // Add offline indicator to response headers
            const offlineResponse = new Response(cachedResponse.body, {
                status: cachedResponse.status,
                statusText: cachedResponse.statusText,
                headers: {
                    ...Object.fromEntries(cachedResponse.headers.entries()),
                    'X-Served-By': 'service-worker-cache',
                    'X-Cache-Date': cachedResponse.headers.get('X-Cache-Date') || 'unknown'
                }
            });

            return offlineResponse;
        }

        // Enhanced offline response for critical API endpoints
        if (request.url.includes('/marks') || request.url.includes('/students')) {
            return createOfflineAPIResponse(request);
        }

        throw error;
    }
}

// Enhanced Navigation Strategy with better offline experience
async function navigationStrategy(request) {
    try {
        console.log('Service Worker: Navigation request:', request.url);
        const networkResponse = await fetchWithTimeout(request, 3000);
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Navigation failed, serving offline experience');

        const cache = await caches.open(STATIC_CACHE_NAME);
        const offlineResponse = await cache.match('/index.html');

        if (offlineResponse) {
            return offlineResponse;
        }

        // Enhanced offline page with PWA styling
        return new Response(
            `<!DOCTYPE html>
      <html lang="en">
      <head>
        <title>AIC Da'wa College - Offline</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#059669">
        <link rel="icon" href="/favicon.ico">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
            color: white;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .offline-container {
            text-align: center;
            max-width: 400px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            border: 1px solid rgba(255, 255, 255, 0.2);
          }
          .icon {
            font-size: 64px;
            margin-bottom: 24px;
            opacity: 0.8;
          }
          h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 16px;
            color: #10b981;
          }
          p {
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 32px;
            opacity: 0.9;
          }
          .retry-btn {
            background: #10b981;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-right: 12px;
          }
          .retry-btn:hover {
            background: #059669;
            transform: translateY(-2px);
          }
          .home-btn {
            background: transparent;
            color: #10b981;
            border: 2px solid #10b981;
            padding: 10px 24px;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
          }
          .home-btn:hover {
            background: #10b981;
            color: white;
          }
          .status {
            margin-top: 24px;
            font-size: 14px;
            opacity: 0.7;
          }
        </style>
      </head>
      <body>
        <div class="offline-container">
          <div class="icon">🌐</div>
          <h1>You're Offline</h1>
          <p>The AIC Da'wa College Exam Portal is not available right now. Please check your internet connection and try again.</p>
          <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
          <button class="home-btn" onclick="window.location.href='/'">Go Home</button>
          <div class="status">
            <p>Service Worker Active • PWA Mode</p>
          </div>
        </div>
        <script>
          // Auto-retry when online
          window.addEventListener('online', () => {
            setTimeout(() => window.location.reload(), 1000);
          });
        </script>
      </body>
      </html>`,
            {
                status: 200,
                headers: {
                    'Content-Type': 'text/html',
                    'Cache-Control': 'no-cache'
                }
            }
        );
    }
}

// Utility functions for enhanced caching

// Add timestamp to response for cache validation
async function addTimestampToResponse(response) {
    if (response.headers) {
        response.headers.set('X-Cache-Date', new Date().toISOString());
    }
}

// Check if cached response is still valid
async function isCacheValid(response, cacheName) {
    const cacheDate = response.headers.get('X-Cache-Date');
    if (!cacheDate) return false;

    const cachedTime = new Date(cacheDate).getTime();
    const now = Date.now();

    // Determine expiration based on cache type
    let maxAge = CACHE_EXPIRATION.DYNAMIC;
    if (cacheName.includes('static')) maxAge = CACHE_EXPIRATION.STATIC;
    else if (cacheName.includes('api')) maxAge = CACHE_EXPIRATION.API;
    else if (cacheName.includes('images')) maxAge = CACHE_EXPIRATION.IMAGES;

    return (now - cachedTime) < maxAge;
}

// Fetch with timeout
async function fetchWithTimeout(request, timeout = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(request, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// Create enhanced offline API response
function createOfflineAPIResponse(request) {
    const url = new URL(request.url);

    return new Response(
        JSON.stringify({
            offline: true,
            message: 'Offline mode - data may not be current',
            endpoint: url.pathname,
            timestamp: Date.now(),
            cached: true,
            suggestion: 'Please check your connection and try again'
        }),
        {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'X-Served-By': 'service-worker-offline',
                'X-Offline-Response': 'true'
            }
        }
    );
}

// Create generic offline response
function createOfflineResponse(request) {
    return new Response(
        'Offline - Content not available',
        {
            status: 503,
            statusText: 'Service Unavailable',
            headers: {
                'Content-Type': 'text/plain',
                'X-Served-By': 'service-worker-offline'
            }
        }
    );
}

// Enhanced Stale While Revalidate Strategy
async function staleWhileRevalidateStrategy(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    // Background fetch to update cache
    const fetchPromise = fetchWithTimeout(request, 3000)
        .then(async (networkResponse) => {
            if (networkResponse.ok) {
                const responseToCache = networkResponse.clone();
                await addTimestampToResponse(responseToCache);
                cache.put(request, responseToCache);

                // Notify clients about cache update
                const clients = await self.clients.matchAll();
                clients.forEach(client => {
                    client.postMessage({
                        type: 'CACHE_UPDATED',
                        url: request.url,
                        timestamp: Date.now()
                    });
                });
            }
            return networkResponse;
        })
        .catch((error) => {
            console.log('Service Worker: Background fetch failed:', error);
        });

    // Return cached response immediately if available
    if (cachedResponse) {
        console.log('Service Worker: Serving stale content:', request.url);
        return cachedResponse;
    }

    // Otherwise wait for network
    return fetchPromise || createOfflineResponse(request);
}

// Enhanced helper functions for intelligent caching

// Determine the best caching strategy for a request
function determineCachingStrategy(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Check route-specific strategies
    for (const [route, strategy] of Object.entries(CACHE_ROUTE_STRATEGIES)) {
        if (pathname.startsWith(route)) {
            return strategy;
        }
    }

    // Fallback based on request type
    if (isStaticAsset(request)) {
        return CACHE_STRATEGIES.CACHE_FIRST;
    } else if (isAPIRequest(request)) {
        return CACHE_STRATEGIES.NETWORK_FIRST;
    } else if (isImageRequest(request)) {
        return CACHE_STRATEGIES.STALE_WHILE_REVALIDATE;
    }

    return CACHE_STRATEGIES.STALE_WHILE_REVALIDATE;
}

// Get appropriate cache name for request
function getCacheNameForRequest(request) {
    if (isStaticAsset(request)) {
        return STATIC_CACHE_NAME;
    } else if (isAPIRequest(request)) {
        return API_CACHE_NAME;
    } else if (isImageRequest(request)) {
        return IMAGES_CACHE_NAME;
    }
    return DYNAMIC_CACHE_NAME;
}

// Check if request is for an image
function isImageRequest(request) {
    const url = new URL(request.url);
    return url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/);
}

// Enhanced static asset detection
function isStaticAsset(request) {
    const url = new URL(request.url);
    return url.pathname.match(/\.(js|css|woff|woff2|ttf|eot)$/) ||
        url.pathname.startsWith('/assets/') ||
        url.pathname.startsWith('/fonts/');
}

function isAPIRequest(request) {
    const url = new URL(request.url);
    return url.pathname.startsWith('/api/') ||
        CACHEABLE_APIS.some(api => url.pathname.includes(api)) ||
        url.hostname.includes('firestore') ||
        url.hostname.includes('firebase');
}

function isNavigationRequest(request) {
    return request.mode === 'navigate' ||
        (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));
}

// Enhanced background sync with priority handling
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync triggered:', event.tag);

    switch (event.tag) {
        case 'sync-marks-data':
            event.waitUntil(syncMarksData());
            break;
        case 'sync-student-data':
            event.waitUntil(syncStudentData());
            break;
        case 'sync-offline-actions':
            event.waitUntil(syncOfflineActions());
            break;
        case 'cleanup-old-cache':
            event.waitUntil(cleanupOldCache());
            break;
        default:
            console.log('Service Worker: Unknown sync tag:', event.tag);
    }
});

// Enhanced sync marks data with conflict resolution
async function syncMarksData() {
    try {
        console.log('Service Worker: Syncing offline marks data...');

        const offlineData = await getOfflineMarksData();
        const syncResults = {
            successful: 0,
            failed: 0,
            conflicts: 0
        };

        if (offlineData && offlineData.length > 0) {
            for (const item of offlineData) {
                try {
                    const response = await fetch('/api/marks/sync', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Sync-Priority': item.priority || 'normal',
                            'X-Offline-Timestamp': item.timestamp
                        },
                        body: JSON.stringify(item)
                    });

                    if (response.ok) {
                        await removeOfflineMarksData(item.id);
                        syncResults.successful++;
                        console.log('Service Worker: Synced marks data:', item.id);
                    } else if (response.status === 409) {
                        // Conflict detected
                        syncResults.conflicts++;
                        await handleSyncConflict(item, await response.json());
                    } else {
                        syncResults.failed++;
                        console.error('Service Worker: Sync failed for item:', item.id, response.status);
                    }
                } catch (error) {
                    syncResults.failed++;
                    console.error('Service Worker: Failed to sync item:', item.id, error);
                }
            }

            // Notify clients about sync completion
            await notifyClients({
                type: 'SYNC_COMPLETE',
                data: {
                    type: 'marks',
                    results: syncResults,
                    timestamp: Date.now()
                }
            });
        }
    } catch (error) {
        console.error('Service Worker: Background sync failed:', error);
        await notifyClients({
            type: 'SYNC_ERROR',
            data: {
                type: 'marks',
                error: error.message,
                timestamp: Date.now()
            }
        });
    }
}

// Sync student data
async function syncStudentData() {
    console.log('Service Worker: Syncing student data...');
    // Implementation for student data sync
}

// Sync offline actions
async function syncOfflineActions() {
    console.log('Service Worker: Syncing offline actions...');
    // Implementation for general offline actions sync
}

// Handle sync conflicts
async function handleSyncConflict(localItem, serverResponse) {
    console.log('Service Worker: Handling sync conflict for:', localItem.id);

    // Store conflict for user resolution
    await storeConflictForResolution({
        localData: localItem,
        serverData: serverResponse.data,
        conflictType: serverResponse.conflictType,
        timestamp: Date.now()
    });

    await notifyClients({
        type: 'SYNC_CONFLICT',
        data: {
            itemId: localItem.id,
            conflictType: serverResponse.conflictType,
            requiresUserAction: true
        }
    });
}

// Cleanup old cache entries
async function cleanupOldCache() {
    console.log('Service Worker: Cleaning up old cache entries...');

    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
        if (cacheName.includes(CACHE_VERSION)) {
            const cache = await caches.open(cacheName);
            const requests = await cache.keys();

            for (const request of requests) {
                const response = await cache.match(request);
                if (response && !(await isCacheValid(response, cacheName))) {
                    await cache.delete(request);
                    console.log('Service Worker: Removed expired cache entry:', request.url);
                }
            }
        }
    }
}

// IndexedDB operations for offline data (simplified)
async function getOfflineMarksData() {
    // This would integrate with the offline storage service
    // For now, return empty array as placeholder
    return [];
}

async function removeOfflineMarksData(id) {
    // This would remove the synced item from IndexedDB
    console.log('Service Worker: Removing synced offline data:', id);
}

// Enhanced message handling with comprehensive PWA features
self.addEventListener('message', (event) => {
    console.log('Service Worker: Received message:', event.data);

    if (!event.data || !event.data.type) return;

    switch (event.data.type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;

        case 'GET_CACHE_STATUS':
            getCacheStatus().then(status => {
                event.ports[0]?.postMessage(status);
            });
            break;

        case 'PRECACHE_RESOURCES':
            precacheResources(event.data.urls).then(() => {
                event.ports[0]?.postMessage({ success: true });
            }).catch(error => {
                event.ports[0]?.postMessage({ success: false, error: error.message });
            });
            break;

        case 'CLEAR_CACHE':
            clearSpecificCache(event.data.cacheName).then(() => {
                event.ports[0]?.postMessage({ success: true });
            }).catch(error => {
                event.ports[0]?.postMessage({ success: false, error: error.message });
            });
            break;

        case 'GET_OFFLINE_DATA':
            getOfflineDataSummary().then(data => {
                event.ports[0]?.postMessage(data);
            });
            break;

        case 'FORCE_SYNC':
            if ('serviceWorker' in self.registration) {
                self.registration.sync.register(event.data.tag || 'sync-offline-actions');
            }
            break;

        case 'UPDATE_CACHE_STRATEGY':
            updateCacheStrategy(event.data.strategy);
            break;

        default:
            console.log('Service Worker: Unknown message type:', event.data.type);
    }
});

// Enhanced cache status with detailed information
async function getCacheStatus() {
    const cacheNames = await caches.keys();
    const status = {
        version: CACHE_VERSION,
        caches: {},
        totalSize: 0,
        lastUpdated: new Date().toISOString()
    };

    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();

        let cacheSize = 0;
        const entries = [];

        for (const request of keys) {
            const response = await cache.match(request);
            if (response) {
                const size = await estimateResponseSize(response);
                cacheSize += size;
                entries.push({
                    url: request.url,
                    size: size,
                    cached: response.headers.get('X-Cache-Date') || 'unknown'
                });
            }
        }

        status.caches[cacheName] = {
            entries: entries.length,
            size: cacheSize,
            items: entries
        };
        status.totalSize += cacheSize;
    }

    return status;
}

// Precache specific resources
async function precacheResources(urls) {
    console.log('Service Worker: Precaching resources:', urls);

    const cache = await caches.open(STATIC_CACHE_NAME);
    const results = [];

    for (const url of urls) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                const responseToCache = response.clone();
                await addTimestampToResponse(responseToCache);
                await cache.put(url, responseToCache);
                results.push({ url, success: true });
            } else {
                results.push({ url, success: false, error: `HTTP ${response.status}` });
            }
        } catch (error) {
            results.push({ url, success: false, error: error.message });
        }
    }

    return results;
}

// Clear specific cache
async function clearSpecificCache(cacheName) {
    if (cacheName) {
        return await caches.delete(cacheName);
    } else {
        // Clear all caches
        const cacheNames = await caches.keys();
        return await Promise.all(cacheNames.map(name => caches.delete(name)));
    }
}

// Get offline data summary
async function getOfflineDataSummary() {
    try {
        const marksData = await getOfflineMarksData();
        const conflicts = await getStoredConflicts();

        return {
            marksData: marksData?.length || 0,
            conflicts: conflicts?.length || 0,
            lastSync: await getLastSyncTime(),
            isOnline: self.navigator.onLine
        };
    } catch (error) {
        console.error('Service Worker: Error getting offline data summary:', error);
        return {
            marksData: 0,
            conflicts: 0,
            lastSync: null,
            isOnline: self.navigator.onLine,
            error: error.message
        };
    }
}

// Update cache strategy dynamically
function updateCacheStrategy(strategy) {
    console.log('Service Worker: Updating cache strategy:', strategy);
    // This could be used to dynamically adjust caching behavior
    // based on network conditions or user preferences
}

// Enhanced IndexedDB operations for offline data management
async function getOfflineMarksData() {
    try {
        // This integrates with the offline storage service
        // For now, return empty array as placeholder - will be implemented by offline storage service
        return [];
    } catch (error) {
        console.error('Service Worker: Error getting offline marks data:', error);
        return [];
    }
}

async function removeOfflineMarksData(id) {
    try {
        console.log('Service Worker: Removing synced offline data:', id);
        // This would remove the synced item from IndexedDB
        // Implementation will be handled by offline storage service
    } catch (error) {
        console.error('Service Worker: Error removing offline data:', error);
    }
}

async function storeConflictForResolution(conflictData) {
    try {
        console.log('Service Worker: Storing conflict for resolution:', conflictData);
        // Store conflict data for user resolution
        // Implementation will be handled by offline storage service
    } catch (error) {
        console.error('Service Worker: Error storing conflict:', error);
    }
}

async function getStoredConflicts() {
    try {
        // Get stored conflicts for resolution
        return [];
    } catch (error) {
        console.error('Service Worker: Error getting stored conflicts:', error);
        return [];
    }
}

async function getLastSyncTime() {
    try {
        // Get last successful sync timestamp
        return null;
    } catch (error) {
        console.error('Service Worker: Error getting last sync time:', error);
        return null;
    }
}

// PWA-specific event handlers

// Handle app installation
self.addEventListener('beforeinstallprompt', (event) => {
    console.log('Service Worker: Before install prompt');
    // This event is handled by the main app, but we can log it here
});

// Handle app installation completion
self.addEventListener('appinstalled', (event) => {
    console.log('Service Worker: App installed successfully');

    // Track installation
    notifyClients({
        type: 'APP_INSTALLED',
        data: {
            timestamp: Date.now(),
            userAgent: self.navigator.userAgent
        }
    });
});

// Handle push notifications (if implemented later)
self.addEventListener('push', (event) => {
    console.log('Service Worker: Push notification received');

    if (event.data) {
        const data = event.data.json();

        event.waitUntil(
            self.registration.showNotification(data.title || 'AIC Da\'wa College', {
                body: data.body || 'New update available',
                icon: '/icon-192x192.png',
                badge: '/icon-192x192.png',
                tag: data.tag || 'general',
                data: data.data || {},
                actions: data.actions || []
            })
        );
    }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('Service Worker: Notification clicked');

    event.notification.close();

    event.waitUntil(
        self.clients.matchAll().then(clients => {
            // Focus existing client or open new one
            if (clients.length > 0) {
                return clients[0].focus();
            } else {
                return self.clients.openWindow('/');
            }
        })
    );
});

// Performance monitoring
let performanceMetrics = {
    cacheHits: 0,
    cacheMisses: 0,
    networkRequests: 0,
    offlineRequests: 0
};

// Track cache performance
function trackCacheHit() {
    performanceMetrics.cacheHits++;
}

function trackCacheMiss() {
    performanceMetrics.cacheMisses++;
}

function trackNetworkRequest() {
    performanceMetrics.networkRequests++;
}

function trackOfflineRequest() {
    performanceMetrics.offlineRequests++;
}

// Periodic performance reporting
setInterval(() => {
    if (performanceMetrics.cacheHits > 0 || performanceMetrics.networkRequests > 0) {
        console.log('Service Worker Performance:', performanceMetrics);

        notifyClients({
            type: 'PERFORMANCE_METRICS',
            data: {
                ...performanceMetrics,
                timestamp: Date.now()
            }
        });

        // Reset metrics
        performanceMetrics = {
            cacheHits: 0,
            cacheMisses: 0,
            networkRequests: 0,
            offlineRequests: 0
        };
    }
}, 5 * 60 * 1000); // Every 5 minutes

// Utility function to estimate response size
async function estimateResponseSize(response) {
    try {
        const clone = response.clone();
        const buffer = await clone.arrayBuffer();
        return buffer.byteLength;
    } catch (error) {
        return 0;
    }
}

// Notify all clients
async function notifyClients(message) {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage(message);
    });
}

console.log('Service Worker: Enhanced PWA script loaded successfully v' + CACHE_VERSION);