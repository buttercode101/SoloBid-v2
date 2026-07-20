import { useState, useCallback, useEffect } from 'react';
import { Settings } from '../types';
import { loadSettings, saveSettings } from '../services/storage';
import { DEFAULT_SETTINGS } from '../constants';

export interface UseSettingsReturn {
  settings: Settings;
  loading: boolean;
  error: string | null;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  refreshSettings: () => Promise<void>;
}

export const useSettings = (): UseSettingsReturn => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load settings from storage
   */
  const refreshSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const loaded = await loadSettings();
      setSettings(loaded);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load settings';
      setError(errorMessage);
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  /**
   * Update settings (merge with existing)
   */
  const updateSettings = useCallback(async (newSettings: Partial<Settings>): Promise<void> => {
    try {
      const updated = { ...settings, ...newSettings };
      await saveSettings(updated);
      setSettings(updated);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings';
      setError(errorMessage);
      throw err;
    }
  }, [settings]);

  /**
   * Reset settings to defaults
   */
  const resetSettings = useCallback(async (): Promise<void> => {
    try {
      await saveSettings(DEFAULT_SETTINGS);
      setSettings(DEFAULT_SETTINGS);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset settings';
      setError(errorMessage);
      throw err;
    }
  }, []);

  return {
    settings,
    loading,
    error,
    updateSettings,
    resetSettings,
    refreshSettings,
  };
};
