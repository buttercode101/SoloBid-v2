import { describe, it, expect } from 'vitest';
import { validateInvoiceForm, sanitizeString, isValidPhone, isValidEmail } from '../utils/validation';

describe('Validation Utilities', () => {
  describe('validateInvoiceForm', () => {
    it('should return valid for complete form data', () => {
      const data = {
        clientName: 'Test Client',
        amount: '1000.00',
        dueDate: '2024-12-31',
        clientPhone: '+27123456789',
        invoiceNumber: 'INV-001',
      };
      const result = validateInvoiceForm(data);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return invalid for missing client name', () => {
      const data = {
        clientName: '',
        amount: '1000.00',
        dueDate: '2024-12-31',
        clientPhone: '',
        invoiceNumber: '',
      };
      const result = validateInvoiceForm(data);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return invalid for invalid amount', () => {
      const data = {
        clientName: 'Test Client',
        amount: '-100',
        dueDate: '2024-12-31',
        clientPhone: '',
        invoiceNumber: '',
      };
      const result = validateInvoiceForm(data);
      expect(result.valid).toBe(false);
    });

    it('should return invalid for missing due date', () => {
      const data = {
        clientName: 'Test Client',
        amount: '1000.00',
        dueDate: '',
        clientPhone: '',
        invoiceNumber: '',
      };
      const result = validateInvoiceForm(data);
      expect(result.valid).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    it('should escape HTML special characters', () => {
      const result = sanitizeString('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
    });

    it('should return empty string for empty input', () => {
      const result = sanitizeString('');
      expect(result).toBe('');
    });
  });

  describe('isValidPhone', () => {
    it('should return true for valid South African phone number', () => {
      expect(isValidPhone('+27123456789')).toBe(true);
      expect(isValidPhone('0123456789')).toBe(true);
    });

    it('should return true for empty phone (optional field)', () => {
      expect(isValidPhone('')).toBe(true);
    });

    it('should return false for invalid phone number', () => {
      expect(isValidPhone('123')).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    it('should return true for valid email', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
    });

    it('should return true for empty email (optional field)', () => {
      expect(isValidEmail('')).toBe(true);
    });

    it('should return false for invalid email', () => {
      expect(isValidEmail('invalid-email')).toBe(false);
    });
  });
});
