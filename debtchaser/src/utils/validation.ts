import { InvoiceFormData, ValidationResult, Invoice } from '../types';
import { VALIDATION_RULES } from '../constants';
import { isValidDate } from './date';
import { isValidAmount } from './currency';

/**
 * Validate invoice form data
 */
export const validateInvoiceForm = (data: InvoiceFormData): ValidationResult => {
  const errors: string[] = [];

  // Client name validation
  if (!data.clientName || data.clientName.trim().length === 0) {
    errors.push('Client name is required');
  } else if (data.clientName.length < VALIDATION_RULES.MIN_CLIENT_NAME_LENGTH) {
    errors.push(`Client name must be at least ${VALIDATION_RULES.MIN_CLIENT_NAME_LENGTH} characters`);
  } else if (data.clientName.length > VALIDATION_RULES.MAX_CLIENT_NAME_LENGTH) {
    errors.push(`Client name must be less than ${VALIDATION_RULES.MAX_CLIENT_NAME_LENGTH} characters`);
  }

  // Amount validation
  const amount = parseFloat(data.amount);
  if (!data.amount || data.amount.trim() === '') {
    errors.push('Amount is required');
  } else if (!isValidAmount(amount, VALIDATION_RULES.MIN_AMOUNT, VALIDATION_RULES.MAX_AMOUNT)) {
    errors.push(`Amount must be between ${VALIDATION_RULES.MIN_AMOUNT} and ${VALIDATION_RULES.MAX_AMOUNT}`);
  }

  // Due date validation
  if (!data.dueDate) {
    errors.push('Due date is required');
  } else if (!isValidDate(data.dueDate)) {
    errors.push('Invalid due date format');
  }

  // Phone validation (optional but validate if provided)
  if (data.clientPhone && data.clientPhone.length > VALIDATION_RULES.MAX_PHONE_LENGTH) {
    errors.push(`Phone number must be less than ${VALIDATION_RULES.MAX_PHONE_LENGTH} characters`);
  }

  // Invoice number validation (optional but validate if provided)
  if (data.invoiceNumber && data.invoiceNumber.length > 50) {
    errors.push('Invoice number must be less than 50 characters');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate invoice object
 */
export const validateInvoice = (invoice: Partial<Invoice>): ValidationResult => {
  const errors: string[] = [];

  if (!invoice.clientName || invoice.clientName.trim().length === 0) {
    errors.push('Client name is required');
  }

  if (invoice.amount === undefined || invoice.amount === null) {
    errors.push('Amount is required');
  } else if (!isValidAmount(invoice.amount, VALIDATION_RULES.MIN_AMOUNT, VALIDATION_RULES.MAX_AMOUNT)) {
    errors.push(`Invalid amount: must be between ${VALIDATION_RULES.MIN_AMOUNT} and ${VALIDATION_RULES.MAX_AMOUNT}`);
  }

  if (!invoice.dueDate) {
    errors.push('Due date is required');
  } else if (!isValidDate(invoice.dueDate)) {
    errors.push('Invalid due date');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Sanitize string input to prevent XSS
 */
export const sanitizeString = (input: string): string => {
  if (!input) return '';
  
  // Escape HTML special characters without using DOM
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Escape HTML special characters
 */
export const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

/**
 * Validate phone number format (basic validation)
 */
export const isValidPhone = (phone: string): boolean => {
  if (!phone) return true; // Phone is optional
  // Remove common separators and check if remaining chars are digits or +
  const cleaned = phone.replace(/[\s\-().]/g, '');
  return /^[\d+]{8,20}$/.test(cleaned);
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  if (!email) return true; // Email is optional
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Get validation error message for field
 */
export const getFieldError = (field: string, value: string | number): string | null => {
  switch (field) {
    case 'clientName':
      if (typeof value === 'string') {
        if (value.length < VALIDATION_RULES.MIN_CLIENT_NAME_LENGTH) {
          return `Minimum ${VALIDATION_RULES.MIN_CLIENT_NAME_LENGTH} characters required`;
        }
        if (value.length > VALIDATION_RULES.MAX_CLIENT_NAME_LENGTH) {
          return `Maximum ${VALIDATION_RULES.MAX_CLIENT_NAME_LENGTH} characters allowed`;
        }
      }
      break;
    case 'amount':
      const amount = typeof value === 'number' ? value : parseFloat(value as string);
      if (isNaN(amount)) return 'Must be a valid number';
      if (amount < VALIDATION_RULES.MIN_AMOUNT) return `Minimum amount is ${VALIDATION_RULES.MIN_AMOUNT}`;
      if (amount > VALIDATION_RULES.MAX_AMOUNT) return `Maximum amount is ${VALIDATION_RULES.MAX_AMOUNT}`;
      break;
    case 'clientPhone':
      if (typeof value === 'string' && value && !isValidPhone(value)) {
        return 'Invalid phone number format';
      }
      break;
    case 'businessEmail':
      if (typeof value === 'string' && value && !isValidEmail(value)) {
        return 'Invalid email format';
      }
      break;
  }
  return null;
};
