/**
 * In-memory storage fallback when localStorage/sessionStorage are inaccessible
 */
class MemoryStorage implements Storage {
    private store = new Map<string, string>();

    get length(): number {
        return this.store.size;
    }

    clear(): void {
        this.store.clear();
    }

    getItem(key: string): string | null {
        return this.store.get(key) ?? null;
    }

    key(index: number): string | null {
        return Array.from(this.store.keys())[index] ?? null;
    }

    removeItem(key: string): void {
        this.store.delete(key);
    }

    setItem(key: string, value: string): void {
        this.store.set(key, String(value));
    }
}

/**
 * Simplified Storage Service
 * Provides basic local/session storage access with simple error handling and memory fallback.
 */
export class StorageFallbackService {
    private storage: Storage;

    constructor(useSession: boolean = false) {
        try {
            const target = useSession ? window.sessionStorage : window.localStorage;
            // Test if storage is actually writable/readable
            const testKey = '__storage_test_key__';
            target.setItem(testKey, testKey);
            target.removeItem(testKey);
            this.storage = target;
        } catch {
            console.warn('[Storage] Storage access denied or unavailable. Falling back to MemoryStorage.');
            this.storage = new MemoryStorage();
        }
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