import { supabase, fromDbInvoice, fromDbLineItem } from '../lib/supabase';
import { TABLES } from '../lib/constants';
import type { Invoice, LineItem } from '../types';

export async function listInvoices(userId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from(TABLES.INVOICES)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbInvoice).filter(Boolean) as Invoice[];
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  const { data, error } = await supabase
    .from(TABLES.INVOICES)
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return fromDbInvoice(data);
}

export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await supabase.from(TABLES.INVOICES).delete().eq('id', id);
  if (error) throw error;
}

export async function markInvoicePaid(id: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.INVOICES)
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function getInvoiceLineItems(invoiceId: string): Promise<LineItem[]> {
  const { data, error } = await supabase
    .from(TABLES.LINE_ITEMS)
    .select('*')
    .eq('quote_id', invoiceId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromDbLineItem).filter(Boolean) as LineItem[];
}
