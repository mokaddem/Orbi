import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import type { SessionSummary } from '../../domain';
import { setLocale } from '../../i18n';
import type { QuestionResult } from '../../domain';
import {
  clearHistory,
  initPersistence,
  loadSessions,
  loadStats,
  loadTrainingItems,
  loadTrainingPlan,
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
