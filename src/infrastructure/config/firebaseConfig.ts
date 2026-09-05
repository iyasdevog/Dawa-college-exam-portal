import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  Firestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentSingleTabManager,
  memoryLocalCache
} from "firebase/firestore";

import { configurationService } from "../services/ConfigurationService";

/**
 * Validated Firebase Project Configuration from ConfigurationService
 */
const firebaseConfig = configurationService.getFirebaseConfig();

// Initialize Firebase safely
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let dbInstance: Firestore | null = null;

/**
 * Helper to check if browser storage (localStorage and indexedDB) is accessible
 * without throwing SecurityError (e.g. Incognito mode, embedded webviews, or strict browser policies).
 */
const isStorageAccessible = (): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    const testKey = '__fs_storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

export const getDb = (): Firestore => {
  if (dbInstance) return dbInstance;

  // If local storage is restricted/blocked, use memoryLocalCache immediately
  if (!isStorageAccessible()) {
    console.warn("Firestore: Storage access denied/restricted. Initializing with memoryLocalCache.");
    try {
      dbInstance = initializeFirestore(app, {
        localCache: memoryLocalCache()
      });
      return dbInstance;
    } catch (e) {
      console.warn("Firestore: initializeFirestore memory fallthrough fallback to getFirestore.", e);
      dbInstance = getFirestore(app);
      return dbInstance;
    }
  }

  try {
    dbInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager({})
      })
    });
  } catch (err) {
    console.warn("Firestore: SecurityError/Exception while enabling persistence. Falling back to memory cache.", err);
    try {
      dbInstance = initializeFirestore(app, {
        localCache: memoryLocalCache()
      });
    } catch (innerErr) {
      dbInstance = getFirestore(app);
    }
  }

  return dbInstance;
};



