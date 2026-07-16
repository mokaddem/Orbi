import { describe, it, expect } from 'vitest';
import { computeRegionAccuracy, computeStats, dayKey, type RegionResolver } from './stats';
import type { SessionRecord } from '../data/persistence/types';
import type { QuestionResult } from './types';

function q(iso2: string, correct: boolean, answerMs = 1000): QuestionResult {
  return { itemKey: `flag-to-country:${iso2}`, countryIso2: iso2, correct, answerMs };
}

function record(over: Partial<SessionRecord> = {}): SessionRecord {
  const questions = over.questions ?? [q('BG', true)];
  return {
    id: 'id',
    startedAt: Date.UTC(2026, 0, 1, 10, 0, 0),
    finishedAt: Date.UTC(2026, 0, 1, 10, 1, 0),
    durationMs: 60_000,
    mode: 'flag-to-country',
    type: 'fixed',
    total: questions.length,
    correct: questions.filter((r) => r.correct).length,
    ...over,
    questions,
  };
}

describe('dayKey', () => {
  it('buckets by UTC calendar day', () => {
    expect(dayKey(Date.UTC(2026, 6, 7, 23, 59, 0))).toBe('2026-07-07');
    expect(dayKey(Date.UTC(2026, 6, 8, 0, 1, 0))).toBe('2026-07-08');
  });
});

describe('computeStats', () => {
  it('returns a zeroed overview for no sessions', () => {
    const s = computeStats([]);
    expect(s).toEqual({
      sessionCount: 0,
      totalQuestions: 0,
      totalCorrect: 0,
      totalStreakBonus: 0,
      totalStreakMilestones: 0,
      accuracy: 0,
      avgAnswerMs: 0,
      totalPlayMs: 0,
      byDay: [],
      mostMissed: [],
    });
  });

  it('sums the in-game streak-milestone bonus across sessions (append-only)', () => {
    const records = [
      // 5 correct in a row → bestStreak 5 → crosses milestones 3 & 5 → +25 (2 milestones).
      record({ questions: [q('A', true), q('B', true), q('C', true), q('D', true), q('E', true)] }),
      // 3 correct, a miss, 2 correct → bestStreak 3 → crosses milestone 3 → +10 (1 milestone).
      record({
        questions: [q('F', true), q('G', true), q('H', true), q('I', false), q('J', true)],
      }),
    ];
    const s = computeStats(records);
    expect(s.totalStreakBonus).toBe(35);
    expect(s.totalStreakMilestones).toBe(3);
  });

  it('aggregates totals, accuracy, average time, and play time', () => {
    const records = [
      record({ questions: [q('BG', true, 1000), q('FR', false, 3000)], durationMs: 4000 }),
      record({ questions: [q('DE', true, 2000)], durationMs: 2000 }),
    ];
    const s = computeStats(records);
    expect(s.sessionCount).toBe(2);
    expect(s.totalQuestions).toBe(3);
    expect(s.totalCorrect).toBe(2);
    expect(s.accuracy).toBeCloseTo(2 / 3);
    expect(s.avgAnswerMs).toBeCloseTo((1000 + 3000 + 2000) / 3);
    expect(s.totalPlayMs).toBe(6000);
  });

  it('groups sessions by UTC day, ascending', () => {
    const day1 = Date.UTC(2026, 0, 1, 12, 0, 0);
    const day2 = Date.UTC(2026, 0, 3, 8, 0, 0);
    const records = [
      record({ startedAt: day2, questions: [q('BG', true), q('FR', true)] }),
      record({ startedAt: day1, questions: [q('DE', false)] }),
      record({ startedAt: day1, questions: [q('IT', true)] }),
    ];
    const s = computeStats(records);
    expect(s.byDay).toEqual([
      { date: '2026-01-01', sessions: 2, questions: 2, correct: 1 },
      { date: '2026-01-03', sessions: 1, questions: 2, correct: 2 },
    ]);
  });

  it('ranks most-missed countries by misses, then attempts, then iso2', () => {
    const records = [
      // FR missed 3 times; DE missed twice (attempted 3×); BG missed twice (attempted 2×).
      record({
        questions: [
          q('FR', false),
          q('FR', false),
          q('FR', false),
          q('DE', false),
          q('DE', false),
          q('DE', true),
          q('BG', false),
          q('BG', false),
          q('IT', true), // never missed → excluded
        ],
      }),
    ];
    const s = computeStats(records);
    expect(s.mostMissed).toEqual([
      { iso2: 'FR', misses: 3, attempts: 3 },
      { iso2: 'DE', misses: 2, attempts: 3 }, // tie on misses with BG → more attempts first
      { iso2: 'BG', misses: 2, attempts: 2 },
    ]);
    expect(s.mostMissed.some((m) => m.iso2 === 'IT')).toBe(false);
  });

  it('is order-independent across records', () => {
    const a = record({ startedAt: 1000, questions: [q('BG', true)] });
    const b = record({ startedAt: 2000, questions: [q('FR', false)] });
    expect(computeStats([a, b])).toEqual(computeStats([b, a]));
  });
});

