// IndexedDB-backed store (Phase 6), via the tiny `idb` wrapper.
//
// Object stores mirror the persisted data model: `sessions` (play history, keyed by id,
// indexed by start time), `srItems` (SM-2 state, keyed by itemKey, indexed by due date so
// Phase 7 can query what's due), `prefs` (a single row), `dailyChallenge` (Phase 15 — the
// most recent Daily Challenge result, a single row), and `achievements` (Phase 16 — one row
// per earned badge, keyed by badge id, recording when it unlocked). The `upgrade` callback
// creates only the missing stores, so bumping the version to add a store leaves existing
// history / SR / prefs data intact.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  AchievementUnlock,
  CustomSet,
  DailyResult,
  GrandmasterRecord,
  IdentityRecord,
  Prefs,
  ProgressionState,
  QuizStore,
  SessionRecord,
  SRItem,
} from './types';

const DB_NAME = 'geo-quiz';
// v2 (Phase 15): add `dailyChallenge`. v3 (Phase 16): add `achievements`. v4 (Phase 27):
// add `customSets`. v5 (Phase 43): add `progression`. v6 (Phase 45): add `grandmaster`.
// v7 (Phase 51): add `identity`. Upgrades are additive (only missing stores are created),
// so existing data (history / SR / prefs / …) is always preserved across a bump.
const DB_VERSION = 7;

/** The single prefs row lives under a fixed, out-of-line key. */
const PREFS_KEY = 'app';
/** The single Daily Challenge result row, likewise under a fixed key. */
const DAILY_KEY = 'current';
/** The single progression (rank/XP) row, likewise under a fixed key. */
const PROGRESSION_KEY = 'current';
/** The single identity row (Phase 51), likewise under a fixed key. */
const IDENTITY_KEY = 'current';

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
  dailyChallenge: {
    key: string;
    value: DailyResult;
  };
  achievements: {
    key: string;
    value: AchievementUnlock;
  };
  customSets: {
    key: string;
    value: CustomSet;
  };
  progression: {
    key: string;
    value: ProgressionState;
  };
  grandmaster: {
    key: string;
    value: GrandmasterRecord;
  };
  identity: {
    key: string;
    value: IdentityRecord;
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
        if (!db.objectStoreNames.contains('dailyChallenge')) {
          db.createObjectStore('dailyChallenge');
        }
        if (!db.objectStoreNames.contains('achievements')) {
          db.createObjectStore('achievements', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('customSets')) {
          db.createObjectStore('customSets', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('progression')) {
          db.createObjectStore('progression');
        }
        if (!db.objectStoreNames.contains('grandmaster')) {
          db.createObjectStore('grandmaster', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('identity')) {
          db.createObjectStore('identity');
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

  async clearSRItems(): Promise<void> {
    await this.db.clear('srItems');
  }

  async getDailyResult(): Promise<DailyResult | undefined> {
    return this.db.get('dailyChallenge', DAILY_KEY);
  }

  async saveDailyResult(result: DailyResult): Promise<void> {
    await this.db.put('dailyChallenge', result, DAILY_KEY);
  }

  async clearDailyResult(): Promise<void> {
    await this.db.delete('dailyChallenge', DAILY_KEY);
  }

  async getAchievements(): Promise<AchievementUnlock[]> {
    return this.db.getAll('achievements');
  }

  async putAchievement(unlock: AchievementUnlock): Promise<void> {
    await this.db.put('achievements', unlock);
  }

  async clearAchievements(): Promise<void> {
    await this.db.clear('achievements');
  }

  async getCustomSets(): Promise<CustomSet[]> {
    return this.db.getAll('customSets');
  }

  async putCustomSet(set: CustomSet): Promise<void> {
    await this.db.put('customSets', set);
  }

  async deleteCustomSet(id: string): Promise<void> {
    await this.db.delete('customSets', id);
  }

  async clearCustomSets(): Promise<void> {
    await this.db.clear('customSets');
  }

  async getProgression(): Promise<ProgressionState | undefined> {
    return this.db.get('progression', PROGRESSION_KEY);
  }

  async saveProgression(state: ProgressionState): Promise<void> {
    await this.db.put('progression', state, PROGRESSION_KEY);
  }

  async clearProgression(): Promise<void> {
    await this.db.delete('progression', PROGRESSION_KEY);
  }

  async getGrandmasterRecords(): Promise<GrandmasterRecord[]> {
    return this.db.getAll('grandmaster');
  }

  async putGrandmasterRecord(record: GrandmasterRecord): Promise<void> {
    await this.db.put('grandmaster', record);
  }

  async clearGrandmaster(): Promise<void> {
    await this.db.clear('grandmaster');
  }

  async getIdentity(): Promise<IdentityRecord | undefined> {
    return this.db.get('identity', IDENTITY_KEY);
  }

  async saveIdentity(identity: IdentityRecord): Promise<void> {
    await this.db.put('identity', identity, IDENTITY_KEY);
  }

  async clearIdentity(): Promise<void> {
    await this.db.delete('identity', IDENTITY_KEY);
  }
}
