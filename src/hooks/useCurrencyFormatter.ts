import { useCallback } from 'react';
import { formatCurrency } from '../lib/calculations';

/**
 * Returns a memoized formatter for the given currency code.
 * Replaces the duplicate inline formatCurrency functions in Dashboard,
 * Invoices, QuoteBuilder, and Reports.
 */
export function useCurrencyFormatter(currency: string) {
  return useCallback(
    (amount: number | null | undefined) => formatCurrency(amount ?? 0, currency),
    [currency],
  );
}
