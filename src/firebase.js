import { getApp, getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  initializeAuth,
} from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missing = [
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_DATABASE_URL",
].filter((key) => !import.meta.env[key]);

if (missing.length) {
  throw new Error(
    `Missing Firebase config: ${missing.join(", ")}. Copy .env.example to .env and fill in your values.`,
  );
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createAuth() {
  try {
    return initializeAuth(app, {
      persistence: browserLocalPersistence,
    });
  } catch (error) {
    if (error?.code === "auth/already-initialized") {
      return getAuth(app);
    }
    throw error;
  }
}

export const auth = createAuth();
export const db = getDatabase(app);
