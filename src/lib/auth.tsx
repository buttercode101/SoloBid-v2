import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, fromDbUser, toDbUser } from './supabase';

export type OnboardingStep = 'welcome' | 'profile' | 'preferences' | 'complete';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'canceled' | 'none';

// Supabase User augmented with Firebase-compatible uid alias
export type AppUser = User & { uid: string };

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
  quotePrefix?: string;
  quoteCount?: number;
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
  user: AppUser | null;
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

function buildAuthState(user: AppUser | null, profile: UserProfile | null): AuthState {
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

function makeAppUser(user: User): AppUser {
  return Object.assign(Object.create(Object.getPrototypeOf(user)), user, { uid: user.id });
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
  const [user, setUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (uid: string) => {
    try {
      setError(null);
      const { data, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('id', uid)
        .single();

      if (dbError && dbError.code !== 'PGRST116') throw dbError;

      if (data) {
        const remoteProfile = fromDbUser(data) as UserProfile;
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
      await fetchProfile(user.id);
    }
  };

  const saveProfileDraft = async (profilePatch: Partial<UserProfile>) => {
    if (!user) return;

    const now = new Date().toISOString();
    const baseProfile: UserProfile = {
      uid: user.id,
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
      uid: user.id,
      updatedAt: now,
      createdAt: profile?.createdAt || profilePatch.createdAt || now,
    } as UserProfile;

    const profileCompletion = getProfileCompletion(nextProfile);
    nextProfile.profileCompletion = profileCompletion;
    nextProfile.profileComplete = profileCompletion === 100 && Boolean(profilePatch.profileComplete ?? nextProfile.profileComplete);
    nextProfile.onboardingComplete = nextProfile.profileComplete && Boolean(profilePatch.onboardingComplete ?? nextProfile.onboardingComplete);

    setProfile(nextProfile);
    localStorage.setItem(`profile_${user.id}`, JSON.stringify(nextProfile));

    try {
      const dbRow = toDbUser(nextProfile);
      dbRow.id = user.id;
      const { error: upsertError } = await supabase.from('users').upsert(dbRow);
      if (upsertError) throw upsertError;
    } catch (saveError) {
      console.error('Error saving profile draft:', saveError);
      setError('Your setup was saved on this device and will be retried when the connection recovers.');
      throw saveError;
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setError(null);
      if (session?.user) {
        const appUser = makeAppUser(session.user);
        setUser(appUser);
        const cached = localStorage.getItem(`profile_${session.user.id}`);
        if (cached) {
          try { setProfile(JSON.parse(cached)); } catch {}
          setLoading(false);
          fetchProfile(session.user.id);
        } else {
          setLoading(true);
          await fetchProfile(session.user.id);
          setLoading(false);
        }
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
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
