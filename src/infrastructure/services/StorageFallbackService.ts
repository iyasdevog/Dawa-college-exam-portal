/**
 * Simplified Storage Service
 * Provides basic local/session storage access with simple error handling.
 */

export class StorageFallbackService {
    private storage: Storage;

    constructor(useSession: boolean = false) {
        this.storage = useSession ? sessionStorage : localStorage;
    }

    getItem<T>(key: string): T | null {
        try {
            const item = this.storage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error('[Storage] Error reading key:', key, error);
            return null;
        }
    }

    setItem(key: string, value: any): void {
        try {
            this.storage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('[Storage] Error saving key:', key, error);
        }
    }

    removeItem(key: string): void {
        try {
            this.storage.removeItem(key);
        } catch (error) {
            console.error('[Storage] Error removing key:', key, error);
        }
    }

    clear(): void {
        try {
            this.storage.clear();
        } catch (error) {
            console.error('[Storage] Error clearing storage', error);
        }
    }
}

export const storageFallback = new StorageFallbackService();