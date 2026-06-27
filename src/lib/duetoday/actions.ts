import { addDays, isAfter, isBefore, isSameDay, parseISO } from 'date-fns';
import type { Invoice, Quote, RecurringInvoice } from '../../types';
import { fromDbInvoice, fromDbQuote, fromDbRecurring, supabase } from '../supabase';
import type { DueTodayAction, DueTodayActionCategory, DueTodayActionPriority, SoloBidDueTodayActionContext } from './types';
import {
  DEFAULT_QUOTE_FOLLOW_UP_DAYS,
  DUE_TODAY_SOURCE_APP as SOURCE_APP,
  createSoloBidDueTodayExternalKey,
  isResolvedSoloBidInvoiceStatus,
  isResolvedSoloBidQuoteStatus,
} from './contract';

function nowIso(now: Date) {
  return now.toISOString();
}

function safeDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dueDateOrToday(value: string | undefined | null, now: Date) {
  const date = safeDate(value);
  return date ? date.toISOString() : now.toISOString();
}

function buildSourceUrl(baseUrl: string | undefined, path: string) {
  if (!baseUrl) return null;
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

function makeAction(input: {
  sourceTable: string;
  sourceId: string;
  ownerId: string;
  organizationId?: string | null;
  title: string;
  description?: string | null;
  category: DueTodayActionCategory;
  priority: DueTodayActionPriority;
  dueDate: string;
  moneyValue?: number | null;
  currency?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  sourceUrl?: string | null;
  metadata?: Record<string, unknown>;
  now: Date;
}): DueTodayAction {
  const externalKey = createSoloBidDueTodayExternalKey({
    sourceTable: input.sourceTable,
    sourceId: input.sourceId,
    category: input.category,
  });
  const timestamp = nowIso(input.now);

  return {
    id: externalKey,
    external_key: externalKey,
    source_app: SOURCE_APP,
    source_table: input.sourceTable,
    source_id: input.sourceId,
    owner_id: input.ownerId,
    organization_id: input.organizationId ?? null,
    title: input.title,
    description: input.description ?? null,
    category: input.category,
    priority: input.priority,
    status: 'open',
    due_date: input.dueDate,
    money_value: input.moneyValue ?? null,
    currency: input.currency ?? null,
    contact_name: input.contactName ?? null,
    contact_phone: input.contactPhone ?? null,
    contact_email: input.contactEmail ?? null,
    source_url: input.sourceUrl ?? null,
    metadata: input.metadata ?? {},
    created_at: timestamp,
    updated_at: timestamp,
    completed_at: null,
  };
}

function quoteAction(quote: Quote, context: Required<Pick<SoloBidDueTodayActionContext, 'userId'>> & SoloBidDueTodayActionContext): DueTodayAction | null {
  const now = context.now ?? new Date();
  const status = quote.status;
  const expiresAt = safeDate(quote.expiresAt);
  const createdAt = safeDate(quote.createdAt) ?? now;
  const followUpDue = expiresAt ?? addDays(createdAt, context.quoteFollowUpDays ?? DEFAULT_QUOTE_FOLLOW_UP_DAYS);

  if (isResolvedSoloBidQuoteStatus(status)) return null;
  if (!['sent', 'viewed', 'expired'].includes(status) && !(expiresAt && isBefore(expiresAt, now))) return null;

  const isExpired = status === 'expired' || Boolean(expiresAt && isBefore(expiresAt, now));
  const isViewed = status === 'viewed';
  const priority: DueTodayActionPriority = isExpired || isViewed ? 'high' : 'medium';
  const dueDate = isExpired || isViewed || isSameDay(followUpDue, now) || isBefore(followUpDue, now)
    ? now.toISOString()
    : followUpDue.toISOString();

  return makeAction({
    sourceTable: 'quotes',
    sourceId: quote.id,
    ownerId: context.userId,
    organizationId: context.organizationId,
    title: isExpired
      ? `Follow up expired quote for ${quote.clientName || 'client'}`
      : `Follow up quote for ${quote.clientName || 'client'}`,
    description: quote.quoteNumber ? `Quote ${quote.quoteNumber}` : null,
    category: 'quote_follow_up',
    priority,
    dueDate,
    moneyValue: quote.total ?? null,
    currency: quote.currency ?? 'ZAR',
    contactName: quote.clientName || null,
    contactPhone: quote.clientPhone || null,
    contactEmail: quote.clientEmail || null,
    sourceUrl: buildSourceUrl(context.baseUrl, `/quotes/${quote.id}`),
    metadata: {
      status,
      quote_number: quote.quoteNumber ?? null,
      expires_at: quote.expiresAt ?? null,
    },
    now,
  });
}

function approvedQuoteInvoiceAction(
  quote: Quote,
  invoicedQuoteIds: Set<string>,
  context: Required<Pick<SoloBidDueTodayActionContext, 'userId'>> & SoloBidDueTodayActionContext,
): DueTodayAction | null {
  const now = context.now ?? new Date();
  if (quote.status !== 'approved') return null;
  if (invoicedQuoteIds.has(quote.id)) return null;

  return makeAction({
    sourceTable: 'quotes',
    sourceId: quote.id,
    ownerId: context.userId,
    organizationId: context.organizationId,
    title: `Generate invoice for ${quote.clientName || 'client'}`,
    description: quote.quoteNumber ? `Approved quote ${quote.quoteNumber}` : 'Approved quote not invoiced yet',
    category: 'invoice_follow_up',
    priority: 'high',
    dueDate: dueDateOrToday(quote.approvedAt || quote.updatedAt || quote.createdAt, now),
    moneyValue: quote.total ?? null,
    currency: quote.currency ?? 'ZAR',
    contactName: quote.clientName || null,
    contactPhone: quote.clientPhone || null,
    contactEmail: quote.clientEmail || null,
    sourceUrl: buildSourceUrl(context.baseUrl, '/invoices'),
    metadata: {
      status: quote.status,
      quote_number: quote.quoteNumber ?? null,
      quote_id: quote.id,
      approved_at: quote.approvedAt ?? null,
      invoice_copilot_lane: 'approved_quote_not_invoiced',
    },
    now,
  });
}

function invoiceAction(invoice: Invoice, context: Required<Pick<SoloBidDueTodayActionContext, 'userId'>> & SoloBidDueTodayActionContext): DueTodayAction | null {
  const now = context.now ?? new Date();
  const status = invoice.status;
  const dueDate = safeDate(invoice.dueDate);

  if (isResolvedSoloBidInvoiceStatus(status)) return null;
  if (status === 'sent' && dueDate && isAfter(dueDate, now)) return null;
  if (!['draft', 'sent', 'overdue', 'partially_paid'].includes(status)) return null;

  const category: DueTodayActionCategory = status === 'overdue' || status === 'partially_paid'
    ? 'payment_chase'
    : 'invoice_follow_up';
  const priority: DueTodayActionPriority = status === 'overdue' ? 'high' : status === 'partially_paid' ? 'medium' : status === 'sent' ? 'high' : 'medium';

  return makeAction({
    sourceTable: 'invoices',
    sourceId: invoice.id,
    ownerId: context.userId,
    organizationId: context.organizationId,
    title: status === 'draft'
      ? `Send invoice to ${invoice.clientName || 'client'}`
      : status === 'partially_paid'
        ? `Chase remaining payment from ${invoice.clientName || 'client'}`
        : `Follow up invoice for ${invoice.clientName || 'client'}`,
    description: invoice.invoiceNumber ? `Invoice ${invoice.invoiceNumber}` : null,
    category,
    priority,
    dueDate: dueDateOrToday(invoice.dueDate || invoice.createdAt, now),
    moneyValue: invoice.total ?? null,
    currency: invoice.currency ?? 'ZAR',
    contactName: invoice.clientName || null,
    contactPhone: invoice.clientPhone || null,
    contactEmail: invoice.clientEmail || null,
    sourceUrl: buildSourceUrl(context.baseUrl, '/invoices'),
    metadata: {
      status,
      invoice_number: invoice.invoiceNumber ?? null,
      due_date: invoice.dueDate ?? null,
      quote_id: invoice.quoteId ?? invoice.estimateId ?? null,
      invoice_copilot_lane: status === 'draft' ? 'draft_invoice_not_sent' : status === 'sent' ? 'sent_invoice_due' : status,
    },
    now,
  });
}

function recurringInvoiceAction(recurring: RecurringInvoice, context: Required<Pick<SoloBidDueTodayActionContext, 'userId'>> & SoloBidDueTodayActionContext): DueTodayAction | null {
  const now = context.now ?? new Date();
  const nextIssueDate = safeDate(recurring.nextIssueDate);

  if (recurring.status !== 'active' || !nextIssueDate || isAfter(nextIssueDate, now)) return null;

  return makeAction({
    sourceTable: 'recurring_invoices',
    sourceId: recurring.id,
    ownerId: context.userId,
    organizationId: context.organizationId,
    title: `Issue recurring invoice for ${recurring.clientName || 'client'}`,
    description: `Recurring ${recurring.frequency} invoice`,
    category: 'invoice_follow_up',
    priority: 'medium',
    dueDate: nextIssueDate.toISOString(),
    moneyValue: recurring.total ?? null,
    currency: recurring.currency ?? 'ZAR',
    contactName: recurring.clientName || null,
    contactEmail: recurring.clientEmail || null,
    sourceUrl: buildSourceUrl(context.baseUrl, '/recurring'),
    metadata: {
      status: recurring.status,
      frequency: recurring.frequency,
      next_issue_date: recurring.nextIssueDate ?? null,
      invoice_copilot_lane: 'recurring_invoice_due',
    },
    now,
  });
}

export async function getSoloBidDueTodayActions(context: SoloBidDueTodayActionContext): Promise<DueTodayAction[]> {
  const now = context.now ?? new Date();
  const [{ data: quoteRows, error: quoteError }, { data: invoiceRows, error: invoiceError }, { data: recurringRows, error: recurringError }] = await Promise.all([
    supabase
      .from('quotes')
      .select('*')
      .eq('user_id', context.userId)
      .in('status', ['sent', 'viewed', 'expired', 'approved'])
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('invoices')
      .select('*')
      .eq('user_id', context.userId)
      .in('status', ['draft', 'sent', 'overdue', 'partially_paid'])
      .order('due_date', { ascending: true })
      .limit(100),
    supabase
      .from('recurring_invoices')
      .select('*')
      .eq('user_id', context.userId)
      .eq('status', 'active')
      .order('next_issue_date', { ascending: true })
      .limit(50),
  ]);

  if (quoteError) throw quoteError;
  if (invoiceError) throw invoiceError;
  if (recurringError) throw recurringError;

  const invoicesList = (invoiceRows ?? []).map(fromDbInvoice).filter(Boolean) as Invoice[];
  const invoicedQuoteIds = new Set(
    invoicesList.flatMap((invoice) => [invoice.quoteId, invoice.estimateId]).filter((id): id is string => Boolean(id)),
  );

  const quotes = ((quoteRows ?? []).map(fromDbQuote).filter(Boolean) as Quote[]).flatMap((quote) => [
    quoteAction(quote, { ...context, userId: context.userId, now }),
    approvedQuoteInvoiceAction(quote, invoicedQuoteIds, { ...context, userId: context.userId, now }),
  ]).filter(Boolean) as DueTodayAction[];

  const invoices = invoicesList
    .map((invoice) => invoiceAction(invoice, { ...context, userId: context.userId, now }))
    .filter(Boolean) as DueTodayAction[];

  const recurringInvoices = ((recurringRows ?? []).map((row) => fromDbRecurring(row)).filter(Boolean) as RecurringInvoice[])
    .map((recurring) => recurringInvoiceAction(recurring, { ...context, userId: context.userId, now }))
    .filter(Boolean) as DueTodayAction[];

  return [...quotes, ...invoices, ...recurringInvoices].sort((a, b) => a.due_date.localeCompare(b.due_date));
}
