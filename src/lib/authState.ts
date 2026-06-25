import type { OnboardingStep, SubscriptionStatus, UserProfile } from '../types';

export type { OnboardingStep, SubscriptionStatus, UserProfile };

export interface AuthState {
  authenticated: boolean;
  onboardingComplete: boolean;
  profileComplete: boolean;
  profileCompletion: number;
  subscriptionStatus: SubscriptionStatus;
  nextOnboardingStep: OnboardingStep;
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

export function buildAuthState(user: unknown | null, profile: UserProfile | null): AuthState {
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
