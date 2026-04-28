
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, Firestore, enableIndexedDbPersistence } from "firebase/firestore";

import { configurationService } from "../services/ConfigurationService";

/**
 * Validated Firebase Project Configuration from ConfigurationService
 */
const firebaseConfig = configurationService.getFirebaseConfig();

// Initialize Firebase safely
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let dbInstance: Firestore | null = null;

export const getDb = (): Firestore | null => {
  if (!dbInstance) {
    try {
      dbInstance = getFirestore(app);
      
      // Enable persistence for offline access and faster reloads
      if (typeof window !== 'undefined') {
        enableIndexedDbPersistence(dbInstance).catch((err) => {
          if (err.code === 'failed-precondition') {
            // Multiple tabs open, persistence can only be enabled in one tab at a a time.
            console.warn('Firestore persistence failed: Multiple tabs open');
          } else if (err.code === 'unimplemented') {
            // The current browser does not support all of the features required to enable persistence
            console.warn('Firestore persistence failed: Browser not supported');
          }
        });
      }
    } catch (e) {
      console.warn("Firestore initialization failed. Ensure your config is correct.", e);
      return null;
    }
  }
  return dbInstance;
};

// Default export for convenience
export const db = getDb();
