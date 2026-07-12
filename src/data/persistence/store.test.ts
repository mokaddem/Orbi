import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  IdbQuizStore,
  MemoryQuizStore,
  openStore,
  type AchievementUnlock,
  type CustomSet,
  type DailyResult,
  type Prefs,
  type QuizStore,
  type SessionRecord,
  type SRItem,
} from './index';

function record(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 'a',
    startedAt: 1000,
    finishedAt: 2000,
    durationMs: 1000,
    mode: 'flag-to-country',
    type: 'fixed',
    total: 1,
    correct: 1,
    questions: [{ itemKey: 'flag-to-country:BG', countryIso2: 'BG', correct: true, answerMs: 500 }],
    ...over,
  };
}

const prefs: Prefs = {
  language: 'fr',
  survivalLives: 5,
  fixedLength: 20,
  choicesPerQuestion: 6,
  mapProjection: 'equalEarth',
  reduceMotion: true,
  sound: true,
};

const srItem: SRItem = {
  itemKey: 'flag-to-country:BG',
  repetitions: 2,
  easeFactor: 2.6,
  intervalDays: 6,
  dueAt: 123456,
  lapses: 1,
};

/** The behavioural contract every `QuizStore` implementation must satisfy. */
function contractTests(name: string, makeStore: () => Promise<QuizStore>): void {
  describe(name, () => {
    let store: QuizStore;
    beforeEach(async () => {
      store = await makeStore();
    });

    it('round-trips a session', async () => {
      await store.addSession(record({ id: 's1' }));
      const all = await store.getAllSessions();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('s1');
      expect(all[0].questions[0].countryIso2).toBe('BG');
    });

    it('returns sessions ordered by startedAt', async () => {
      await store.addSession(record({ id: 'late', startedAt: 3000 }));
      await store.addSession(record({ id: 'early', startedAt: 1000 }));
      await store.addSession(record({ id: 'mid', startedAt: 2000 }));
      const ids = (await store.getAllSessions()).map((s) => s.id);
      expect(ids).toEqual(['early', 'mid', 'late']);
    });

    it('clears sessions', async () => {
      await store.addSession(record({ id: 's1' }));
      await store.clearSessions();
      expect(await store.getAllSessions()).toEqual([]);
    });

    it('round-trips prefs (last write wins)', async () => {
      expect(await store.getPrefs()).toBeUndefined();
      await store.savePrefs(prefs);
      expect(await store.getPrefs()).toEqual(prefs);
      await store.savePrefs({ ...prefs, fixedLength: 15 });
      expect((await store.getPrefs())?.fixedLength).toBe(15);
    });

    it('round-trips SR items keyed by itemKey', async () => {
      expect(await store.getSRItem(srItem.itemKey)).toBeUndefined();
      await store.putSRItem(srItem);
      expect(await store.getSRItem(srItem.itemKey)).toEqual(srItem);
      await store.putSRItem({ ...srItem, lapses: 2 });
      expect(await store.getAllSRItems()).toHaveLength(1);
      expect((await store.getSRItem(srItem.itemKey))?.lapses).toBe(2);
    });

    it('clears SR items without touching sessions', async () => {
      await store.addSession(record({ id: 's1' }));
      await store.putSRItem(srItem);
      await store.putSRItem({ ...srItem, itemKey: 'flag-to-country:RO' });

      await store.clearSRItems();

      expect(await store.getAllSRItems()).toEqual([]);
      expect(await store.getSRItem(srItem.itemKey)).toBeUndefined();
      // History is a separate concern and must survive a training reset.
      expect(await store.getAllSessions()).toHaveLength(1);
    });

    it('round-trips the daily result (last write wins) and clears it', async () => {
      expect(await store.getDailyResult()).toBeUndefined();
      const daily: DailyResult = {
        date: '2026-07-08',
        completed: true,
        total: 10,
        correct: 7,
        mode: 'flag-to-country',
      };
      await store.saveDailyResult(daily);
      expect(await store.getDailyResult()).toEqual(daily);
      // A replay overwrites the single row with the latest attempt.
      await store.saveDailyResult({ ...daily, correct: 9 });
      expect((await store.getDailyResult())?.correct).toBe(9);

      await store.clearDailyResult();
      expect(await store.getDailyResult()).toBeUndefined();
    });

    it('round-trips achievements (last write wins per id) and clears them', async () => {
      expect(await store.getAchievements()).toEqual([]);
      const first: AchievementUnlock = { id: 'first-round', unlockedAt: 1000 };
      const streak: AchievementUnlock = { id: 'streak-7', unlockedAt: 2000 };
      await store.putAchievement(first);
      await store.putAchievement(streak);
      expect((await store.getAchievements()).map((a) => a.id).sort()).toEqual([
        'first-round',
        'streak-7',
      ]);
      // Re-putting the same id updates in place rather than duplicating.
      await store.putAchievement({ ...first, unlockedAt: 9999 });
      const all = await store.getAchievements();
      expect(all).toHaveLength(2);
      expect(all.find((a) => a.id === 'first-round')?.unlockedAt).toBe(9999);

      await store.clearAchievements();
      expect(await store.getAchievements()).toEqual([]);
    });

    it('keeps achievements separate from SR and history resets', async () => {
      await store.addSession(record({ id: 's1' }));
      await store.putSRItem(srItem);
      await store.putAchievement({ id: 'first-round', unlockedAt: 1000 });

      await store.clearSRItems();
      await store.clearSessions();

      // A training/history reset must not silently wipe earned badges.
      expect((await store.getAchievements()).map((a) => a.id)).toEqual(['first-round']);
    });

    it('round-trips custom sets (last write wins per id), deletes and clears them', async () => {
      expect(await store.getCustomSets()).toEqual([]);
      const balkans: CustomSet = {
        id: 'set1',
        name: 'Balkan flags',
        iso2: ['RS', 'HR', 'AL'],
        createdAt: 1000,
        updatedAt: 1000,
      };
      const capitals: CustomSet = {
        id: 'set2',
        name: 'Tricky capitals',
        iso2: ['KZ', 'MM'],
        createdAt: 2000,
        updatedAt: 2000,
      };
      await store.putCustomSet(balkans);
      await store.putCustomSet(capitals);
      expect((await store.getCustomSets()).map((s) => s.id).sort()).toEqual(['set1', 'set2']);

      // Re-putting the same id updates in place (rename + new members) rather than duplicating.
      await store.putCustomSet({ ...balkans, name: 'Balkans', iso2: ['RS', 'HR', 'AL', 'BA'] });
      const sets = await store.getCustomSets();
      expect(sets).toHaveLength(2);
      const updated = sets.find((s) => s.id === 'set1');
      expect(updated?.name).toBe('Balkans');
      expect(updated?.iso2).toEqual(['RS', 'HR', 'AL', 'BA']);

      await store.deleteCustomSet('set1');
      expect((await store.getCustomSets()).map((s) => s.id)).toEqual(['set2']);

      await store.clearCustomSets();
      expect(await store.getCustomSets()).toEqual([]);
    });

    it('keeps custom sets isolated from the mutation returned by getCustomSets', async () => {
      await store.putCustomSet({
        id: 'set1',
        name: 'X',
        iso2: ['RS', 'HR'],
        createdAt: 1,
        updatedAt: 1,
      });
      const fetched = await store.getCustomSets();
      fetched[0].iso2.push('MUTATED');
      // The store's backing row must not have absorbed the caller's mutation.
      expect((await store.getCustomSets())[0].iso2).toEqual(['RS', 'HR']);
    });

    it('keeps custom sets separate from SR and history resets', async () => {
      await store.addSession(record({ id: 's1' }));
      await store.putSRItem(srItem);
      await store.putCustomSet({
        id: 'set1',
        name: 'Kept',
        iso2: ['RS'],
        createdAt: 1,
        updatedAt: 1,
      });

      await store.clearSRItems();
      await store.clearSessions();
      await store.clearAchievements();

      // Saved sets are authored content, not progress — the resets must leave them intact.
      expect((await store.getCustomSets()).map((s) => s.name)).toEqual(['Kept']);
    });
  });
}

