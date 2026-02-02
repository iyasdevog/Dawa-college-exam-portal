
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

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
    } catch (e) {
      console.warn("Firestore initialization failed. Ensure your config is correct.", e);
      return null;
    }
  }
  return dbInstance;
};

// Default export for convenience
export const db = getDb();
