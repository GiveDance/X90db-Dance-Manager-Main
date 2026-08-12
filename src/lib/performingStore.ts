import type { PerformingProject } from "./types";

const DB_NAME = "dance-manager-performing";
const DB_VERSION = 3;
const PROJECTS = "projects";
const MEDIA = "media";
const CLIPS = "clips";
const DB_TIMEOUT_MS = 8_000;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      dbPromise = null;
      reject(new Error("Opening the Performing project library timed out."));
    }, DB_TIMEOUT_MS);

    const fail = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      dbPromise = null;
      reject(error ?? request.error ?? new Error("Unable to open the Performing project library."));
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS)) {
        db.createObjectStore(PROJECTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(MEDIA)) {
        db.createObjectStore(MEDIA);
      }
      if (!db.objectStoreNames.contains(CLIPS)) {
        db.createObjectStore(CLIPS);
      }
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => fail();
    request.onblocked = () =>
      fail(new Error("The Performing project library is open in another tab."));
  });

  return dbPromise;
}

function transactionFailure(
  transaction: IDBTransaction,
  timer: number,
  reject: (reason: Error | DOMException) => void,
): () => void {
  return () => {
    window.clearTimeout(timer);
    reject(transaction.error ?? new Error("The Performing project operation failed."));
  };
}

export async function listPerformingProjects(): Promise<PerformingProject[]> {
  const db = await openDB();
  const projects = await new Promise<PerformingProject[]>((resolve, reject) => {
    const transaction = db.transaction(PROJECTS, "readonly");
    const request = transaction.objectStore(PROJECTS).getAll() as IDBRequest<
      PerformingProject[]
    >;
    const timer = window.setTimeout(() => {
      transaction.abort();
      reject(new Error("Loading Performing projects timed out."));
    }, DB_TIMEOUT_MS);
    request.onsuccess = () => {
      window.clearTimeout(timer);
      resolve(request.result);
    };
    request.onerror = () => {
      window.clearTimeout(timer);
      reject(request.error ?? new Error("Unable to load Performing projects."));
    };
  });
  return projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

interface StoredMedia {
  data: ArrayBuffer;
  type: string;
}

function clipMediaKey(projectId: string, clipId: string): string {
  return `${projectId}:${clipId}`;
}

export async function savePerformingProjectWithMedia(
  project: PerformingProject,
  media: Blob,
): Promise<void> {
  const db = await openDB();
  const storedMedia: StoredMedia = {
    data: await media.arrayBuffer(),
    type: media.type,
  };
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([PROJECTS, MEDIA], "readwrite");
    const timer = window.setTimeout(() => {
      transaction.abort();
      reject(new Error("Saving the Performing project timed out."));
    }, 60_000);
    transaction.objectStore(PROJECTS).put(project);
    transaction.objectStore(MEDIA).put(storedMedia, project.id);
    transaction.oncomplete = () => {
      window.clearTimeout(timer);
      resolve();
    };
    transaction.onerror = transactionFailure(transaction, timer, reject);
    transaction.onabort = transactionFailure(transaction, timer, reject);
  });
}

export async function getPerformingProjectMedia(id: string): Promise<Blob | null> {
  const db = await openDB();
  return new Promise<Blob | null>((resolve, reject) => {
    const transaction = db.transaction(MEDIA, "readonly");
    const request = transaction.objectStore(MEDIA).get(id) as IDBRequest<
      StoredMedia | Blob | undefined
    >;
    const timer = window.setTimeout(() => {
      transaction.abort();
      reject(new Error("Loading the Performing project media timed out."));
    }, DB_TIMEOUT_MS);
    request.onsuccess = () => {
      window.clearTimeout(timer);
      const stored = request.result;
      if (!stored) {
        resolve(null);
      } else if (stored instanceof Blob) {
        resolve(stored);
      } else {
        resolve(new Blob([stored.data], { type: stored.type }));
      }
    };
    request.onerror = () => {
      window.clearTimeout(timer);
      reject(request.error ?? new Error("Unable to load Performing project media."));
    };
  });
}

