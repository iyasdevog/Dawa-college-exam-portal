import { storageFallback } from './StorageFallbackService';

const VERSION_KEY = 'app_build_version';

export class VersionService {
    /**
     * Get the current app build version timestamp
     */
    public getAppVersion(): string {
        try {
            return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
        } catch {
            return '1.0.0';
        }
    }

    /**
     * Check if a new version has been deployed.
     * If the stored build version doesn't match current build version,
     * invalidates stale assets/caches and updates stored version.
     */
    public async checkAndInvalidateStaleBuild(): Promise<boolean> {
        try {
            const currentVersion = this.getAppVersion();
            const storedVersion = storageFallback.getItem<string>(VERSION_KEY);

            if (storedVersion && storedVersion !== currentVersion) {
                console.log(`[VersionService] New app build detected (${storedVersion} -> ${currentVersion}). Invalidating stale cache...`);
                await this.clearAppCacheOnly();
                storageFallback.setItem(VERSION_KEY, currentVersion);
                return true; // updated
            } else if (!storedVersion) {
                storageFallback.setItem(VERSION_KEY, currentVersion);
            }
        } catch (error) {
            console.warn('[VersionService] Error during version check:', error);
        }
        return false;
    }

    /**
     * Clears Service Workers and CacheStorage caches without wiping user credentials if not forced.
     */
    public async clearAppCacheOnly(): Promise<void> {
        try {
            // 1. Unregister all service workers
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const reg of registrations) {
                    await reg.unregister();
                }
            }

            // 2. Clear CacheStorage
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            }
        } catch (error) {
            console.error('[VersionService] Error clearing cache storage:', error);
        }
    }

    /**
     * Prominent 1-tap reset: Unregisters SWs, clears CacheStorage, LocalStorage, SessionStorage,
     * IndexedDB, and hard reloads the application with location cache busting.
     */
    public async forceClearCacheAndReload(): Promise<void> {
        try {
            // 1. Clear caches & service workers
            await this.clearAppCacheOnly();

            // 2. Clear storage
            storageFallback.clear();
            try {
                if (typeof window !== 'undefined' && window.sessionStorage) {
                    window.sessionStorage.clear();
                }
            } catch (e) {}

            // 3. Clear IndexedDB if possible
            if (typeof window !== 'undefined' && 'indexedDB' in window) {
                try {
                    const dbs = await window.indexedDB.databases();
                    for (const db of dbs) {
                        if (db.name) {
                            window.indexedDB.deleteDatabase(db.name);
                        }
                    }
                } catch (e) {
                    // indexedDB.databases() might fail in some mobile browsers
                }
            }

            // 4. Force reload with cache busting query param
            const cleanUrl = window.location.origin + window.location.pathname + '?reset=' + Date.now();
            window.location.href = cleanUrl;
        } catch (error) {
            console.error('[VersionService] Failed to force reset:', error);
            window.location.reload();
        }
    }
}

export const versionService = new VersionService();
