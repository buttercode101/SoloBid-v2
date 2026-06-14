import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export type OnboardingStep = 'welcome' | 'profile' | 'preferences' | 'complete';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'none';

export interface UserProfile {
  uid: string;
  fullName?: string;
  businessName: string;
  industry?: string;
  mobileNumber?: string;
  logoUrl?: string;
  defaultLaborRate: number;
  defaultTaxRate: number;
  defaultMarkup: number;
  terms: string;
  invoicePrefix?: string;
  invoiceCount?: number;
  pdfStyle?: string;
  pdfFont?: string;
  defaultCurrency?: string;
  vatNumber?: string;
  businessRegistrationNumber?: string;
  address?: string;
  saTaxInvoiceMode?: boolean;
  country?: string;
  onboardingStep?: OnboardingStep;
  onboardingComplete?: boolean;
  profileComplete?: boolean;
  profileCompletion?: number;
  subscriptionStatus?: SubscriptionStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthState {
  authenticated: boolean;
  onboardingComplete: boolean;
  profileComplete: boolean;
  profileCompletion: number;
  subscriptionStatus: SubscriptionStatus;
  nextOnboardingStep: OnboardingStep;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  authState: AuthState;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  saveProfileDraft: (profilePatch: Partial<UserProfile>) => Promise<void>;
}

const REQUIRED_PROFILE_FIELDS: Array<keyof UserProfile> = [
  'businessName',
  'mobileNumber',
];

const ONBOARDING_ORDER: OnboardingStep[] = ['welcome', 'profile', 'preferences', 'complete'];

export function getProfileCompletion(profile: UserProfile | null): number {
  if (!profile) return 0;
  const completedFields = REQUIRED_PROFILE_FIELDS.filter((field) => {
    const value = profile[field];
    return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
  }).length;

  return Math.round((completedFields / REQUIRED_PROFILE_FIELDS.length) * 100);
}

function normalizeOnboardingStep(step?: OnboardingStep): OnboardingStep {
  return step && ONBOARDING_ORDER.includes(step) ? step : 'welcome';
}

function getNextOnboardingStep(profile: UserProfile | null): OnboardingStep {
  if (!profile) return 'welcome';
  if (profile.onboardingComplete && getProfileCompletion(profile) === 100) return 'complete';
  return normalizeOnboardingStep(profile.onboardingStep);
}

function buildAuthState(user: User | null, profile: UserProfile | null): AuthState {
  const profileCompletion = getProfileCompletion(profile);
  const profileComplete = profileCompletion === 100 && Boolean(profile?.profileComplete);
  const onboardingComplete = profileComplete && Boolean(profile?.onboardingComplete);

  return {
    authenticated: Boolean(user),
    onboardingComplete,
    profileComplete,
    profileCompletion,
    subscriptionStatus: profile?.subscriptionStatus || 'none',
    nextOnboardingStep: onboardingComplete ? 'complete' : getNextOnboardingStep(profile),
  };
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  authState: buildAuthState(null, null),
  loading: true,
  error: null,
  signOut: async () => {},
  refreshProfile: async () => {},
  saveProfileDraft: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (uid: string) => {
    try {
      setError(null);
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const remoteProfile = docSnap.data() as UserProfile;
        localStorage.setItem(`profile_${uid}`, JSON.stringify(remoteProfile));
        setProfile(remoteProfile);
      } else {
        setProfile(null);
        localStorage.removeItem(`profile_${uid}`);
      }
    } catch (fetchError) {
      console.error('Error fetching profile from DB:', fetchError);
      const cached = localStorage.getItem(`profile_${uid}`);
      if (cached) {
        setProfile(JSON.parse(cached));
        setError('Using your saved profile because SoloBid could not reach the server.');
      } else {
        setProfile(null);
        setError('We could not load your profile. You can still continue setup when your connection recovers.');
      }
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  const saveProfileDraft = async (profilePatch: Partial<UserProfile>) => {
    if (!user) return;

    const now = new Date().toISOString();
    const baseProfile: UserProfile = {
      uid: user.uid,
      businessName: '',
      defaultLaborRate: 75,
      defaultTaxRate: 0,
      defaultMarkup: 20,
      terms: 'Payment is due within 14 days of invoice date.',
      defaultCurrency: 'USD',
      country: 'US',
      invoicePrefix: 'INV-',
      invoiceCount: 0,
      pdfStyle: 'modern',
      pdfFont: 'Helvetica',
      onboardingStep: 'welcome',
      onboardingComplete: false,
      profileComplete: false,
      profileCompletion: 0,
      subscriptionStatus: 'trial',
      createdAt: now,
    };

    const nextProfile = {
      ...baseProfile,
      ...profile,
      ...profilePatch,
      uid: user.uid,
      updatedAt: now,
      createdAt: profile?.createdAt || profilePatch.createdAt || now,
    } as UserProfile;

    const profileCompletion = getProfileCompletion(nextProfile);
    nextProfile.profileCompletion = profileCompletion;
    nextProfile.profileComplete = profileCompletion === 100 && Boolean(profilePatch.profileComplete ?? nextProfile.profileComplete);
    nextProfile.onboardingComplete = nextProfile.profileComplete && Boolean(profilePatch.onboardingComplete ?? nextProfile.onboardingComplete);

    setProfile(nextProfile);
    localStorage.setItem(`profile_${user.uid}`, JSON.stringify(nextProfile));

    try {
      await setDoc(doc(db, 'users', user.uid), nextProfile, { merge: true });
    } catch (saveError) {
      console.error('Error saving profile draft:', saveError);
      setError('Your setup was saved on this device and will be retried when the connection recovers.');
      throw saveError;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setError(null);
      if (currentUser) {
        setUser(currentUser);
        await fetchProfile(currentUser.uid);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
  };

  const authState = useMemo(() => buildAuthState(user, profile), [user, profile]);

  return (
    <AuthContext.Provider value={{ user, profile, authState, loading, error, signOut, refreshProfile, saveProfileDraft }}>
      {children}
    </AuthContext.Provider>
  );
};
