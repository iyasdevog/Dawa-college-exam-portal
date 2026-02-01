// Service Worker for AIC Da'wa College Exam Portal
// Provides offline capability for faculty marks entry

const CACHE_NAME = 'aic-dawa-college-v1';
const STATIC_CACHE_NAME = 'aic-dawa-static-v1';
const DYNAMIC_CACHE_NAME = 'aic-dawa-dynamic-v1';

// Critical resources to cache for offline functionality
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    // Core JS and CSS files will be added by Vite build process
];

// API endpoints that should be cached
const CACHEABLE_APIS = [
    '/api/students',
    '/api/subjects',
    '/api/marks'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');

    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Service Worker: Static assets cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Error caching static assets:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activated successfully');
                return self.clients.claim();
            })
    );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests and chrome-extension requests
    if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
        return;
    }

    // Handle different types of requests with appropriate strategies
    if (isStaticAsset(request)) {
        // Cache First strategy for static assets
        event.respondWith(cacheFirstStrategy(request, STATIC_CACHE_NAME));
    } else if (isAPIRequest(request)) {
        // Network First strategy for API requests with offline fallback
        event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE_NAME));
    } else if (isNavigationRequest(request)) {
        // Network First strategy for navigation with offline fallback to index.html
        event.respondWith(navigationStrategy(request));
    } else {
        // Stale While Revalidate for other resources
        event.respondWith(staleWhileRevalidateStrategy(request, DYNAMIC_CACHE_NAME));
    }
});

// Cache First Strategy - for static assets
async function cacheFirstStrategy(request, cacheName) {
    try {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            console.log('Service Worker: Serving from cache:', request.url);
            return cachedResponse;
        }

        console.log('Service Worker: Fetching and caching:', request.url);
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;
    } catch (error) {
        console.error('Service Worker: Cache First strategy failed:', error);
        throw error;
    }
}

// Network First Strategy - for API requests
async function networkFirstStrategy(request, cacheName) {
    try {
        console.log('Service Worker: Attempting network request:', request.url);
        const networkResponse = await fetch(request);

        if (networkResponse.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, networkResponse.clone());
            console.log('Service Worker: Network response cached:', request.url);
        }

        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Network failed, trying cache:', request.url);

        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            console.log('Service Worker: Serving cached response:', request.url);
            return cachedResponse;
        }

        // If it's a marks-related API request and we're offline, return a special response
        if (request.url.includes('/marks') || request.url.includes('/students')) {
            return new Response(
                JSON.stringify({
                    offline: true,
                    message: 'Offline mode - data may not be current',
                    timestamp: Date.now()
                }),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }
            );
        }

        throw error;
    }
}

// Navigation Strategy - for page navigation
async function navigationStrategy(request) {
    try {
        console.log('Service Worker: Navigation request:', request.url);
        const networkResponse = await fetch(request);
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Navigation failed, serving offline page');

        const cache = await caches.open(STATIC_CACHE_NAME);
        const offlineResponse = await cache.match('/index.html');

        if (offlineResponse) {
            return offlineResponse;
        }

        // Fallback offline page
        return new Response(
            `<!DOCTYPE html>
      <html>
      <head>
        <title>AIC Da'wa College - Offline</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .offline-message { max-width: 400px; margin: 0 auto; }
          .icon { font-size: 48px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="offline-message">
          <div class="icon">📱</div>
          <h1>You're Offline</h1>
          <p>The AIC Da'wa College Exam Portal is not available right now. Please check your internet connection and try again.</p>
          <button onclick="window.location.reload()">Try Again</button>
        </div>
      </body>
      </html>`,
            {
                status: 200,
                headers: { 'Content-Type': 'text/html' }
            }
        );
    }
}

// Stale While Revalidate Strategy
async function staleWhileRevalidateStrategy(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    // Fetch in background to update cache
    const fetchPromise = fetch(request)
        .then((networkResponse) => {
            if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        })
        .catch((error) => {
            console.log('Service Worker: Background fetch failed:', error);
        });

    // Return cached response immediately if available, otherwise wait for network
    if (cachedResponse) {
        console.log('Service Worker: Serving stale content:', request.url);
        return cachedResponse;
    }

    return fetchPromise;
}

// Helper functions
function isStaticAsset(request) {
    const url = new URL(request.url);
    return url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/);
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
        (request.method === 'GET' && request.headers.get('accept').includes('text/html'));
}

// Background sync for offline data
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync triggered:', event.tag);

    if (event.tag === 'sync-marks-data') {
        event.waitUntil(syncMarksData());
    }
});

// Sync marks data when back online
async function syncMarksData() {
    try {
        console.log('Service Worker: Syncing offline marks data...');

        // Get offline data from IndexedDB
        const offlineData = await getOfflineMarksData();

        if (offlineData && offlineData.length > 0) {
            // Send data to server
            for (const item of offlineData) {
                try {
                    const response = await fetch('/api/marks/sync', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(item)
                    });

                    if (response.ok) {
                        // Remove synced item from offline storage
                        await removeOfflineMarksData(item.id);
                        console.log('Service Worker: Synced marks data:', item.id);
                    }
                } catch (error) {
                    console.error('Service Worker: Failed to sync item:', item.id, error);
                }
            }

            // Notify the main thread about sync completion
            const clients = await self.clients.matchAll();
            clients.forEach(client => {
                client.postMessage({
                    type: 'SYNC_COMPLETE',
                    data: { synced: offlineData.length }
                });
            });
        }
    } catch (error) {
        console.error('Service Worker: Background sync failed:', error);
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

// Handle messages from main thread
self.addEventListener('message', (event) => {
    console.log('Service Worker: Received message:', event.data);

    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'GET_CACHE_STATUS') {
        getCacheStatus().then(status => {
            event.ports[0].postMessage(status);
        });
    }
});

// Get cache status for debugging
async function getCacheStatus() {
    const cacheNames = await caches.keys();
    const status = {};

    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        status[cacheName] = keys.length;
    }

    return status;
}

console.log('Service Worker: Script loaded successfully');