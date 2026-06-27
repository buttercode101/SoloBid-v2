import type { DueTodayActionCategory, DueTodayActionPriority } from './types';

export const DUE_TODAY_SOURCE_APP = 'solobid' as const;

export const DEFAULT_QUOTE_FOLLOW_UP_DAYS = 2;

export interface SoloBidDueTodaySourceMapEntry {
  source_app: typeof DUE_TODAY_SOURCE_APP;
  source_table: 'quotes' | 'invoices' | 'recurring_invoices';
  condition: string;
  category: DueTodayActionCategory;
  priority: DueTodayActionPriority;
  due_date_rule: string;
}

export const SOLOBID_DUE_TODAY_SOURCE_MAP: SoloBidDueTodaySourceMapEntry[] = [
  {
    source_app: DUE_TODAY_SOURCE_APP,
    source_table: 'quotes',
    condition: 'status = sent and follow-up window is due',
    category: 'quote_follow_up',
    priority: 'medium',
    due_date_rule: 'created_at + configured quoteFollowUpDays',
  },
  {
    source_app: DUE_TODAY_SOURCE_APP,
    source_table: 'quotes',
    condition: 'status = viewed',
    category: 'quote_follow_up',
    priority: 'high',
    due_date_rule: 'today',
  },
  {
    source_app: DUE_TODAY_SOURCE_APP,
    source_table: 'quotes',
    condition: 'expires_at before now and status not resolved',
    category: 'quote_follow_up',
    priority: 'high',
    due_date_rule: 'today',
  },
  {
    source_app: DUE_TODAY_SOURCE_APP,
    source_table: 'invoices',
    condition: 'status = sent and due_date <= now',
    category: 'invoice_follow_up',
    priority: 'high',
    due_date_rule: 'due_date or today',
  },
  {
    source_app: DUE_TODAY_SOURCE_APP,
    source_table: 'invoices',
    condition: 'status in overdue/partially_paid',
    category: 'payment_chase',
    priority: 'high',
    due_date_rule: 'due_date or today',
  },
  {
    source_app: DUE_TODAY_SOURCE_APP,
    source_table: 'recurring_invoices',
    condition: 'status = active and next_issue_date <= now',
    category: 'invoice_follow_up',
    priority: 'medium',
    due_date_rule: 'next_issue_date',
  },
];

export function createSoloBidDueTodayExternalKey(input: {
  sourceTable: string;
  sourceId: string;
  category: DueTodayActionCategory;
}) {
  return `${DUE_TODAY_SOURCE_APP}:${input.sourceTable}:${input.sourceId}:${input.category}`;
}

export function isResolvedSoloBidQuoteStatus(status: string | null | undefined) {
  return status === 'approved' || status === 'rejected' || status === 'converted';
}

export function isResolvedSoloBidInvoiceStatus(status: string | null | undefined) {
  return status === 'paid' || status === 'cancelled';
}
