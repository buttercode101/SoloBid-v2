import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface SoloBidDB extends DBSchema {
  'quote-drafts': {
    key: string; // `${uid}:${quoteId}`
    value: {
      quoteId: string;
      uid: string;
      quoteData: Record<string, any>;
      lineItems: Record<string, any>[];
      expenses: Record<string, any>[];
      savedAt: string;
      status: 'draft' | 'sent';
    };
  };
  'pending-sync': {
    key: string;
    value: {
      id: string;
      type: 'quote-upsert';
      payload: Record<string, any>;
      createdAt: string;
    };
  };
  'client-cache': {
    key: string; // uid
    value: { uid: string; clients: any[]; cachedAt: string };
  };
}

let dbPromise: Promise<IDBPDatabase<SoloBidDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<SoloBidDB>('solobid-offline', 1, {
      upgrade(db) {
        db.createObjectStore('quote-drafts');
        db.createObjectStore('pending-sync');
        db.createObjectStore('client-cache');
      },
    });
  }
  return dbPromise;
}

export async function saveQuoteDraft(uid: string, quoteId: string, quoteData: any, lineItems: any[], expenses: any[]): Promise<void> {
  const db = await getDb();
  await db.put('quote-drafts', { quoteId, uid, quoteData, lineItems, expenses, savedAt: new Date().toISOString(), status: 'draft' }, `${uid}:${quoteId}`);
}

export async function getQuoteDraft(uid: string, quoteId: string): Promise<any | null> {
  const db = await getDb();
  return (await db.get('quote-drafts', `${uid}:${quoteId}`)) ?? null;
}

export async function deleteQuoteDraft(uid: string, quoteId: string): Promise<void> {
  const db = await getDb();
  await db.delete('quote-drafts', `${uid}:${quoteId}`);
}

export async function addPendingSync(id: string, payload: Record<string, any>): Promise<void> {
  const db = await getDb();
  await db.put('pending-sync', { id, type: 'quote-upsert', payload, createdAt: new Date().toISOString() }, id);
}

export async function getPendingSync(): Promise<any[]> {
  const db = await getDb();
  return db.getAll('pending-sync');
}

export async function removePendingSync(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('pending-sync', id);
}

export async function cacheClients(uid: string, clients: any[]): Promise<void> {
  const db = await getDb();
  await db.put('client-cache', { uid, clients, cachedAt: new Date().toISOString() }, uid);
}

export async function getCachedClients(uid: string): Promise<any[] | null> {
  const db = await getDb();
  const entry = await db.get('client-cache', uid);
  return entry?.clients ?? null;
}

// Legacy localStorage exports kept for backwards compatibility
export type OfflineQuoteDraft = {
  quoteId: string;
  uid: string;
  quoteData: Record<string, any>;
  lineItems: Record<string, any>[];
  expenses: Record<string, any>[];
  savedAt: string;
  status: 'draft' | 'sent';
};

export function saveQuoteDraftLocally(draft: OfflineQuoteDraft) {
  saveQuoteDraft(draft.uid, draft.quoteId, draft.quoteData, draft.lineItems, draft.expenses).catch(console.error);
}

export function getQuoteDraftLocally(uid: string, quoteId: string): OfflineQuoteDraft | null {
  // Synchronous shim — callers should migrate to async getQuoteDraft
  return null;
}

export function removeQuoteDraftLocally(uid: string, quoteId: string) {
  deleteQuoteDraft(uid, quoteId).catch(console.error);
}

export function queueQuoteSave(draft: OfflineQuoteDraft) {
  addPendingSync(`${draft.uid}:${draft.quoteId}`, draft).catch(console.error);
  saveQuoteDraftLocally(draft);
}

export async function getPendingQuoteSaves(): Promise<OfflineQuoteDraft[]> {
  const items = await getPendingSync();
  return items.map((item) => item.payload as OfflineQuoteDraft);
}

export async function setPendingQuoteSaves(items: OfflineQuoteDraft[]) {
  if (items.length === 0) return;
  for (const item of items) {
    await addPendingSync(`${item.uid}:${item.quoteId}`, item);
  }
}
