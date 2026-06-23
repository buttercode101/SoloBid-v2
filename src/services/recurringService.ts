import { supabase, fromDbRecurring, fromDbRecurringQuote, fromDbLineItem } from '../lib/supabase';
import { TABLES } from '../lib/constants';
import type { RecurringInvoice, RecurringQuote, LineItem } from '../types';

export async function listRecurringInvoices(userId: string): Promise<RecurringInvoice[]> {
  const [{ data: rRows }, { data: liRows }] = await Promise.all([
    supabase.from(TABLES.RECURRING_INVOICES).select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from(TABLES.LINE_ITEMS).select('*').not('recurring_invoice_id', 'is', null),
  ]);

  const liByRecurring: Record<string, LineItem[]> = {};
  for (const li of (liRows ?? [])) {
    const rid = li.recurring_invoice_id;
    if (!liByRecurring[rid]) liByRecurring[rid] = [];
    const mapped = fromDbLineItem(li);
    if (mapped) liByRecurring[rid].push(mapped);
  }

  return (rRows ?? [])
    .map(row => fromDbRecurring(row, liByRecurring[row.id] ?? []))
    .filter(Boolean) as RecurringInvoice[];
}

export async function listRecurringQuotes(userId: string): Promise<RecurringQuote[]> {
  const { data, error } = await supabase
    .from(TABLES.RECURRING_QUOTES)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbRecurringQuote).filter(Boolean) as RecurringQuote[];
}

export async function deleteRecurringInvoice(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.RECURRING_INVOICES)
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteRecurringQuote(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.RECURRING_QUOTES)
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function toggleRecurringInvoiceStatus(
  id: string,
  userId: string,
  currentStatus: string,
): Promise<void> {
  const newStatus = currentStatus === 'active' ? 'paused' : 'active';
  const { error } = await supabase
    .from(TABLES.RECURRING_INVOICES)
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function toggleRecurringQuoteStatus(
  id: string,
  userId: string,
  currentStatus: string,
): Promise<void> {
  const newStatus = currentStatus === 'active' ? 'paused' : 'active';
  const { error } = await supabase
    .from(TABLES.RECURRING_QUOTES)
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