export async function updatePerformingProject(
  project: PerformingProject,
): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(PROJECTS, "readwrite");
    const timer = window.setTimeout(() => {
      transaction.abort();
      reject(new Error("Updating the Performing project timed out."));
    }, DB_TIMEOUT_MS);
    transaction.objectStore(PROJECTS).put(project);
    transaction.oncomplete = () => {
      window.clearTimeout(timer);
      resolve();
    };
    transaction.onerror = transactionFailure(transaction, timer, reject);
    transaction.onabort = transactionFailure(transaction, timer, reject);
  });
}

export async function savePerformingClipMedia(
  projectId: string,
  clipId: string,
  media: Blob,
): Promise<void> {
  const db = await openDB();
  const storedMedia: StoredMedia = {
    data: await media.arrayBuffer(),
    type: media.type,
  };
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(CLIPS, "readwrite");
    const timer = window.setTimeout(() => {
      transaction.abort();
      reject(new Error("Saving the clip timed out."));
    }, 60_000);
    transaction.objectStore(CLIPS).put(
      storedMedia,
      clipMediaKey(projectId, clipId),
    );
    transaction.oncomplete = () => {
      window.clearTimeout(timer);
      resolve();
    };
    transaction.onerror = transactionFailure(transaction, timer, reject);
    transaction.onabort = transactionFailure(transaction, timer, reject);
  });
}

export async function getPerformingClipMedia(
  projectId: string,
  clipId: string,
): Promise<Blob | null> {
  const db = await openDB();
  return new Promise<Blob | null>((resolve, reject) => {
    const transaction = db.transaction(CLIPS, "readonly");
    const request = transaction
      .objectStore(CLIPS)
      .get(clipMediaKey(projectId, clipId)) as IDBRequest<
      StoredMedia | undefined
    >;
    const timer = window.setTimeout(() => {
      transaction.abort();
      reject(new Error("Loading the clip timed out."));
    }, DB_TIMEOUT_MS);
    request.onsuccess = () => {
      window.clearTimeout(timer);
      const stored = request.result;
      resolve(stored ? new Blob([stored.data], { type: stored.type }) : null);
    };
    request.onerror = () => {
      window.clearTimeout(timer);
      reject(request.error ?? new Error("Unable to load the clip."));
    };
  });
}

export async function deletePerformingClipMedia(
  projectId: string,
  clipId: string,
): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(CLIPS, "readwrite");
    const timer = window.setTimeout(() => {
      transaction.abort();
      reject(new Error("Deleting the clip timed out."));
    }, DB_TIMEOUT_MS);
    transaction.objectStore(CLIPS).delete(clipMediaKey(projectId, clipId));
    transaction.oncomplete = () => {
      window.clearTimeout(timer);
      resolve();
    };
    transaction.onerror = transactionFailure(transaction, timer, reject);
    transaction.onabort = transactionFailure(transaction, timer, reject);
  });
}

export async function deletePerformingProject(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([PROJECTS, MEDIA, CLIPS], "readwrite");
    const timer = window.setTimeout(() => {
      transaction.abort();
      reject(new Error("Deleting the Performing project timed out."));
    }, DB_TIMEOUT_MS);
    transaction.objectStore(PROJECTS).delete(id);
    transaction.objectStore(MEDIA).delete(id);
    const clipStore = transaction.objectStore(CLIPS);
    const clipPrefix = `${id}:`;
    const clipCursor = clipStore.openKeyCursor();
    clipCursor.onsuccess = () => {
      const cursor = clipCursor.result;
      if (!cursor) return;
      if (typeof cursor.key === "string" && cursor.key.startsWith(clipPrefix)) {
        clipStore.delete(cursor.key);
      }
      cursor.continue();
    };
    transaction.oncomplete = () => {
      window.clearTimeout(timer);
      resolve();
    };
    transaction.onerror = transactionFailure(transaction, timer, reject);
    transaction.onabort = transactionFailure(transaction, timer, reject);
  });
}
