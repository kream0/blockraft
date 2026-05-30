import type { WorldMetadata, WorldSave, ChunkOverrides, FurnaceState, ChestState } from '../types';

/** All worlds live in one IndexedDB database; one object store per kind. */
const DB_NAME = 'mc-clone';
const DB_VERSION = 4;
const STORE_META = 'world_meta';
const STORE_OVERRIDES = 'world_overrides';
const STORE_FURNACES = 'world_furnaces';
const STORE_CHESTS = 'world_chests';

/** Wrapper row stored in the overrides store. The keyPath is the top-level `name`. */
interface OverridesRow {
  name: string;
  overrides: ChunkOverrides;
}

interface FurnacesRow {
  name: string;
  furnaces: Record<string, FurnaceState>;
}

interface ChestsRow {
  name: string;
  chests: Record<string, ChestState>;
}

/**
 * IndexedDB-backed world save store.
 *
 * The database is opened lazily on the first async call and the connection
 * is cached on `_dbPromise`. Each public method awaits the cached promise so
 * concurrent callers share a single underlying connection.
 */
export class WorldStorage {
  private _dbPromise: Promise<IDBDatabase> | null = null;

  /** Open (and upgrade if needed) the database. Idempotent. */
  open(): Promise<void> {
    return this._getDB().then(() => undefined);
  }

