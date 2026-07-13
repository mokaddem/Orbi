import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import type { SessionSummary } from '../../domain';
import { setLocale } from '../../i18n';
import type { QuestionResult } from '../../domain';
import {
  clearHistory,
  clearTraining,
  initPersistence,
  loadAchievements,
  loadMastery,
  loadSessions,
  loadStats,
  loadTrainingItems,
  loadTrainingPlan,
  loadWeeklyRecap,
  persistent,
  prefs,
  recordAnswer,
  saveSession,
  storageReady,
  summaryToRecord,
} from './persistence';

function summary(over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    mode: 'flag-to-country',
    type: 'fixed',
    total: 2,
    correct: 1,
    accuracy: 0.5,
    bestStreak: 1,
    startedAt: 1000,
    finishedAt: 5000,
    durationMs: 4000,
    missed: [],
    results: [
      { itemKey: 'flag-to-country:BG', countryIso2: 'BG', correct: true, answerMs: 500 },
      { itemKey: 'flag-to-country:FR', countryIso2: 'FR', correct: false, answerMs: 900 },
    ],
    ...over,
  };
}

describe('summaryToRecord', () => {
  it('maps a summary onto a persisted record', () => {
    const rec = summaryToRecord(summary(), 'fixed-id');
    expect(rec).toEqual({
      id: 'fixed-id',
      startedAt: 1000,
      finishedAt: 5000,
      durationMs: 4000,
      mode: 'flag-to-country',
      type: 'fixed',
      total: 2,
      correct: 1,
      questions: summary().results,
    });
  });

  it('includes the region filter only when present', () => {
    expect(summaryToRecord(summary(), 'a')).not.toHaveProperty('regionFilter');
    const filtered = summaryToRecord(summary({ regionFilter: { region: 'Europe' } }), 'b');
    expect(filtered.regionFilter).toEqual({ region: 'Europe' });
  });

  it('copies the region filter into a fresh object (no Svelte $state proxy leaks to IndexedDB)', () => {
    // Recommendation-/daily-driven configs carry a filter sourced from a $state proxy;
    // IndexedDB's structured clone rejects proxies, so the record must own a plain copy.
    const src = { region: 'Europe', subregion: 'Eastern Europe' };
    const rec = summaryToRecord(summary({ regionFilter: src }), 'c');
    expect(rec.regionFilter).toEqual(src);
    expect(rec.regionFilter).not.toBe(src);
  });

  it('generates an id when none is supplied', () => {
    const rec = summaryToRecord(summary());
    expect(rec.id).toBeTruthy();
    expect(typeof rec.id).toBe('string');
  });
});

describe('persistence controller (IndexedDB-backed)', () => {
  beforeAll(async () => {
    await initPersistence();
  });

  beforeEach(async () => {
    await clearHistory();
  });

  it('reports a persistent store and becomes ready', () => {
    expect(get(persistent)).toBe(true);
    expect(get(storageReady)).toBe(true);
  });

  it('saves a finished session and reflects it in stats', async () => {
    await saveSession(summary());
    const sessions = await loadSessions();
    expect(sessions).toHaveLength(1);

    const stats = await loadStats();
    expect(stats.sessionCount).toBe(1);
    expect(stats.totalQuestions).toBe(2);
    expect(stats.totalCorrect).toBe(1);
    expect(stats.mostMissed.map((m) => m.iso2)).toEqual(['FR']);
  });

  it('clears history without touching prefs', async () => {
    await saveSession(summary());
    await clearHistory();
    expect(await loadSessions()).toEqual([]);
    expect(get(prefs)).toBeTruthy();
  });

  it('mirrors the active locale into prefs', () => {
    setLocale('en');
    expect(get(prefs).language).toBe('en');
    setLocale('fr');
    expect(get(prefs).language).toBe('fr');
    setLocale('en');
  });
});

function answer(over: Partial<QuestionResult> = {}): QuestionResult {
  return {
    itemKey: 'flag-to-country:BG',
    countryIso2: 'BG',
    correct: true,
    answerMs: 1000,
    ...over,
  };
}

