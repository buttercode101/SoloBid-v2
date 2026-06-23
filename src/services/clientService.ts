import { supabase, fromDbClient, toDbClient } from '../lib/supabase';
import { TABLES } from '../lib/constants';
import type { Client } from '../types';
import { v4 as uuidv4 } from 'uuid';

export async function listClients(userId: string): Promise<Client[]> {
  const { data, error } = await supabase
    .from(TABLES.CLIENTS)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(fromDbClient).filter(Boolean) as Client[];
}

export async function getClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from(TABLES.CLIENTS)
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return fromDbClient(data);
}

export async function saveClient(client: Partial<Client> & { uid: string }): Promise<Client> {
  const isNew = !client.id;
  const id = client.id ?? uuidv4();
  const row = { ...toDbClient({ ...client, id }), user_id: client.uid };

  if (isNew) {
    const { data, error } = await supabase
      .from(TABLES.CLIENTS)
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    return fromDbClient(data) as Client;
  } else {
    const { data, error } = await supabase
      .from(TABLES.CLIENTS)
      .update(row)
      .eq('id', id)
      .eq('user_id', client.uid)
      .select()
      .single();
    if (error) throw error;
    return fromDbClient(data) as Client;
  }
}

export async function deleteClient(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from(TABLES.CLIENTS)
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
