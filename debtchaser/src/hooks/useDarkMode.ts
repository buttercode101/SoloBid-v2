import { useState, useCallback, useEffect } from 'react';
import { useSettings } from './useSettings';

export interface UseDarkModeReturn {
  isDark: boolean;
  toggle: () => Promise<void>;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

export const useDarkMode = (): UseDarkModeReturn => {
  const { settings, updateSettings } = useSettings();
  const [isDark, setIsDark] = useState(false);
  const [initialized, setInitialized] = useState(false);

  /**
   * Initialize dark mode from settings or system preference
   */
  useEffect(() => {
    // Check settings
    if (settings.darkMode !== undefined) {
      setIsDark(settings.darkMode);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(prefersDark);
    }
    setInitialized(true);
  }, [settings.darkMode]);

  /**
   * Apply dark mode class to document
   */
  useEffect(() => {
    if (!initialized) return;

    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark, initialized]);

  /**
   * Toggle dark mode
   */
  const toggle = useCallback(async (): Promise<void> => {
    const newMode = !isDark;
    setIsDark(newMode);
    await updateSettings({ darkMode: newMode });
  }, [isDark, updateSettings]);

  /**
   * Enable dark mode
   */
  const enable = useCallback(async (): Promise<void> => {
    setIsDark(true);
    await updateSettings({ darkMode: true });
  }, [updateSettings]);

  /**
   * Disable dark mode
   */
  const disable = useCallback(async (): Promise<void> => {
    setIsDark(false);
    await updateSettings({ darkMode: false });
  }, [updateSettings]);

  return {
    isDark,
    toggle,
    enable,
    disable,
  };
};
