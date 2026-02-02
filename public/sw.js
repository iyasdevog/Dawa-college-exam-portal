// "Killer" Service Worker
// This worker is designed to replace a broken service worker and immediately unregister itself.

self.addEventListener('install', (event) => {
    // Skip waiting to ensure this new worker activates immediately,
    // replacing the broken one.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Claim clients to take control immediately
    event.waitUntil(
        self.clients.claim().then(() => {
            // Unregister this service worker
            return self.registration.unregister();
        }).then(() => {
            console.log('Broken Service Worker has been replaced and unregistered.');
            // Notify clients (the page) that they should probably reload
            return self.clients.matchAll();
        }).then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'SW_REMOVED',
                    message: 'Service Worker has been removed. Please reload.'
                });
            });
        })
    );
});
