import { StorageResult, Settings, Invoice } from '../types';
import { STORAGE_KEYS } from '../constants';

// Re-export STORAGE_KEYS for use in other modules
export { STORAGE_KEYS };

/**
 * Generate a random encryption key for localStorage
 */
const generateEncryptionKey = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Get or create encryption key
 */
const getEncryptionKey = (): string => {
  let key = localStorage.getItem(STORAGE_KEYS.ENCRYPTION_KEY);
  if (!key) {
    key = generateEncryptionKey();
    localStorage.setItem(STORAGE_KEYS.ENCRYPTION_KEY, key);
  }
  return key;
};

/**
 * Simple XOR encryption for data obfuscation (not cryptographically secure, but prevents casual inspection)
 * For production, use a proper encryption library like crypto-js
 */
const simpleEncrypt = (text: string, key: string): string => {
  try {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return btoa(unescapeURIComponent(result));
  } catch (error) {
    console.error('Encryption failed:', error);
    return btoa(unescapeURIComponent(text));
  }
};

const simpleDecrypt = (encrypted: string, key: string): string => {
  try {
    const decoded = escapeURIComponent(atob(encrypted));
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (error) {
    console.error('Decryption failed:', error);
    // Fallback: try without decryption
    try {
      return escapeURIComponent(atob(encrypted));
    } catch {
      return encrypted;
    }
  }
};

const escapeURIComponent = (str: string): string => {
  return str.replace(/%/g, '%25').replace(/\+/g, '%2B').replace(/\//g, '%2F');
};

const unescapeURIComponent = (str: string): string => {
  return str.replace(/%25/g, '%').replace(/%2B/g, '+').replace(/%2F/g, '/');
};

/**
 * Storage service with encryption support
 */
export const storageService = {
  /**
   * Get value from storage
   */
  get: async (key: string): Promise<StorageResult | null> => {
    try {
      // Try platform storage first
      const platformStorage = (window as any).storage;
      if (platformStorage?.get) {
        try {
          const result = await platformStorage.get(key);
          if (result?.value) return result;
        } catch {
          // Platform storage failed, continue to localStorage
        }
      }

      // Fallback to localStorage with decryption
      const encryptedValue = localStorage.getItem(key);
      if (encryptedValue) {
        const encryptionKey = getEncryptionKey();
        const decrypted = simpleDecrypt(encryptedValue, encryptionKey);
        return { value: decrypted };
      }

      return null;
    } catch (error) {
      console.error('Storage read error:', error);
      return null;
    }
  },

  /**
   * Set value in storage
   */
  set: async (key: string, value: string): Promise<void> => {
    try {
      // Try platform storage first
      const platformStorage = (window as any).storage;
      if (platformStorage?.set) {
        try {
          await platformStorage.set(key, value);
        } catch {
          // Platform storage failed, continue to localStorage
        }
      }

      // Also save to localStorage with encryption
      const encryptionKey = getEncryptionKey();
      const encrypted = simpleEncrypt(value, encryptionKey);
      localStorage.setItem(key, encrypted);
    } catch (error) {
      console.error('Storage write error:', error);
      // Last resort: save unencrypted
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.error('Fallback storage also failed:', e);
      }
    }
  },

  /**
   * Delete value from storage
   */
  delete: async (key: string): Promise<void> => {
    try {
      const platformStorage = (window as any).storage;
      if (platformStorage?.delete) {
        await platformStorage.delete(key);
      }
    } catch (error) {
      console.error('Storage delete error:', error);
    }
    localStorage.removeItem(key);
  },

  /**
   * Clear all storage
   */
  clear: async (): Promise<void> => {
    try {
      const platformStorage = (window as any).storage;
      if (platformStorage?.clear) {
        await platformStorage.clear();
      } else if (platformStorage?.delete) {
        await Promise.all([
          platformStorage.delete(STORAGE_KEYS.INVOICES),
          platformStorage.delete(STORAGE_KEYS.SETTINGS),
          platformStorage.delete(STORAGE_KEYS.ONBOARDING),
        ]);
      }
    } catch (error) {
      console.error('Platform storage clear failed:', error);
    }
    
    // Clear localStorage
    localStorage.removeItem(STORAGE_KEYS.INVOICES);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.ONBOARDING);
    // Keep encryption key for consistency
  },

  /**
   * Get all keys
   */
  keys: async (): Promise<string[]> => {
    const keys: string[] = [];
    
    // Get platform storage keys if available
    const platformStorage = (window as any).storage;
    if (platformStorage?.keys) {
      try {
        const platformKeys = await platformStorage.keys();
        keys.push(...platformKeys);
      } catch {
        // Ignore
      }
    }

    // Get localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !keys.includes(key)) {
        keys.push(key);
      }
    }

    return keys;
  },

  /**
   * Export all data as JSON
   */
  exportAll: async (): Promise<Record<string, any>> => {
    const data: Record<string, any> = {};
    
    const invoicesResult = await storageService.get(STORAGE_KEYS.INVOICES);
    if (invoicesResult?.value) {
      data.invoices = JSON.parse(invoicesResult.value);
    }

    const settingsResult = await storageService.get(STORAGE_KEYS.SETTINGS);
    if (settingsResult?.value) {
      data.settings = JSON.parse(settingsResult.value);
    }

    const onboardingResult = await storageService.get(STORAGE_KEYS.ONBOARDING);
    if (onboardingResult?.value) {
      data.onboarding = onboardingResult.value;
    }

    return data;
  },

  /**
   * Import data from JSON
   */
  importAll: async (data: Record<string, any>): Promise<void> => {
    if (data.invoices) {
      await storageService.set(STORAGE_KEYS.INVOICES, JSON.stringify(data.invoices));
    }
    if (data.settings) {
      await storageService.set(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
    }
    if (data.onboarding) {
      await storageService.set(STORAGE_KEYS.ONBOARDING, data.onboarding);
    }
  }
};

/**
 * Load invoices from storage
 */
export const loadInvoices = async (): Promise<Invoice[]> => {
  const result = await storageService.get(STORAGE_KEYS.INVOICES);
  if (result?.value) {
    try {
      return JSON.parse(result.value);
    } catch (error) {
      console.error('Failed to parse invoices:', error);
    }
  }
  return [];
};

/**
 * Save invoices to storage
 */
export const saveInvoices = async (invoices: Invoice[]): Promise<void> => {
  await storageService.set(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
};

/**
 * Load settings from storage
 */
export const loadSettings = async (): Promise<Settings> => {
  const result = await storageService.get(STORAGE_KEYS.SETTINGS);
  if (result?.value) {
    try {
      return JSON.parse(result.value);
    } catch (error) {
      console.error('Failed to parse settings:', error);
    }
  }
  // Return default settings
  const { DEFAULT_SETTINGS } = await import('../constants');
  return DEFAULT_SETTINGS;
};

/**
 * Save settings to storage
 */
export const saveSettings = async (settings: Settings): Promise<void> => {
  await storageService.set(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
};

/**
 * Check if onboarding is complete
 */
export const isOnboardingComplete = async (): Promise<boolean> => {
  const result = await storageService.get(STORAGE_KEYS.ONBOARDING);
  return result?.value === 'true';
};

/**
 * Set onboarding complete
 */
export const setOnboardingComplete = async (): Promise<void> => {
  await storageService.set(STORAGE_KEYS.ONBOARDING, 'true');
};
