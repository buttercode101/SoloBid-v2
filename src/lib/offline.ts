export type OfflineQuoteDraft = {
  quoteId: string;
  uid: string;
  quoteData: Record<string, any>;
  lineItems: Record<string, any>[];
  expenses: Record<string, any>[];
  savedAt: string;
  status: 'draft' | 'sent';
};

const DRAFT_PREFIX = 'solobid:quote-draft:';
const PENDING_KEY = 'solobid:pending-quote-saves';

const canUseStorage = () => typeof window !== 'undefined' && !!window.localStorage;

export function saveQuoteDraftLocally(draft: OfflineQuoteDraft) {
  if (!canUseStorage()) return;
  const payload = JSON.stringify(draft);
  window.localStorage.setItem(`${DRAFT_PREFIX}${draft.uid}:${draft.quoteId}`, payload);
}

export function getQuoteDraftLocally(uid: string, quoteId: string): OfflineQuoteDraft | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(`${DRAFT_PREFIX}${uid}:${quoteId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as OfflineQuoteDraft;
  } catch {
    return null;
  }
}

export function removeQuoteDraftLocally(uid: string, quoteId: string) {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(`${DRAFT_PREFIX}${uid}:${quoteId}`);
}

export function queueQuoteSave(draft: OfflineQuoteDraft) {
  if (!canUseStorage()) return;
  const pending = getPendingQuoteSaves().filter(item => !(item.uid === draft.uid && item.quoteId === draft.quoteId));
  pending.push(draft);
  window.localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  saveQuoteDraftLocally(draft);
}

export function getPendingQuoteSaves(): OfflineQuoteDraft[] {
  if (!canUseStorage()) return [];
  const raw = window.localStorage.getItem(PENDING_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as OfflineQuoteDraft[];
  } catch {
    return [];
  }
}

export function setPendingQuoteSaves(items: OfflineQuoteDraft[]) {
  if (!canUseStorage()) return;
  if (items.length === 0) {
    window.localStorage.removeItem(PENDING_KEY);
    return;
  }
  window.localStorage.setItem(PENDING_KEY, JSON.stringify(items));
}
