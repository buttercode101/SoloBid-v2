import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, fromDbUser, toDbUser } from './supabase';
import type { UserProfile } from '../types';
import { getDefaultSaBusinessSettings } from './integrations/saLocal';
import { buildAuthState, getProfileCompletion, type AuthState } from './authState';

export type { AuthState, OnboardingStep, SubscriptionStatus, UserProfile } from './authState';

// Supabase User augmented with Firebase-compatible uid alias
export type AppUser = User & { uid: string };

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
    const saDefaults = getDefaultSaBusinessSettings();
    const baseProfile: UserProfile = {
      uid: user.id,
      businessName: '',
      defaultLaborRate: 450,
      defaultTaxRate: saDefaults.defaultVatRate,
      defaultMarkup: 20,
      terms: saDefaults.invoiceTerms,
      defaultCurrency: saDefaults.currency,
      country: saDefaults.country,
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
