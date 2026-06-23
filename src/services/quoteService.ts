import { supabase, fromDbQuote, fromDbLineItem, toDbQuote } from '../lib/supabase';
import { TABLES, QUOTE_STATUS } from '../lib/constants';
import type { Quote, LineItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

export async function listQuotes(userId: string): Promise<Quote[]> {
  const { data, error } = await supabase
    .from(TABLES.QUOTES)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbQuote).filter(Boolean) as Quote[];
}

export async function getQuote(id: string): Promise<Quote | null> {
  const { data, error } = await supabase
    .from(TABLES.QUOTES)
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return fromDbQuote(data);
}

export async function getQuoteWithLineItems(id: string): Promise<(Quote & { lineItems: LineItem[] }) | null> {
  const [{ data: qRow }, { data: liRows }] = await Promise.all([
    supabase.from(TABLES.QUOTES).select('*').eq('id', id).single(),
    supabase.from(TABLES.LINE_ITEMS).select('*').eq('quote_id', id).order('sort_order', { ascending: true }),
  ]);
  if (!qRow) return null;
  const quote = fromDbQuote(qRow);
  if (!quote) return null;
  return { ...quote, lineItems: (liRows ?? []).map(fromDbLineItem).filter(Boolean) as LineItem[] };
}

export async function deleteQuote(id: string): Promise<void> {
  const { error } = await supabase.from(TABLES.QUOTES).delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateQuote(quote: Quote, userId: string, quoteCount: number, quotePrefix: string): Promise<Quote> {
  const newId = uuidv4();
  const newNumber = `${quotePrefix}${String(quoteCount + 1).padStart(4, '0')}`;

  const { data: itemRows } = await supabase
    .from(TABLES.LINE_ITEMS)
    .select('*')
    .eq('quote_id', quote.id)
    .order('sort_order', { ascending: true });

  const { error: qErr } = await supabase.from(TABLES.QUOTES).insert({
    ...toDbQuote({ ...quote, uid: userId }),
    id: newId,
    user_id: userId,
    status: QUOTE_STATUS.DRAFT,
    quote_number: newNumber,
    approved_at: null,
    signature_name: null,
    signature_data_url: null,
    rejection_reason: null,
    rejected_at: null,
    pdf_url: null,
  });
  if (qErr) throw qErr;

  if (itemRows?.length) {
    const newItems = itemRows.map((li: any) => ({
      id: uuidv4(),
      quote_id: newId,
      description: li.description,
      qty: li.qty,
      unit_cost: li.unit_cost,
      type: li.type,
      markup_percent: li.markup_percent,
      sort_order: li.sort_order,
    }));
    const { error: liErr } = await supabase.from(TABLES.LINE_ITEMS).insert(newItems);
    if (liErr) throw liErr;
  }

  await supabase
    .from(TABLES.USERS)
    .update({ quote_count: quoteCount + 1 })
    .eq('id', userId);

  return { ...quote, id: newId, status: QUOTE_STATUS.DRAFT, quoteNumber: newNumber };
}

export async function getLineItems(quoteId: string): Promise<LineItem[]> {
  const { data, error } = await supabase
    .from(TABLES.LINE_ITEMS)
    .select('*')
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromDbLineItem).filter(Boolean) as LineItem[];
}
