type CollectionStore = Record<string, Record<string, any>>;

interface RootStore {
  collections: CollectionStore;
}

export interface Firestore {
  type: 'mock-firestore';
}

export interface DocumentReference {
  path: string;
  id: string;
  collectionPath: string;
}

export interface CollectionReference {
  path: string;
  group?: boolean;
}

interface QueryConstraint {
  type: 'where' | 'orderBy' | 'limit';
  field?: string;
  op?: string;
  value?: any;
  direction?: 'asc' | 'desc';
  count?: number;
}

interface QueryReference {
  collectionRef: CollectionReference;
  constraints: QueryConstraint[];
}

const DB_KEY = 'solobid:mock-db';
const listeners = new Set<() => void>();

export const serverTimestamp = () => new Date().toISOString();

export class Timestamp {
  constructor(private readonly date: Date) {}
  static now() {
    return new Timestamp(new Date());
  }
  static fromDate(date: Date) {
    return new Timestamp(date);
  }
  toDate() {
    return this.date;
  }
  toMillis() {
    return this.date.getTime();
  }
  toJSON() {
    return this.date.toISOString();
  }
}

export function getFirestore(): Firestore {
  ensureStore();
  return { type: 'mock-firestore' };
}

function ensureStore(): RootStore {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    const initial = { collections: {} };
    localStorage.setItem(DB_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    const parsed = JSON.parse(raw);
    return { collections: parsed.collections || {} };
  } catch {
    const initial = { collections: {} };
    localStorage.setItem(DB_KEY, JSON.stringify(initial));
    return initial;
  }
}

