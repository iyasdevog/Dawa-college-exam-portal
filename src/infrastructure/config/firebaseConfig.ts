import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  Firestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentSingleTabManager 
} from "firebase/firestore";

import { configurationService } from "../services/ConfigurationService";

/**
 * Validated Firebase Project Configuration from ConfigurationService
 */
const firebaseConfig = configurationService.getFirebaseConfig();

// Initialize Firebase safely
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let dbInstance: Firestore | null = null;

export const getDb = (): Firestore => {
  if (dbInstance) return dbInstance;

  try {
    dbInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager({})
      })
    });
  } catch (err) {
    console.warn("Firestore: SecurityError while enabling persistence. Falling back to memory-only mode.", err);
    // Explicitly fallback to memory-only by not passing localCache
    dbInstance = initializeFirestore(app, {});
  }

  return dbInstance;
};

// Default export for convenience
export const db = getDb();
