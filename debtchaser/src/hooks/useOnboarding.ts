import { useState, useCallback, useEffect } from 'react';
import { isOnboardingComplete, setOnboardingComplete } from '../services/storage';

export interface UseOnboardingReturn {
  hasSeenOnboarding: boolean;
  loading: boolean;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export const useOnboarding = (): UseOnboardingReturn => {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  /**
   * Refresh onboarding status from storage
   */
  const refreshStatus = useCallback(async () => {
    try {
      setLoading(true);
      const complete = await isOnboardingComplete();
      setHasSeenOnboarding(complete);
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
      setHasSeenOnboarding(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  /**
   * Mark onboarding as complete
   */
  const completeOnboarding = useCallback(async (): Promise<void> => {
    try {
      await setOnboardingComplete();
      setHasSeenOnboarding(true);
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      throw error;
    }
  }, []);

  /**
   * Reset onboarding (for testing/debugging)
   */
  const resetOnboarding = useCallback(async (): Promise<void> => {
    try {
      const { storageService, STORAGE_KEYS } = await import('../services');
      await storageService.delete(STORAGE_KEYS.ONBOARDING);
      setHasSeenOnboarding(false);
    } catch (error) {
      console.error('Failed to reset onboarding:', error);
      throw error;
    }
  }, []);

  return {
    hasSeenOnboarding,
    loading,
    completeOnboarding,
    resetOnboarding,
    refreshStatus,
  };
};