// A fresh in-memory IndexedDB per test keeps IDB-backed cases isolated.
beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

contractTests('MemoryQuizStore', async () => new MemoryQuizStore());
contractTests('IdbQuizStore', async () => IdbQuizStore.open());

describe('IdbQuizStore persistence', () => {
  it('survives reopening the database (simulated restart)', async () => {
    const first = await IdbQuizStore.open();
    await first.addSession(record({ id: 'kept' }));
    await first.savePrefs(prefs);
    await first.putCustomSet({
      id: 'set1',
      name: 'Kept',
      iso2: ['RS', 'HR'],
      createdAt: 1,
      updatedAt: 1,
    });

    // A new instance over the same DB name sees the previously written data.
    const second = await IdbQuizStore.open();
    expect((await second.getAllSessions()).map((s) => s.id)).toEqual(['kept']);
    expect(await second.getPrefs()).toEqual(prefs);
    expect((await second.getCustomSets()).map((s) => s.name)).toEqual(['Kept']);
  });
});

describe('openStore', () => {
  const original = globalThis.indexedDB;
  afterEach(() => {
    globalThis.indexedDB = original;
  });

  it('returns a persistent store when IndexedDB is available', async () => {
    globalThis.indexedDB = new IDBFactory();
    const store = await openStore();
    expect(store.persistent).toBe(true);
  });

  it('falls back to a non-persistent in-memory store when IndexedDB is absent', async () => {
    // @ts-expect-error — simulate an environment without IndexedDB.
    globalThis.indexedDB = undefined;
    const store = await openStore();
    expect(store.persistent).toBe(false);
    // Still fully usable, just not durable.
    await store.addSession(record({ id: 's1' }));
    expect(await store.getAllSessions()).toHaveLength(1);
  });
});
