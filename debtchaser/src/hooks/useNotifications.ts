import { useCallback, useEffect } from 'react';
import { Invoice } from '../types';
import {
  areNotificationsEnabled,
  requestNotificationPermission,
  checkAndNotifyUrgentInvoices,
  setupNotificationChecker,
} from '../services/notifications';

export interface UseNotificationsReturn {
  isEnabled: boolean;
  isSupported: boolean;
  requestPermission: () => Promise<boolean>;
  checkUrgent: () => Promise<{ notified: boolean; count: number }>;
}

export const useNotifications = (invoices: Invoice[]): UseNotificationsReturn => {
  const isEnabled = areNotificationsEnabled();
  const isSupported = typeof Notification !== 'undefined';

  /**
   * Request notification permission
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn('Notifications not supported');
      return false;
    }
    return await requestNotificationPermission();
  }, [isSupported]);

  /**
   * Check and notify for urgent invoices
   */
  const checkUrgent = useCallback(async (): Promise<{ notified: boolean; count: number }> => {
    if (!isEnabled) {
      return { notified: false, count: 0 };
    }
    return await checkAndNotifyUrgentInvoices(invoices);
  }, [invoices, isEnabled]);

  // Setup periodic checker when notifications are enabled
  useEffect(() => {
    if (!isEnabled || invoices.length === 0) {
      return;
    }

    // Check immediately
    checkUrgent();

    // Setup periodic checks (every minute)
    const cleanup = setupNotificationChecker(invoices, 60000);

    return cleanup;
  }, [invoices, isEnabled, checkUrgent]);

  return {
    isEnabled,
    isSupported,
    requestPermission,
    checkUrgent,
  };
};
