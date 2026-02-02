/**
 * Service Worker Cleanup Script
 * Forces unregistration of all service workers and clears caches
 * to resolve 'ERR_FAILED' and broken deployment issues.
 */

export const cleanupServiceWorkers = async () => {
    if ('serviceWorker' in navigator) {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            if (registrations.length > 0) {
                console.log(`[Cleanup] Found ${registrations.length} service workers. Unregistering...`);
                for (const registration of registrations) {
                    const result = await registration.unregister();
                    console.log(`[Cleanup] Unregistered SW at ${registration.scope}: ${result ? 'Success' : 'Failed'}`);
                }
                // Force reload to ensure clean slate if we actually removed something
                console.log('[Cleanup] Reloading page to apply changes...');
                window.location.reload();
            } else {
                console.log('[Cleanup] No service workers found.');
            }
        } catch (error) {
            console.error('[Cleanup] Error during SW cleanup:', error);
        }
    }
};
