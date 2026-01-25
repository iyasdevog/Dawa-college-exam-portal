
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

/**
 * Verified Firebase Project Configuration for 'my-edumark-portal'
 */
const firebaseConfig = {
  apiKey: "AIzaSyAdLPv3dTm2xbVuWnfSYD0-3szsAQPZm3w",
  authDomain: "my-edumark-portal.firebaseapp.com",
  projectId: "my-edumark-portal",
  storageBucket: "my-edumark-portal.firebasestorage.app",
  messagingSenderId: "445255012917",
  appId: "1:445255012917:web:c4ed8b06b6dfa84d84977c",
  measurementId: "G-LLMWHDTZ1T"
};

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