function writeStore(store: RootStore) {
  localStorage.setItem(DB_KEY, JSON.stringify(store));
  listeners.forEach((listener) => listener());
  window.dispatchEvent(new CustomEvent('solobid:mock-db-changed'));
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function normalizePath(parts: any[]) {
  return parts
    .flatMap((part) => typeof part === 'string' ? part.split('/') : [part?.path || ''])
    .filter(Boolean)
    .join('/');
}

function splitDocPath(path: string) {
  const segments = path.split('/').filter(Boolean);
  const id = segments[segments.length - 1];
  const collectionPath = segments.slice(0, -1).join('/');
  return { id, collectionPath };
}

function docSnapshot(ref: DocumentReference, data: any) {
  return {
    id: ref.id,
    ref,
    exists: () => data !== undefined,
    data: () => clone(data),
  };
}

function querySnapshot(ref: CollectionReference | QueryReference) {
  const docs = readQuery(ref).map(({ id, data }) => {
    const documentRef = doc({ type: 'mock-firestore' }, getCollectionPath(ref), id);
    return docSnapshot(documentRef, data);
  });
  return {
    docs,
    empty: docs.length === 0,
    size: docs.length,
    forEach: (callback: any) => docs.forEach(callback),
  };
}

function getCollectionPath(ref: CollectionReference | QueryReference) {
  return 'collectionRef' in ref ? ref.collectionRef.path : ref.path;
}

function readQuery(ref: CollectionReference | QueryReference) {
  const store = ensureStore();
  const collectionPath = getCollectionPath(ref);
  const sourceRef = 'collectionRef' in ref ? ref.collectionRef : ref;
  const records = sourceRef.group
    ? Object.entries(store.collections).reduce<Record<string, any>>((all, [path, docs]) => {
        if (path === collectionPath || path.endsWith(`/${collectionPath}`)) {
          Object.entries(docs).forEach(([id, data]) => {
            all[`${path}/${id}`] = data;
          });
        }
        return all;
      }, {})
    : store.collections[collectionPath] || {};
  let rows = Object.entries(records).map(([id, data]) => ({ id, data: clone(data) }));
  const constraints = 'constraints' in ref ? ref.constraints : [];

  for (const constraint of constraints) {
    if (constraint.type === 'where') {
      rows = rows.filter(({ data }) => compare(data?.[constraint.field!], constraint.op!, constraint.value));
    }
    if (constraint.type === 'orderBy') {
      rows = rows.sort((a, b) => {
        const av = a.data?.[constraint.field!];
        const bv = b.data?.[constraint.field!];
        if (av === bv) return 0;
        const result = av > bv ? 1 : -1;
        return constraint.direction === 'desc' ? -result : result;
      });
    }
    if (constraint.type === 'limit') {
      rows = rows.slice(0, constraint.count);
    }
  }

  return rows;
}

function compare(left: any, op: string, right: any) {
  if (op === '==') return left === right;
  if (op === '!=') return left !== right;
  if (op === '>=') return left >= right;
  if (op === '<=') return left <= right;
  if (op === '>') return left > right;
  if (op === '<') return left < right;
  if (op === 'array-contains') return Array.isArray(left) && left.includes(right);
  if (op === 'in') return Array.isArray(right) && right.includes(left);
  return false;
}

export function collection(_dbOrRef: Firestore | DocumentReference | CollectionReference, ...pathSegments: string[]): CollectionReference {
  const base = 'path' in _dbOrRef ? _dbOrRef.path : '';
  return { path: normalizePath([base, ...pathSegments]) };
}

export function collectionGroup(_db: Firestore, collectionId: string): CollectionReference {
  return { path: collectionId, group: true };
}

export function doc(_dbOrRef: Firestore | CollectionReference, ...pathSegments: string[]): DocumentReference {
  const base = 'path' in _dbOrRef ? _dbOrRef.path : '';
  const path = normalizePath([base, ...pathSegments]);
  const finalPath = pathSegments.length === 0 && base ? `${base}/${crypto.randomUUID()}` : path;
  const { id, collectionPath } = splitDocPath(finalPath);
  return { path: finalPath, id, collectionPath };
}

export async function getDoc(ref: DocumentReference) {
  const store = ensureStore();
  return docSnapshot(ref, store.collections[ref.collectionPath]?.[ref.id]);
}

export async function getDocs(ref: CollectionReference | QueryReference) {
  return querySnapshot(ref);
}

export async function setDoc(ref: DocumentReference, data: any, options?: { merge?: boolean }) {
  const store = ensureStore();
  const collectionStore = store.collections[ref.collectionPath] || {};
  collectionStore[ref.id] = options?.merge ? { ...(collectionStore[ref.id] || {}), ...clone(data) } : clone(data);
  store.collections[ref.collectionPath] = collectionStore;
  writeStore(store);
}

export async function updateDoc(ref: DocumentReference, data: any) {
  const store = ensureStore();
  const collectionStore = store.collections[ref.collectionPath] || {};
  if (!collectionStore[ref.id]) throw new Error(`Document does not exist: ${ref.path}`);
  collectionStore[ref.id] = { ...collectionStore[ref.id], ...clone(data) };
  store.collections[ref.collectionPath] = collectionStore;
  writeStore(store);
}

export async function deleteDoc(ref: DocumentReference) {
  const store = ensureStore();
  if (store.collections[ref.collectionPath]) {
    delete store.collections[ref.collectionPath][ref.id];
  }
  writeStore(store);
}

export function query(collectionRef: CollectionReference, ...constraints: QueryConstraint[]): QueryReference {
  return { collectionRef, constraints };
}

export function where(field: string, op: string, value: any): QueryConstraint {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryConstraint {
  return { type: 'orderBy', field, direction };
}

export function limit(count: number): QueryConstraint {
  return { type: 'limit', count };
}

export function onSnapshot(ref: CollectionReference | QueryReference | DocumentReference, callback: any) {
  const emit = () => {
    if ('id' in ref && 'collectionPath' in ref) {
      getDoc(ref).then(callback);
    } else {
      callback(querySnapshot(ref));
    }
  };
  const listener = () => emit();
  listeners.add(listener);
  queueMicrotask(emit);
  return () => listeners.delete(listener);
}

export function writeBatch(_db: Firestore) {
  const operations: Array<() => Promise<void>> = [];
  return {
    set: (ref: DocumentReference, data: any, options?: { merge?: boolean }) => operations.push(() => setDoc(ref, data, options)),
    update: (ref: DocumentReference, data: any) => operations.push(() => updateDoc(ref, data)),
    delete: (ref: DocumentReference) => operations.push(() => deleteDoc(ref)),
    commit: async () => {
      for (const operation of operations) await operation();
    },
  };
}

export async function runTransaction(_db: Firestore, updateFunction: (transaction: any) => Promise<void>) {
  const writes: Array<() => Promise<void>> = [];
  const transaction = {
    get: (ref: DocumentReference) => getDoc(ref),
    set: (ref: DocumentReference, data: any, options?: { merge?: boolean }) => writes.push(() => setDoc(ref, data, options)),
    update: (ref: DocumentReference, data: any) => writes.push(() => updateDoc(ref, data)),
    delete: (ref: DocumentReference) => writes.push(() => deleteDoc(ref)),
  };
  await updateFunction(transaction);
  for (const write of writes) await write();
}

export function arrayUnion(...values: any[]) {
  return values;
}

export function arrayRemove(...values: any[]) {
  return { __arrayRemove: values };
}

export function increment(value: number) {
  return { __increment: value };
}

export function exportMockDatabase() {
  return ensureStore();
}

export function importMockDatabase(data: RootStore) {
  writeStore({ collections: data.collections || {} });
}

export function clearMockDatabase() {
  writeStore({ collections: {} });
}
