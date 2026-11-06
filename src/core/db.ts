/** IndexedDB persistence: project records + original file blobs. */
import { migrateProject, newId, type AssetFileMeta, type Project } from './project';

const DB_NAME = 'my3dstudio';
const DB_VERSION = 1;

export class StorageError extends Error {
  constructor(public code: 'unavailable' | 'quota' | 'notFound' | 'failed', message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

interface FileRecord {
  id: string;
  projectId: string;
  blob: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function wrapErr(e: unknown): StorageError {
  const name = (e as any)?.name ?? '';
  if (name === 'QuotaExceededError' || /quota/i.test(String((e as any)?.message ?? ''))) {
    return new StorageError('quota', 'Browser storage is full');
  }
  if (e instanceof StorageError) return e;
  return new StorageError('failed', String((e as any)?.message ?? e));
}

export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      if (typeof indexedDB === 'undefined') throw new Error('no indexedDB');
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      reject(new StorageError('unavailable', 'IndexedDB is not available in this browser mode'));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('files')) {
        const s = db.createObjectStore('files', { keyPath: 'id' });
        s.createIndex('projectId', 'projectId');
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(new StorageError('unavailable', String(req.error?.message ?? 'IndexedDB open failed')));
    req.onblocked = () => reject(new StorageError('unavailable', 'Database is blocked by another open tab'));
  });
  dbPromise.catch(() => (dbPromise = null));
  return dbPromise;
}

function tx<T>(stores: string[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => T): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let result: T;
        let t: IDBTransaction;
        try {
          t = db.transaction(stores, mode);
          result = fn(t);
        } catch (e) {
          reject(wrapErr(e));
          return;
        }
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(wrapErr(t.error));
        t.onabort = () => reject(wrapErr(t.error ?? new Error('Transaction aborted')));
      }),
  );
}

function reqP<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(wrapErr(r.error));
  });
}

export async function listProjects(): Promise<Project[]> {
  const raw = await tx(['projects'], 'readonly', (t) => reqP(t.objectStore('projects').getAll()));
  const list = (await raw).map(migrateProject);
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<Project> {
  const raw = await tx(['projects'], 'readonly', (t) => reqP(t.objectStore('projects').get(id)));
  const r = await raw;
  if (!r) throw new StorageError('notFound', 'Project not found');
  return migrateProject(r);
}

/** Create a new project with its original file blobs (stored as-is). */
export async function createProject(project: Project, blobs: Map<string, Blob>): Promise<void> {
  await tx(['projects', 'files'], 'readwrite', (t) => {
    t.objectStore('projects').put(project);
    const fs = t.objectStore('files');
    for (const f of project.files) {
      const blob = blobs.get(f.id);
      if (!blob) throw new StorageError('failed', `Missing data for ${f.name}`);
      fs.put({ id: f.id, projectId: project.id, blob } satisfies FileRecord);
    }
  });
}

/** Update project metadata only (never touches file blobs). */
export async function saveProjectMeta(project: Project): Promise<void> {
  await tx(['projects'], 'readwrite', (t) => {
    t.objectStore('projects').put(project);
  });
}

export async function getFileBlob(fileId: string): Promise<Blob> {
  const r = await tx(['files'], 'readonly', (t) => reqP(t.objectStore('files').get(fileId)));
  const rec = (await r) as FileRecord | undefined;
  if (!rec) throw new StorageError('notFound', 'Stored file not found');
  return rec.blob;
}

export async function getProjectBlobs(p: Project): Promise<Map<string, Blob>> {
  const m = new Map<string, Blob>();
  for (const f of p.files) m.set(f.id, await getFileBlob(f.id));
  return m;
}

export async function deleteProject(id: string): Promise<void> {
  await tx(['projects', 'files'], 'readwrite', (t) => {
    t.objectStore('projects').delete(id);
    const idx = t.objectStore('files').index('projectId');
    const cur = idx.openCursor(IDBKeyRange.only(id));
    cur.onsuccess = () => {
      const c = cur.result;
      if (c) {
        c.delete();
        c.continue();
      }
    };
  });
}

export async function duplicateProject(src: Project, newName: string): Promise<Project> {
  const blobs = await getProjectBlobs(src);
  const idMap = new Map<string, string>();
  const files: AssetFileMeta[] = src.files.map((f) => {
    const nid = newId();
    idMap.set(f.id, nid);
    return { ...f, id: nid };
  });
  const now = Date.now();
  const copy: Project = { ...structuredClone(src), id: newId(), name: newName, files, createdAt: now, updatedAt: now };
  const nb = new Map<string, Blob>();
  for (const [oldId, b] of blobs) nb.set(idMap.get(oldId)!, b);
  await createProject(copy, nb);
  return copy;
}

export interface StorageInfo {
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
}

export async function storageInfo(): Promise<StorageInfo> {
  const s: any = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  let usage: number | null = null;
  let quota: number | null = null;
  let persisted: boolean | null = null;
  try {
    if (s?.estimate) {
      const e = await s.estimate();
      usage = e.usage ?? null;
      quota = e.quota ?? null;
    }
    if (s?.persisted) persisted = await s.persisted();
  } catch {
    /* ignore */
  }
  return { usage, quota, persisted };
}

export async function requestPersist(): Promise<boolean> {
  try {
    return !!(await (navigator as any).storage?.persist?.());
  } catch {
    return false;
  }
}

/** Add new original files to an existing saved project (metadata + blobs in one transaction). */
export async function addFiles(project: Project, files: { meta: AssetFileMeta; blob: Blob }[]): Promise<void> {
  await tx(['projects', 'files'], 'readwrite', (t) => {
    t.objectStore('projects').put(project);
    for (const f of files) t.objectStore('files').put({ id: f.meta.id, projectId: project.id, blob: f.blob } satisfies FileRecord);
  });
}
