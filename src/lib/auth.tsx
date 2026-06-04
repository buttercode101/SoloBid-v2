import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut, signInAnonymously } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  businessName: string;
  logoUrl?: string;
  defaultLaborRate: number;
  defaultTaxRate: number;
  defaultMarkup: number;
  terms: string;
  invoicePrefix?: string;
  pdfStyle?: string;
  pdfFont?: string;
  defaultCurrency?: string;
  vatNumber?: string;
  saTaxInvoiceMode?: boolean;
  country?: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const createAndSetDefaultProfile = async (uid: string) => {
    const defaultProfile: UserProfile = {
      uid,
      businessName: 'My Business',
      defaultLaborRate: 75,
      defaultTaxRate: 15,
      defaultMarkup: 20,
      terms: 'Payment is due within 14 days of invoice date.',
      defaultCurrency: 'USD',
      createdAt: new Date().toISOString(),
    };

    try {
      const docRef = doc(db, 'users', uid);
      await setDoc(docRef, defaultProfile);
      setProfile(defaultProfile);
    } catch (writeError) {
      console.warn("Could not write default profile to Firestore:", writeError);
      // Fallback to local storage or local state so they can still proceed
      setProfile(defaultProfile);
      localStorage.setItem(`profile_${uid}`, JSON.stringify(defaultProfile));
    }
  };

  const fetchProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        // If profile doesn't exist, automatically bootstrap a default profile
        await createAndSetDefaultProfile(uid);
      }
    } catch (error) {
      console.error("Error fetching profile from DB:", error);
      // Try local storage fallback if DB fetch is blocked or fails
      const cached = localStorage.getItem(`profile_${uid}`);
      if (cached) {
        setProfile(JSON.parse(cached));
      } else {
        // Fallback profile
        const defaultProfile: UserProfile = {
          uid,
          businessName: 'My Business',
          defaultLaborRate: 75,
          defaultTaxRate: 15,
          defaultMarkup: 20,
          terms: 'Payment is due within 14 days of invoice date.',
          defaultCurrency: 'USD',
          createdAt: new Date().toISOString(),
        };
        setProfile(defaultProfile);
      }
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchProfile(currentUser.uid);
        setLoading(false);
      } else {
        // No authenticated user present, attempt automatic anonymous sign-in
        try {
          await signInAnonymously(auth);
          // This will trigger onAuthStateChanged again with the new anonymous user
        } catch (error) {
          console.warn("Firebase Anonymous Sign-In is not enabled or failed. Falling back to Mock Guest:", error);
          
          // Securely generate a persistent guest UID for this device
          let guestUid = localStorage.getItem('guest_uid');
          if (!guestUid) {
            guestUid = 'guest_' + Math.random().toString(36).substring(2, 11);
            localStorage.setItem('guest_uid', guestUid);
          }

          const guestUser = {
            uid: guestUid,
            email: null,
            emailVerified: false,
            isAnonymous: true,
            displayName: 'Guest Contractor',
            photoURL: null,
          } as any;

          setUser(guestUser);
          await fetchProfile(guestUid);
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
