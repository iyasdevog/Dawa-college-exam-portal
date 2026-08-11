// Service Worker
const manifest = self.__WB_MANIFEST;

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        self.clients.claim().then(() => {
            return self.registration.unregister();
        })
    );
});
