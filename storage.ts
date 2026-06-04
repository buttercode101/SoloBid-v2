import { getAuth, GoogleAuthProvider } from './mockFirebase/auth';
import { getFirestore } from './mockFirebase/firestore';
import { getStorage } from './mockFirebase/storage';

export const auth = getAuth();
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore();
export const storage = getStorage();
