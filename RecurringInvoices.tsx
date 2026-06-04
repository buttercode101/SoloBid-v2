interface StorageObject {
  path: string;
  contentType: string;
  dataUrl: string;
  uploadedAt: string;
}

export interface Storage {
  type: 'mock-storage';
}

export interface StorageReference {
  storage: Storage;
  fullPath: string;
}

const STORAGE_KEY = 'solobid:mock-storage';

function readStorage(): Record<string, StorageObject> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeStorage(data: Record<string, StorageObject>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function getStorage(): Storage {
  return { type: 'mock-storage' };
}

export function ref(storage: Storage, path: string): StorageReference {
  return { storage, fullPath: path };
}

export async function uploadBytes(storageRef: StorageReference, file: Blob) {
  const data = readStorage();
  data[storageRef.fullPath] = {
    path: storageRef.fullPath,
    contentType: file.type || 'application/octet-stream',
    dataUrl: await fileToDataUrl(file),
    uploadedAt: new Date().toISOString(),
  };
  writeStorage(data);
  return { ref: storageRef, metadata: data[storageRef.fullPath] };
}

export async function getDownloadURL(storageRef: StorageReference) {
  const item = readStorage()[storageRef.fullPath];
  if (!item) throw new Error(`File not found: ${storageRef.fullPath}`);
  return item.dataUrl;
}