// A tiny geo stub so the tests don't depend on the real dataset. FR/DE are Western
// Europe, BG/RO Eastern Europe, JP Eastern Asia; anything else is unknown.
const REGIONS: Record<string, { region: string; subregion: string }> = {
  FR: { region: 'Europe', subregion: 'Western Europe' },
  DE: { region: 'Europe', subregion: 'Western Europe' },
  BG: { region: 'Europe', subregion: 'Eastern Europe' },
  RO: { region: 'Europe', subregion: 'Eastern Europe' },
  JP: { region: 'Asia', subregion: 'Eastern Asia' },
};
const regionOf: RegionResolver = (iso2) => REGIONS[iso2];

describe('computeRegionAccuracy', () => {
  it('returns nothing when there is no history', () => {
    expect(computeRegionAccuracy([], regionOf)).toEqual([]);
  });

  it('rolls answers up per sub-region and computes accuracy', () => {
    const records = [
      record({
        questions: [q('FR', true), q('DE', false), q('BG', false), q('RO', false)],
      }),
    ];
    const rollup = computeRegionAccuracy(records, regionOf);
    const west = rollup.find((r) => r.subregion === 'Western Europe')!;
    const east = rollup.find((r) => r.subregion === 'Eastern Europe')!;
    expect(west).toMatchObject({ region: 'Europe', attempts: 2, correct: 1, accuracy: 0.5 });
    expect(east).toMatchObject({ region: 'Europe', attempts: 2, correct: 0, accuracy: 0 });
  });

  it('aggregates across sessions and modes (mode in itemKey is irrelevant to the join)', () => {
    const records = [
      record({ startedAt: 1000, questions: [q('BG', true), q('BG', false)] }),
      record({
        startedAt: 2000,
        questions: [
          { itemKey: `map-highlight:BG`, countryIso2: 'BG', correct: false, answerMs: 1 },
        ],
      }),
    ];
    const east = computeRegionAccuracy(records, regionOf).find(
      (r) => r.subregion === 'Eastern Europe',
    )!;
    expect(east).toMatchObject({ attempts: 3, correct: 1 });
    expect(east.accuracy).toBeCloseTo(1 / 3);
  });

  it('orders weakest-first, then most-attempted, then sub-region', () => {
    const records = [
      record({
        questions: [
          // Eastern Europe: 0/2 (weakest)
          q('BG', false),
          q('RO', false),
          // Western Europe: 1/2
          q('FR', true),
          q('DE', false),
          // Eastern Asia: 1/1 (best)
          q('JP', true),
        ],
      }),
    ];
    const order = computeRegionAccuracy(records, regionOf).map((r) => r.subregion);
    expect(order).toEqual(['Eastern Europe', 'Western Europe', 'Eastern Asia']);
  });

  it('skips answers whose country cannot be resolved', () => {
    const records = [record({ questions: [q('FR', true), q('ZZ', false)] })];
    const rollup = computeRegionAccuracy(records, regionOf);
    expect(rollup).toHaveLength(1);
    expect(rollup[0]).toMatchObject({ subregion: 'Western Europe', attempts: 1 });
  });

  it('is order-independent across records', () => {
    const a = record({ startedAt: 1000, questions: [q('BG', true), q('FR', false)] });
    const b = record({ startedAt: 2000, questions: [q('RO', false), q('DE', true)] });
    expect(computeRegionAccuracy([a, b], regionOf)).toEqual(
      computeRegionAccuracy([b, a], regionOf),
    );
  });
});
