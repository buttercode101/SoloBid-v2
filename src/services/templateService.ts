import { supabase, fromDbTemplate, fromDbLineItem } from '../lib/supabase';
import { TABLES } from '../lib/constants';
import type { Template, LineItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

export async function listTemplates(userId: string): Promise<Template[]> {
  const [{ data: tRows }, { data: liRows }] = await Promise.all([
    supabase.from(TABLES.TEMPLATES).select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from(TABLES.LINE_ITEMS).select('*').not('template_id', 'is', null),
  ]);

  const liByTemplate: Record<string, LineItem[]> = {};
  for (const li of (liRows ?? [])) {
    const tid = li.template_id;
    if (!liByTemplate[tid]) liByTemplate[tid] = [];
    const mapped = fromDbLineItem(li);
    if (mapped) liByTemplate[tid].push(mapped);
  }

  return (tRows ?? [])
    .map(row => fromDbTemplate(row, liByTemplate[row.id] ?? []))
    .filter(Boolean) as Template[];
}

export async function getTemplateWithItems(id: string): Promise<Template | null> {
  const [{ data: tRow }, { data: liRows }] = await Promise.all([
    supabase.from(TABLES.TEMPLATES).select('*').eq('id', id).single(),
    supabase.from(TABLES.LINE_ITEMS).select('*').eq('template_id', id).order('sort_order', { ascending: true }),
  ]);
  if (!tRow) return null;
  return fromDbTemplate(tRow, (liRows ?? []).map(fromDbLineItem).filter(Boolean) as LineItem[]);
}

export async function saveTemplate(
  userId: string,
  name: string,
  description: string,
  lineItems: Partial<LineItem>[],
  existingId?: string,
): Promise<Template> {
  const id = existingId ?? uuidv4();

  if (existingId) {
    await Promise.all([
      supabase.from(TABLES.TEMPLATES).update({ name, description, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId),
      supabase.from(TABLES.LINE_ITEMS).delete().eq('template_id', id),
    ]);
  } else {
    await supabase.from(TABLES.TEMPLATES).insert({ id, user_id: userId, name, description });
  }

  if (lineItems.length) {
    const rows = lineItems.map((li, i) => ({
      id: uuidv4(),
      template_id: id,
      quote_id: null,
      recurring_invoice_id: null,
      description: li.description ?? '',
      qty: Number(li.qty) || 1,
      unit_cost: Number(li.unitCost) || 0,
      type: li.type ?? 'labor',
      markup_percent: Number(li.markupPercent) || 0,
      sort_order: i,
    }));
    await supabase.from(TABLES.LINE_ITEMS).insert(rows);
  }

  return (await getTemplateWithItems(id)) as Template;
}

export async function deleteTemplate(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.TEMPLATES)
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
