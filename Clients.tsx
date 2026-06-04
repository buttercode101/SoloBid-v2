import { exportMockDatabase, importMockDatabase } from './mockFirebase/firestore';

const STORAGE_KEY = 'solobid:mock-storage';
const ACCOUNTS_KEY = 'solobid:auth:accounts';
const SESSION_KEY = 'solobid:auth:session';

export interface SoloBidBackup {
  app: 'SoloBid';
  version: 1;
  exportedAt: string;
  firestore: ReturnType<typeof exportMockDatabase>;
  storage: Record<string, unknown>;
  authAccounts: unknown[];
  authSession: unknown;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || '') as T;
  } catch {
    return fallback;
  }
}

export function createBackup(): SoloBidBackup {
  return {
    app: 'SoloBid',
    version: 1,
    exportedAt: new Date().toISOString(),
    firestore: exportMockDatabase(),
    storage: readJson(STORAGE_KEY, {}),
    authAccounts: readJson(ACCOUNTS_KEY, []),
    authSession: readJson(SESSION_KEY, null),
  };
}

export function downloadBackup() {
  const backup = createBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `solobid-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function restoreBackup(file: File) {
  const backup = JSON.parse(await file.text()) as SoloBidBackup;
  if (backup.app !== 'SoloBid' || !backup.firestore) {
    throw new Error('This does not look like a SoloBid backup file.');
  }

  importMockDatabase(backup.firestore);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(backup.storage || {}));
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(backup.authAccounts || []));
  if (backup.authSession) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(backup.authSession));
  }
}
