import type { LineItem } from '../types';
import { CURRENCY_SYMBOLS } from './constants';
import { formatZAR } from './theme';

// ── Line item calculations ─────────────────────────────────────────────────

/** Numeric value from a field that might be a string during editing */
function num(v: number | string | undefined): number {
  if (v === undefined || v === '') return 0;
  return typeof v === 'number' ? v : parseFloat(v) || 0;
}

/** Total for a single line item (material adds markup, labor does not) */
export function calculateLineTotal(item: Pick<LineItem, 'qty' | 'unitCost' | 'type' | 'markupPercent'>): number {
  const qty = num(item.qty);
  const cost = num(item.unitCost);
  const markup = num(item.markupPercent);
  if (item.type === 'material') {
    return qty * cost * (1 + markup / 100);
  }
  return qty * cost;
}

/** Subtotal from all line items (before tax) */
export function calculateSubtotal(lineItems: Pick<LineItem, 'qty' | 'unitCost' | 'type' | 'markupPercent'>[]): number {
  return lineItems.reduce((sum, item) => sum + calculateLineTotal(item), 0);
}

/** Tax amount from a subtotal and rate (percent) */
export function calculateTax(subtotal: number, taxRate: number): number {
  return subtotal * (taxRate / 100);
}

/** Full quote/invoice totals */
export function calculateTotals(
  lineItems: Pick<LineItem, 'qty' | 'unitCost' | 'type' | 'markupPercent'>[],
  taxRate: number,
  extraExpenses = 0,
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = calculateSubtotal(lineItems) + extraExpenses;
  const taxAmount = calculateTax(subtotal, taxRate);
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}

// ── Numeric input sanitization ─────────────────────────────────────────────

/** Allows empty string or valid positive decimals; strips leading zeros */
export function sanitizeNumericInput(val: string): string {
  if (val === '') return '';
  if (!/^\d*\.?\d*$/.test(val)) return '';
  if (/^0\d+/.test(val)) return val.replace(/^0+/, '');
  if (/^0+$/.test(val)) return '0';
  return val;
}

// ── Currency formatting ────────────────────────────────────────────────────

/** Returns the symbol for a given currency code, defaulting to '$' */
export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? '$';
}

/** Formats an amount in the given currency */
export function formatCurrency(amount: number | null | undefined, currency: string): string {
  const value = amount ?? 0;
  if (currency === 'ZAR') return formatZAR(value);
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
