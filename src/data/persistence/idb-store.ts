// IndexedDB-backed store (Phase 6), via the tiny `idb` wrapper.
//
// Three object stores mirror the persisted data model: `sessions` (play history,
// keyed by id, indexed by start time), `srItems` (SM-2 state, keyed by itemKey,
// indexed by due date so Phase 7 can query what's due), and `prefs` (a single row).
// Defining `srItems` now — even though scheduling lands in Phase 7 — avoids a schema
// migration later.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Prefs, QuizStore, SessionRecord, SRItem } from './types';

const DB_NAME = 'geo-quiz';
const DB_VERSION = 1;

/** The single prefs row lives under a fixed, out-of-line key. */
const PREFS_KEY = 'app';

interface GeoQuizDB extends DBSchema {
  sessions: {
    key: string;
    value: SessionRecord;
    indexes: { 'by-startedAt': number };
  };
  srItems: {
    key: string;
    value: SRItem;
    indexes: { 'by-dueAt': number };
  };
  prefs: {
    key: string;
    value: Prefs;
  };
}

export class IdbQuizStore implements QuizStore {
  readonly persistent = true;

  private constructor(private readonly db: IDBPDatabase<GeoQuizDB>) {}

  /** Open (creating/upgrading the schema as needed). Rejects if IndexedDB refuses. */
  static async open(): Promise<IdbQuizStore> {
    const db = await openDB<GeoQuizDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('sessions')) {
          const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
          sessions.createIndex('by-startedAt', 'startedAt');
        }
        if (!db.objectStoreNames.contains('srItems')) {
          const srItems = db.createObjectStore('srItems', { keyPath: 'itemKey' });
          srItems.createIndex('by-dueAt', 'dueAt');
        }
        if (!db.objectStoreNames.contains('prefs')) {
          db.createObjectStore('prefs');
        }
      },
    });
    return new IdbQuizStore(db);
  }

  async addSession(record: SessionRecord): Promise<void> {
    await this.db.put('sessions', record);
  }

  async getAllSessions(): Promise<SessionRecord[]> {
    // The index yields records already ordered by start time (ascending).
    return this.db.getAllFromIndex('sessions', 'by-startedAt');
  }

  async clearSessions(): Promise<void> {
    await this.db.clear('sessions');
  }

  async getPrefs(): Promise<Prefs | undefined> {
    return this.db.get('prefs', PREFS_KEY);
  }

  async savePrefs(prefs: Prefs): Promise<void> {
    await this.db.put('prefs', prefs, PREFS_KEY);
  }

  async getSRItem(itemKey: string): Promise<SRItem | undefined> {
    return this.db.get('srItems', itemKey);
  }

  async putSRItem(item: SRItem): Promise<void> {
    await this.db.put('srItems', item);
  }

  async getAllSRItems(): Promise<SRItem[]> {
    return this.db.getAll('srItems');
  }
}