  /** List all worlds, sorted by lastPlayed desc. */
  async listWorlds(): Promise<WorldMetadata[]> {
    const db = await this._getDB();
    return new Promise<WorldMetadata[]>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const req = store.getAll();
      const out: WorldMetadata[] = [];
      req.onsuccess = (): void => {
        const result = req.result as WorldMetadata[] | undefined;
        if (result !== undefined) out.push(...result);
      };
      tx.onerror = (): void => reject(tx.error ?? new Error('listWorlds: transaction failed'));
      tx.oncomplete = (): void => {
        out.sort((a, b) => b.lastPlayed - a.lastPlayed);
        resolve(out);
      };
    });
  }

  /** Get one world (metadata + overrides). Returns null if not found. */
  async getWorld(name: string): Promise<WorldSave | null> {
    const db = await this._getDB();
    return new Promise<WorldSave | null>((resolve, reject) => {
      const tx = db.transaction([STORE_META, STORE_OVERRIDES], 'readonly');
      const metaReq = tx.objectStore(STORE_META).get(name);
      const ovReq = tx.objectStore(STORE_OVERRIDES).get(name);

      let metadata: WorldMetadata | undefined;
      let overrides: ChunkOverrides = {};

      metaReq.onsuccess = (): void => {
        metadata = metaReq.result as WorldMetadata | undefined;
      };
      ovReq.onsuccess = (): void => {
        const row = ovReq.result as OverridesRow | undefined;
        if (row !== undefined) overrides = row.overrides;
      };
      tx.onerror = (): void => reject(tx.error ?? new Error('getWorld: transaction failed'));
      tx.oncomplete = (): void => {
        if (metadata === undefined) {
          resolve(null);
          return;
        }
        resolve({ metadata, overrides });
      };
    });
  }

  /** True iff a world with this name exists. */
  async exists(name: string): Promise<boolean> {
    const db = await this._getDB();
    return new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).getKey(name);
      let found = false;
      req.onsuccess = (): void => {
        found = req.result !== undefined;
      };
      tx.onerror = (): void => reject(tx.error ?? new Error('exists: transaction failed'));
      tx.oncomplete = (): void => resolve(found);
    });
  }

  /** Create or overwrite a world. */
  async saveWorld(save: WorldSave): Promise<void> {
    const db = await this._getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_META, STORE_OVERRIDES], 'readwrite');
      tx.objectStore(STORE_META).put(save.metadata);
      const row: OverridesRow = { name: save.metadata.name, overrides: save.overrides };
      tx.objectStore(STORE_OVERRIDES).put(row);
      tx.onerror = (): void => reject(tx.error ?? new Error('saveWorld: transaction failed'));
      tx.oncomplete = (): void => resolve();
    });
  }

  /** Persist only the metadata (e.g. updating lastPlayed/playerPosition). Cheaper than saveWorld. */
  async saveMetadata(metadata: WorldMetadata): Promise<void> {
    const db = await this._getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put(metadata);
      tx.onerror = (): void => reject(tx.error ?? new Error('saveMetadata: transaction failed'));
      tx.oncomplete = (): void => resolve();
    });
  }

  /** Persist only the overrides for a world. */
  async saveOverrides(name: string, overrides: ChunkOverrides): Promise<void> {
    const db = await this._getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_OVERRIDES, 'readwrite');
      const row: OverridesRow = { name, overrides };
      tx.objectStore(STORE_OVERRIDES).put(row);
      tx.onerror = (): void => reject(tx.error ?? new Error('saveOverrides: transaction failed'));
      tx.oncomplete = (): void => resolve();
    });
  }

  /** Delete a world by name. No-op if not present. */
  async deleteWorld(name: string): Promise<void> {
    const db = await this._getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_META, STORE_OVERRIDES, STORE_FURNACES, STORE_CHESTS], 'readwrite');
      tx.objectStore(STORE_META).delete(name);
      tx.objectStore(STORE_OVERRIDES).delete(name);
      tx.objectStore(STORE_FURNACES).delete(name);
      tx.objectStore(STORE_CHESTS).delete(name);
      tx.onerror = (): void => reject(tx.error ?? new Error('deleteWorld: transaction failed'));
      tx.oncomplete = (): void => resolve();
    });
  }

  /** Persist all furnace states for a world. */
  async saveFurnaces(name: string, furnaces: Record<string, FurnaceState>): Promise<void> {
    const db = await this._getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_FURNACES, 'readwrite');
      const row: FurnacesRow = { name, furnaces };
      tx.objectStore(STORE_FURNACES).put(row);
      tx.onerror = (): void => reject(tx.error ?? new Error('saveFurnaces: transaction failed'));
      tx.oncomplete = (): void => resolve();
    });
  }

  /** Load furnace states for a world. Returns {} if none stored (e.g. pre-v2 worlds). */
  async loadFurnaces(name: string): Promise<Record<string, FurnaceState>> {
    const db = await this._getDB();
    return new Promise<Record<string, FurnaceState>>((resolve, reject) => {
      const tx = db.transaction(STORE_FURNACES, 'readonly');
      const req = tx.objectStore(STORE_FURNACES).get(name);
      let furnaces: Record<string, FurnaceState> = {};
      req.onsuccess = (): void => {
        const row = req.result as FurnacesRow | undefined;
        if (row !== undefined) furnaces = row.furnaces;
      };
      tx.onerror = (): void => reject(tx.error ?? new Error('loadFurnaces: transaction failed'));
      tx.oncomplete = (): void => resolve(furnaces);
    });
  }

  /** Persist all chest states for a world. */
  async saveChests(name: string, chests: Record<string, ChestState>): Promise<void> {
    const db = await this._getDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CHESTS, 'readwrite');
      const row: ChestsRow = { name, chests };
      tx.objectStore(STORE_CHESTS).put(row);
      tx.onerror = (): void => reject(tx.error ?? new Error('saveChests: transaction failed'));
      tx.oncomplete = (): void => resolve();
    });
  }

  /** Load chest states for a world. Returns {} if none stored. */
  async loadChests(name: string): Promise<Record<string, ChestState>> {
    const db = await this._getDB();
    return new Promise<Record<string, ChestState>>((resolve, reject) => {
      const tx = db.transaction(STORE_CHESTS, 'readonly');
      const req = tx.objectStore(STORE_CHESTS).get(name);
      let chests: Record<string, ChestState> = {};
      req.onsuccess = (): void => {
        const row = req.result as ChestsRow | undefined;
        if (row !== undefined) chests = row.chests;
      };
      tx.onerror = (): void => reject(tx.error ?? new Error('loadChests: transaction failed'));
      tx.oncomplete = (): void => resolve(chests);
    });
  }

  /** Close the connection. Subsequent ops will reopen lazily. */
  close(): void {
    const pending = this._dbPromise;
    this._dbPromise = null;
    if (pending === null) return;
    pending
      .then((db) => {
        db.close();
      })
      .catch(() => {
        // Open never resolved — nothing to close.
      });
  }

  private _getDB(): Promise<IDBDatabase> {
    if (this._dbPromise !== null) return this._dbPromise;
    this._dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (): void => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains(STORE_OVERRIDES)) {
          db.createObjectStore(STORE_OVERRIDES, { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains(STORE_FURNACES)) {
          db.createObjectStore(STORE_FURNACES, { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains(STORE_CHESTS)) {
          db.createObjectStore(STORE_CHESTS, { keyPath: 'name' });
        }
      };
      req.onsuccess = (): void => {
        const db = req.result;
        db.onversionchange = (): void => {
          this._dbPromise = null;
          db.close();
        };
        resolve(db);
      };
      req.onerror = (): void => reject(req.error ?? new Error('indexedDB.open failed'));
      req.onblocked = (): void => reject(new Error('indexedDB.open blocked by another connection'));
    });
    return this._dbPromise;
  }
}
