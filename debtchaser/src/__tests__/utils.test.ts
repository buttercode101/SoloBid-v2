import { describe, it, expect } from 'vitest';
import { safeDate, normalizeToStartOfDay, daysBetween, getDaysOverdue, formatDate } from '../utils/date';

describe('Date Utilities', () => {
  describe('safeDate', () => {
    it('should return current date for undefined input', () => {
      const result = safeDate(undefined);
      expect(result).toBeInstanceOf(Date);
    });

    it('should return current date for null input', () => {
      const result = safeDate(null);
      expect(result).toBeInstanceOf(Date);
    });

    it('should return current date for invalid date string', () => {
      const result = safeDate('invalid-date');
      expect(result).toBeInstanceOf(Date);
    });

    it('should parse valid date string correctly', () => {
      const result = safeDate('2024-01-15');
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15);
    });
  });

  describe('normalizeToStartOfDay', () => {
    it('should set hours to midnight', () => {
      const date = new Date(2024, 0, 15, 14, 30, 45);
      const result = normalizeToStartOfDay(date);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
    });
  });

  describe('getDaysOverdue', () => {
    it('should return 0 for future due date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const result = getDaysOverdue(futureDate.toISOString());
      expect(result).toBe(0);
    });

    it('should return positive number for past due date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      const result = getDaysOverdue(pastDate.toISOString());
      expect(result).toBeGreaterThanOrEqual(5);
    });

    it('should return 0 for empty string', () => {
      const result = getDaysOverdue('');
      expect(result).toBe(0);
    });
  });

  describe('formatDate', () => {
    it('should format date in South African locale', () => {
      const result = formatDate('2024-01-15');
      expect(result).toContain('2024');
    });
  });
});
