import { Invoice, ReminderType } from '../types';
import { MESSAGE_TEMPLATES } from '../constants';
import { getDaysOverdue, safeDate } from './date';

/**
 * Get reminder type based on due date
 */
export const getReminderType = (dueDate: string): ReminderType => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = safeDate(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays > 0) return 'courtesy';
  if (diffDays === 0) return 'action';
  if (diffDays >= -7) return 'inquiry';
  if (diffDays >= -14) return 'firm';
  return 'final';
};

/**
 * Format message template with invoice data
 */
export const formatMessage = (invoice: Invoice, currency: string): string => {
  if (!invoice) return '';
  
  const type = getReminderType(invoice.dueDate);
  const template = MESSAGE_TEMPLATES[type].example;
  const days = getDaysOverdue(invoice.dueDate);
  const weekday = safeDate(invoice.dueDate).toLocaleDateString('en-ZA', { weekday: 'long' });
  const date = safeDate(invoice.dueDate).toLocaleDateString('en-ZA');

  return template
    .replace('{name}', (invoice.clientName || '').split(' ')[0] || 'Valued Client')
    .replace('{number}', invoice.invoiceNumber || `${invoice.id}`)
    .replace('{amount}', (invoice.amount || 0).toLocaleString())
    .replace('{currency}', currency)
    .replace('{date}', date)
    .replace('{days}', days.toString())
    .replace('{weekday}', weekday)
    .replace('{reminder_count}', (invoice.remindersSent + 1).toString());
};

/**
 * Get message preview (first 50 chars)
 */
export const getMessagePreview = (message: string, maxLength: number = 50): string => {
  if (message.length <= maxLength) return message;
  return message.substring(0, maxLength) + '...';
};

/**
 * Get template info
 */
export const getTemplateInfo = (type: ReminderType) => {
  return MESSAGE_TEMPLATES[type];
};

/**
 * Get all available templates
 */
export const getAllTemplates = () => {
  return Object.entries(MESSAGE_TEMPLATES).map(([key, value]) => ({
    key: key as ReminderType,
    ...value
  }));
};
