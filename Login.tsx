export interface User {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

type AuthListener = (user: User | null) => void;

interface StoredAccount {
  uid: string;
  email: string;
  password?: string;
  displayName?: string | null;
  provider: 'password' | 'google';
  createdAt: string;
}

const ACCOUNTS_KEY = 'solobid:auth:accounts';
const SESSION_KEY = 'solobid:auth:session';
const listeners = new Set<AuthListener>();

export class GoogleAuthProvider {
  providerId = 'google.com';
}

export interface Auth {
  currentUser: User | null;
}

export const authState: Auth = {
  currentUser: null,
};

function readAccounts(): StoredAccount[] {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeAccounts(accounts: StoredAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function makeToken(user: User) {
  return btoa(JSON.stringify({ uid: user.uid, email: user.email, iat: Date.now() }));
}

function toUser(account: StoredAccount): User {
  const user: User = {
    uid: account.uid,
    email: account.email,
    displayName: account.displayName || account.email.split('@')[0],
    photoURL: null,
    getIdToken: async () => makeToken(user),
  };
  return user;
}

function notify() {
  listeners.forEach((listener) => listener(authState.currentUser));
}

function setSession(user: User | null) {
  authState.currentUser = user;
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ uid: user.uid }));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
  notify();
}

function restoreSession() {
  if (authState.currentUser) return;
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!session?.uid) return;
    const account = readAccounts().find((item) => item.uid === session.uid);
    if (account) authState.currentUser = toUser(account);
  } catch {
    authState.currentUser = null;
  }
}

export function getAuth(): Auth {
  restoreSession();
  return authState;
}

export function onAuthStateChanged(_auth: Auth, callback: AuthListener) {
  restoreSession();
  listeners.add(callback);
  queueMicrotask(() => callback(authState.currentUser));
  return () => listeners.delete(callback);
}

export async function createUserWithEmailAndPassword(_auth: Auth, email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const accounts = readAccounts();
  if (accounts.some((account) => account.email === normalizedEmail)) {
    throw new Error('An account with this email already exists.');
  }

  const account: StoredAccount = {
    uid: crypto.randomUUID(),
    email: normalizedEmail,
    password,
    provider: 'password',
    createdAt: new Date().toISOString(),
  };

  accounts.push(account);
  writeAccounts(accounts);
  const user = toUser(account);
  setSession(user);
  return { user };
}

export async function signInWithEmailAndPassword(_auth: Auth, email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const account = readAccounts().find((item) => item.email === normalizedEmail);
  if (!account || account.password !== password) {
    throw new Error('Invalid email or password.');
  }

  const user = toUser(account);
  setSession(user);
  return { user };
}

export async function signInWithPopup(_auth: Auth, _provider: GoogleAuthProvider) {
  const accounts = readAccounts();
  let account = accounts.find((item) => item.provider === 'google');
  if (!account) {
    account = {
      uid: crypto.randomUUID(),
      email: 'google-user@solobid.local',
      displayName: 'Google Demo User',
      provider: 'google',
      createdAt: new Date().toISOString(),
    };
    accounts.push(account);
    writeAccounts(accounts);
  }

  const user = toUser(account);
  setSession(user);
  return { user };
}

export async function signOut(_auth: Auth) {
  setSession(null);
}