describe('spaced repetition wiring', () => {
  beforeAll(async () => {
    await initPersistence();
  });

  it('records a correct answer as SR state that is not immediately due', async () => {
    const key = 'flag-to-country:SE';
    await recordAnswer(answer({ itemKey: key, countryIso2: 'SE', correct: true, answerMs: 500 }));
    // A correct answer schedules ~1 day out, so it is not trainable right now …
    expect(await loadTrainingItems({ mode: 'flag-to-country' })).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ iso2: 'SE' })]),
    );
    // … but it is due (and therefore trainable) once its interval has elapsed.
    const soon = await loadTrainingItems({ now: Date.now() + 2 * 86_400_000 });
    expect(soon.map((i) => i.iso2)).toContain('SE');
  });

  it('surfaces a missed item as due with a lapse (train-my-mistakes core)', async () => {
    const key = 'map-highlight:RO';
    await recordAnswer(answer({ itemKey: key, countryIso2: 'RO', correct: false, answerMs: 3000 }));
    const items = await loadTrainingItems({ mode: 'map-highlight' });
    const ro = items.find((i) => i.iso2 === 'RO');
    expect(ro).toBeTruthy();
    expect(ro!.due).toBe(true);
    expect(ro!.srItem.lapses).toBe(1);
  });

  it('accumulates lapses across repeated misses of the same item (serialized writes)', async () => {
    const key = 'map-highlight:BG';
    await Promise.all([
      recordAnswer(answer({ itemKey: key, countryIso2: 'BG', correct: false })),
      recordAnswer(answer({ itemKey: key, countryIso2: 'BG', correct: false })),
      recordAnswer(answer({ itemKey: key, countryIso2: 'BG', correct: false })),
    ]);
    const items = await loadTrainingItems({ mode: 'map-highlight' });
    const bg = items.find((i) => i.iso2 === 'BG');
    expect(bg!.srItem.lapses).toBe(3); // no lost updates despite concurrent calls
  });

  it('builds a training plan focused on the mode with the most weak items', async () => {
    // The two map-highlight misses above dominate over a single flag miss.
    await recordAnswer(
      answer({ itemKey: 'flag-to-country:FR', countryIso2: 'FR', correct: false }),
    );
    const plan = await loadTrainingPlan();
    expect(plan).toBeTruthy();
    expect(plan!.mode).toBe('map-highlight');
    expect(plan!.iso2s).toEqual(expect.arrayContaining(['BG', 'RO']));
  });
});

describe('progress & rewards wiring (Phase 16)', () => {
  beforeAll(async () => {
    await initPersistence();
  });

  beforeEach(async () => {
    // Isolate from other describes: a clean history + SR + badge slate each test.
    await clearHistory();
    await clearTraining();
  });

  it('rolls SR items into the per-family mastery meter (both directions ⇒ family mastered)', async () => {
    // Two correct answers push SM-2 to repetitions 2, interval 6d (future) → that item mastered.
    const master = async (key: string) => {
      await recordAnswer(answer({ itemKey: key, countryIso2: 'SE', correct: true, answerMs: 500 }));
      await recordAnswer(answer({ itemKey: key, countryIso2: 'SE', correct: true, answerMs: 500 }));
    };
    const flags = (m: Awaited<ReturnType<typeof loadMastery>>) =>
      m.overall.families.find((f) => f.family === 'flags')!;

    // One direction only → the Flags family is still just "learning", not mastered.
    await master('flag-to-country:SE');
    let mastery = await loadMastery();
    expect(mastery.overall.total).toBe(195); // full-world denominator
    expect(flags(mastery).learning).toBeGreaterThanOrEqual(1);
    expect(flags(mastery).mastered).toBe(0);

    // Master the other direction too → the Flags family now counts Sweden as mastered.
    await master('country-to-flag:SE');
    mastery = await loadMastery();
    expect(flags(mastery).mastered).toBeGreaterThanOrEqual(1);
    const europe = mastery.byRegion.find((r) => r.region === 'Europe');
    expect(europe!.families.find((f) => f.family === 'flags')!.mastered).toBeGreaterThanOrEqual(1);
  });

  it('summarizes the current week from saved sessions', async () => {
    const now = Date.now();
    await saveSession(summary({ startedAt: now, finishedAt: now, total: 2, correct: 1 }));
    const recap = await loadWeeklyRecap(now);
    expect(recap.sessions).toBe(1);
    expect(recap.questions).toBe(2);
    expect(recap.correct).toBe(1);
  });

  it('unlocks a badge, celebrates it once, then keeps it earned without re-flagging', async () => {
    await saveSession(summary());

    const first = await loadAchievements();
    const fr1 = first.find((a) => a.id === 'first-round')!;
    expect(fr1.unlocked).toBe(true);
    expect(fr1.justUnlocked).toBe(true); // celebrated on the load it first crossed the line
    expect(fr1.unlockedAt).toBeTypeOf('number');

    const second = await loadAchievements();
    const fr2 = second.find((a) => a.id === 'first-round')!;
    expect(fr2.unlocked).toBe(true);
    expect(fr2.justUnlocked).toBe(false); // persisted now → no repeat celebration
  });

  it('clears earned badges when history is cleared', async () => {
    await saveSession(summary());
    await loadAchievements(); // persists first-round
    await clearHistory(); // wipes sessions + badges together

    const after = await loadAchievements();
    expect(after.find((a) => a.id === 'first-round')!.unlocked).toBe(false);
  });
});
