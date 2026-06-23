import type { QuoteStatus, InvoiceStatus } from '../types';

// ── Status values ─────────────────────────────────────────────────────────

export const QUOTE_STATUS: Record<string, QuoteStatus> = {
  DRAFT: 'draft',
  SENT: 'sent',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CONVERTED: 'converted',
} as const;

export const INVOICE_STATUS: Record<string, InvoiceStatus> = {
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  OVERDUE: 'overdue',
} as const;

// ── Table names ────────────────────────────────────────────────────────────

export const TABLES = {
  USERS: 'users',
  QUOTES: 'quotes',
  INVOICES: 'invoices',
  LINE_ITEMS: 'line_items',
  CLIENTS: 'clients',
  TEMPLATES: 'templates',
  EXPENSES: 'expenses',
  ATTACHMENTS: 'attachments',
  RECURRING_INVOICES: 'recurring_invoices',
  RECURRING_QUOTES: 'recurring_quotes',
  CRON_LOGS: 'cron_logs',
  WEBHOOK_LOGS: 'webhook_logs',
} as const;

// ── Currency symbols ───────────────────────────────────────────────────────

export const CURRENCY_SYMBOLS: Record<string, string> = {
  ZAR: 'R',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  NZD: 'NZ$',
  SGD: 'S$',
};

// ── Status badge styles ────────────────────────────────────────────────────

export const STATUS_BADGE: Record<string, string> = {
  sent: 'bg-blue-50 text-blue-700 border border-blue-100',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  converted: 'bg-violet-50 text-violet-700 border border-violet-100',
  draft: 'bg-zinc-100 text-zinc-600 border border-zinc-200',
  paid: 'bg-teal-50 text-teal-700 border border-teal-100',
  overdue: 'bg-red-50 text-red-700 border border-red-100',
  rejected: 'bg-red-50 text-red-700 border border-red-100',
  active: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
  paused: 'bg-zinc-100 text-zinc-600 border border-zinc-200',
};

// ── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULTS = {
  CURRENCY: 'ZAR',
  COUNTRY: 'ZA',
  TAX_RATE: 15,
  MARKUP: 0,
  LABOR_RATE: 0,
  INVOICE_PREFIX: 'INV-',
  QUOTE_PREFIX: 'QTE-',
  PDF_STYLE: 'modern',
  PDF_FONT: 'Helvetica',
} as const;
