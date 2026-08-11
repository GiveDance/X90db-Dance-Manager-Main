import type { SavedDanceMeta } from "./types";

const DB_NAME = "dance-player";
const DB_VERSION = 1;
const META = "meta";
const BLOBS = "blobs";
const DB_TIMEOUT_MS = 8_000;
const BLOB_WRITE_TIMEOUT_MS = 60_000;

let dbPromise: Promise<IDBDatabase> | null = null;
let activeDb: IDBDatabase | null = null;
const activeTransactions = new Set<IDBTransaction>();

interface StoredVideo {
  data: ArrayBuffer;
  type: string;
}

export class DanceStoreTimeoutError extends Error {
  constructor(operation: string) {
    super(`${operation} timed out.`);
    this.name = "DanceStoreTimeoutError";
  }
}

function resetConnection(): void {
  for (const tx of activeTransactions) {
    try {
      tx.abort();
    } catch {
      // The transaction may have completed between the timeout and cleanup.
    }
  }
  activeTransactions.clear();
  activeDb?.close();
  activeDb = null;
  dbPromise = null;
}

function trackTransaction(tx: IDBTransaction): IDBTransaction {
  activeTransactions.add(tx);
  const cleanup = () => activeTransactions.delete(tx);
  tx.addEventListener("complete", cleanup, { once: true });
  tx.addEventListener("abort", cleanup, { once: true });
  tx.addEventListener("error", cleanup, { once: true });
  return tx;
}

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      dbPromise = null;
      reject(new DanceStoreTimeoutError("Opening the local dance library"));
    }, DB_TIMEOUT_MS);

    const rejectOpen = (error: Error | DOMException | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      dbPromise = null;
      reject(error ?? new Error("Unable to open the local dance library."));
    };

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(META)) {
        db.createObjectStore(META, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(BLOBS)) {
        db.createObjectStore(BLOBS);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      if (settled) {
        db.close();
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      activeDb = db;
      db.onversionchange = () => {
        resetConnection();
      };
      db.onclose = () => {
        if (activeDb === db) activeDb = null;
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => rejectOpen(req.error);
    req.onblocked = () =>
      rejectOpen(new Error("The local dance library is blocked by another tab."));
  });
  return dbPromise;
}

export async function listDances(): Promise<SavedDanceMeta[]> {
  const db = await openDB();
  const all = await new Promise<SavedDanceMeta[]>((resolve, reject) => {
    const tx = trackTransaction(db.transaction(META, "readonly"));
    const req = tx.objectStore(META).getAll() as IDBRequest<SavedDanceMeta[]>;
    const timer = window.setTimeout(() => {
      resetConnection();
      reject(new DanceStoreTimeoutError("Loading the dance library"));
    }, DB_TIMEOUT_MS);
    req.onsuccess = () => {
      window.clearTimeout(timer);
      resolve(req.result);
    };
    req.onerror = () => {
      window.clearTimeout(timer);
      reject(req.error);
    };
  });
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveDance(meta: SavedDanceMeta, blob: Blob): Promise<void> {
  const db = await openDB();
  const storedVideo: StoredVideo = {
    data: await blob.arrayBuffer(),
    type: blob.type,
  };

  // ArrayBuffer storage is supported consistently across Chromium and WebKit.
  // Direct Blob persistence fails in some embedded WebKit IndexedDB backends.
  await new Promise<void>((resolve, reject) => {
    const tx = trackTransaction(db.transaction(BLOBS, "readwrite"));
    tx.objectStore(BLOBS).put(storedVideo, meta.id);
    const timer = window.setTimeout(() => {
      resetConnection();
      reject(new DanceStoreTimeoutError("Saving the video"));
    }, BLOB_WRITE_TIMEOUT_MS);
    tx.oncomplete = () => {
      window.clearTimeout(timer);
      resolve();
    };
    tx.onerror = () => {
      window.clearTimeout(timer);
      reject(tx.error);
    };
    tx.onabort = () => {
      window.clearTimeout(timer);
      reject(tx.error ?? new Error("Saving the video was aborted."));
    };
  });

  await new Promise<void>((resolve, reject) => {
    const tx = trackTransaction(db.transaction(META, "readwrite"));
    tx.objectStore(META).put(meta);
    const timer = window.setTimeout(() => {
      resetConnection();
      reject(new DanceStoreTimeoutError("Saving dance metadata"));
    }, DB_TIMEOUT_MS);
    tx.oncomplete = () => {
      window.clearTimeout(timer);
      resolve();
    };
    tx.onerror = () => {
      window.clearTimeout(timer);
      reject(tx.error);
    };
    tx.onabort = () => {
      window.clearTimeout(timer);
      reject(tx.error ?? new Error("Saving dance metadata was aborted."));
    };
  });
}

let metadataWriteQueue: Promise<void> = Promise.resolve();

export async function updateDanceMeta(
  id: string,
  patch: Partial<SavedDanceMeta>,
): Promise<SavedDanceMeta | null> {
  let result: SavedDanceMeta | null = null;
  const write = async () => {
    const db = await openDB();
    result = await new Promise<SavedDanceMeta | null>((resolve, reject) => {
      const tx = trackTransaction(db.transaction(META, "readwrite"));
      const store = tx.objectStore(META);
      const getReq = store.get(id) as IDBRequest<SavedDanceMeta | undefined>;
      let merged: SavedDanceMeta | null = null;
      const timer = window.setTimeout(() => {
        resetConnection();
        reject(new DanceStoreTimeoutError("Updating dance metadata"));
      }, DB_TIMEOUT_MS);

      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (existing) {
          merged = { ...existing, ...patch };
          if (existing.musicStart != null && patch.musicStart == null) {
            merged.musicStart = existing.musicStart;
          }
          store.put(merged);
        }
      };
      getReq.onerror = () => {
        window.clearTimeout(timer);
        reject(getReq.error);
      };
      tx.oncomplete = () => {
        window.clearTimeout(timer);
        resolve(merged);
      };
      tx.onerror = () => {
        window.clearTimeout(timer);
        reject(tx.error);
      };
      tx.onabort = () => {
        window.clearTimeout(timer);
        reject(tx.error ?? new Error("Updating dance metadata was aborted."));
      };
    });
  };

  const queuedWrite = metadataWriteQueue.then(write);
  metadataWriteQueue = queuedWrite.catch(() => {});
  await queuedWrite;
  return result;
}

export async function getDanceBlob(id: string): Promise<Blob | null> {
  const read = async () => {
    const db = await openDB();
    return new Promise<Blob | StoredVideo | undefined>((resolve, reject) => {
      const tx = trackTransaction(db.transaction(BLOBS, "readonly"));
      const req = tx.objectStore(BLOBS).get(id) as IDBRequest<
        Blob | StoredVideo | undefined
      >;
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        tx.abort();
        reject(new DanceStoreTimeoutError("Reading the saved video"));
      }, DB_TIMEOUT_MS);

      const finish = (result: Blob | StoredVideo | undefined) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(result);
      };
      const fail = (error: DOMException | null) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(error ?? new Error("Unable to read the saved video."));
      };

      req.onsuccess = () => finish(req.result);
      req.onerror = () => fail(req.error);
      tx.onerror = () => fail(tx.error);
      tx.onabort = () => fail(tx.error);
    });
  };

  try {
    const stored = await read();
    if (!stored) return null;
    return stored instanceof Blob
      ? stored
      : new Blob([stored.data], { type: stored.type });
  } catch (error) {
    resetConnection();
    try {
      const stored = await read();
      if (!stored) return null;
      return stored instanceof Blob
        ? stored
        : new Blob([stored.data], { type: stored.type });
    } catch (retryError) {
      resetConnection();
      throw retryError instanceof DanceStoreTimeoutError ? retryError : error;
    }
  }
}

export async function deleteDance(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([META, BLOBS], "readwrite");
    tx.objectStore(META).delete(id);
    tx.objectStore(BLOBS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
