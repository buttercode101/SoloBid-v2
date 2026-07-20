import { InvoiceStatus } from '../types';
import { TIME_CONSTANTS } from '../constants';

/**
 * Safely parse a date string, returning current date for invalid inputs
 */
export const safeDate = (dateStr: string | undefined | null): Date => {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
};

/**
 * Normalize date to start of day (midnight) in local timezone
 */
export const normalizeToStartOfDay = (date: Date): Date => {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

/**
 * Calculate days between two dates
 */
export const daysBetween = (date1: Date, date2: Date): number => {
  const d1 = normalizeToStartOfDay(date1);
  const d2 = normalizeToStartOfDay(date2);
  const diffMs = d2.getTime() - d1.getTime();
  return Math.ceil(diffMs / TIME_CONSTANTS.MS_PER_DAY);
};

/**
 * Get days overdue (positive = overdue, negative = days until due)
 */
export const getDaysOverdue = (dueDate: string): number => {
  if (!dueDate) return 0;
  const today = normalizeToStartOfDay(new Date());
  const due = normalizeToStartOfDay(safeDate(dueDate));
  const diffDays = Math.ceil((today.getTime() - due.getTime()) / TIME_CONSTANTS.MS_PER_DAY);
  return diffDays > 0 ? diffDays : 0;
};

/**
 * Get days until due (negative = overdue, positive = days remaining)
 */
export const getDaysUntilDue = (dueDate: string): number => {
  if (!dueDate) return 0;
  const today = normalizeToStartOfDay(new Date());
  const due = normalizeToStartOfDay(safeDate(dueDate));
  return Math.ceil((due.getTime() - today.getTime()) / TIME_CONSTANTS.MS_PER_DAY);
};

/**
 * Format date for display (South African locale)
 */
export const formatDate = (dateStr: string, options?: Intl.DateTimeFormatOptions): string => {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  };
  return safeDate(dateStr).toLocaleDateString('en-ZA', options || defaultOptions);
};

/**
 * Format date with full details
 */
export const formatDateFull = (dateStr: string): string => {
  return safeDate(dateStr).toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

/**
 * Format time for display
 */
export const formatTime = (dateStr: string): string => {
  return safeDate(dateStr).toLocaleTimeString('en-ZA', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Check if date is today
 */
export const isToday = (dateStr: string): boolean => {
  const today = normalizeToStartOfDay(new Date());
  const date = normalizeToStartOfDay(safeDate(dateStr));
  return today.getTime() === date.getTime();
};

/**
 * Check if date is in the past
 */
export const isPast = (dateStr: string): boolean => {
  const today = normalizeToStartOfDay(new Date());
  const date = normalizeToStartOfDay(safeDate(dateStr));
  return date.getTime() < today.getTime();
};

/**
 * Check if date is in the future
 */
export const isFuture = (dateStr: string): boolean => {
  const today = normalizeToStartOfDay(new Date());
  const date = normalizeToStartOfDay(safeDate(dateStr));
  return date.getTime() > today.getTime();
};

/**
 * Get relative time description
 */
export const getRelativeTimeDescription = (dateStr: string): string => {
  const days = getDaysUntilDue(dateStr);
  
  if (days < 0) {
    return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  } else if (days === 0) {
    return 'Due today';
  } else if (days === 1) {
    return 'Due tomorrow';
  } else if (days <= 7) {
    return `Due in ${days} days`;
  } else {
    return formatDate(dateStr);
  }
};

/**
 * Validate date string format
 */
export const isValidDate = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const date = safeDate(dateStr);
  return !isNaN(date.getTime());
};

/**
 * Get date range for filtering (this month, last month, etc.)
 */
export const getDateRange = (range: 'thisMonth' | 'lastMonth' | 'thisYear' | 'all'): { start: Date; end: Date } => {
  const now = new Date();
  const start = new Date();
  const end = new Date();

  switch (range) {
    case 'thisMonth':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'lastMonth':
      start.setMonth(now.getMonth() - 1);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(now.getMonth());
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'thisYear':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'all':
    default:
      start.setFullYear(2000, 0, 1);
      start.setHours(0, 0, 0, 0);
      break;
  }

  return { start, end };
};

/**
 * Get invoice status based on due date
 */
export const getInvoiceStatus = (dueDate: string): InvoiceStatus => {
  if (!dueDate) return 'upcoming';
  const today = normalizeToStartOfDay(new Date());
  const due = normalizeToStartOfDay(safeDate(dueDate));
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / TIME_CONSTANTS.MS_PER_DAY);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'pending';
  return 'upcoming';
};
