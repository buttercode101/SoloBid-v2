import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

let app;
try {
  if (!firebaseConfig || !firebaseConfig.apiKey) {
    throw new Error("Firebase configuration is missing or invalid. Please check firebase-applet-config.json");
  }
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error("Firebase initialization failed:", error);
  throw error;
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
}, (firebaseConfig as any)?.firestoreDatabaseId);

export const storage = getStorage(app);
