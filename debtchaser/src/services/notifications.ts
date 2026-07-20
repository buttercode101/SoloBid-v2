import { Invoice } from '../types';
import { getDaysOverdue, isToday, safeDate, normalizeToStartOfDay } from '../utils';

export interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

/**
 * Get current notification permission status
 */
export const getNotificationPermission = (): NotificationPermission => {
  if (typeof Notification === 'undefined') {
    return { granted: false, denied: false, default: false };
  }

  return {
    granted: Notification.permission === 'granted',
    denied: Notification.permission === 'denied',
    default: Notification.permission === 'default',
  };
};

/**
 * Request notification permission
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (typeof Notification === 'undefined') {
    console.warn('Notifications not supported in this browser');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return false;
  }
};

/**
 * Check if notifications are supported and enabled
 */
export const areNotificationsEnabled = (): boolean => {
  if (typeof Notification === 'undefined') {
    return false;
  }
  return Notification.permission === 'granted';
};

/**
 * Send browser notification
 */
export const sendNotification = async (
  title: string,
  options?: NotificationOptions
): Promise<boolean> => {
  if (!areNotificationsEnabled()) {
    return false;
  }

  try {
    const defaultOptions: NotificationOptions = {
      icon: 'https://cdn-icons-png.flaticon.com/512/2522/2522103.png',
      badge: 'https://cdn-icons-png.flaticon.com/512/2522/2522103.png',
      ...options,
    };

    new Notification(title, defaultOptions);
    return true;
  } catch (error) {
    console.error('Failed to send notification:', error);
    return false;
  }
};

/**
 * Get invoices that need attention
 */
export const getUrgentInvoices = (invoices: Invoice[]): {
  overdue: Invoice[];
  dueToday: Invoice[];
  upcoming: Invoice[];
} => {
  const today = normalizeToStartOfDay(new Date());

  const overdue: Invoice[] = [];
  const dueToday: Invoice[] = [];
  const upcoming: Invoice[] = [];

  for (const invoice of invoices) {
    if (invoice.status === 'paid') continue;

    const dueDate = normalizeToStartOfDay(safeDate(invoice.dueDate));
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      overdue.push(invoice);
    } else if (diffDays === 0) {
      dueToday.push(invoice);
    } else if (diffDays <= 2) {
      upcoming.push(invoice);
    }
  }

  return { overdue, dueToday, upcoming };
};

/**
 * Check and send notifications for urgent invoices
 */
export const checkAndNotifyUrgentInvoices = async (
  invoices: Invoice[]
): Promise<{ notified: boolean; count: number }> => {
  if (!areNotificationsEnabled()) {
    return { notified: false, count: 0 };
  }

  const { overdue, dueToday } = getUrgentInvoices(invoices);
  const totalUrgent = overdue.length + dueToday.length;

  if (totalUrgent === 0) {
    return { notified: false, count: 0 };
  }

  let body = '';
  if (overdue.length > 0) {
    body += `${overdue.length} invoice${overdue.length > 1 ? 's' : ''} overdue. `;
  }
  if (dueToday.length > 0) {
    body += `${dueToday.length} invoice${dueToday.length > 1 ? '' : ''} due today.`;
  }

  const notified = await sendNotification('Payment Alert', {
    body,
    tag: 'debtchaser-urgent',
    requireInteraction: true,
  });

  return { notified, count: totalUrgent };
};

/**
 * Send payment received notification
 */
export const sendPaymentReceivedNotification = async (
  clientName: string,
  amount: string
): Promise<boolean> => {
  return sendNotification('Payment Received! 💰', {
    body: `${clientName} paid ${amount}`,
    tag: 'debtchaser-payment',
    icon: 'https://cdn-icons-png.flaticon.com/512/2522/2522103.png',
  });
};

/**
 * Send reminder sent notification
 */
export const sendReminderSentNotification = async (
  clientName: string
): Promise<boolean> => {
  return sendNotification('Reminder Sent', {
    body: `Payment reminder sent to ${clientName}`,
    tag: 'debtchaser-reminder',
    silent: true,
  });
};

/**
 * Create notification summary
 */
export const getNotificationSummary = (invoices: Invoice[]): string => {
  const { overdue, dueToday, upcoming } = getUrgentInvoices(invoices);
  
  const parts: string[] = [];
  if (overdue.length > 0) {
    parts.push(`${overdue.length} overdue`);
  }
  if (dueToday.length > 0) {
    parts.push(`${dueToday.length} due today`);
  }
  if (upcoming.length > 0) {
    parts.push(`${upcoming.length} coming up`);
  }

  if (parts.length === 0) {
    return 'All caught up!';
  }

  return parts.join(', ');
};

/**
 * Setup periodic notification checks
 */
export const setupNotificationChecker = (
  invoices: Invoice[],
  intervalMs: number = 60000
): (() => void) => {
  // Check immediately
  checkAndNotifyUrgentInvoices(invoices);

  // Set up interval
  const intervalId = setInterval(() => {
    checkAndNotifyUrgentInvoices(invoices);
  }, intervalMs);

  // Return cleanup function
  return () => clearInterval(intervalId);
};
