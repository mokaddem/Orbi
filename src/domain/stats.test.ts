import { describe, it, expect } from 'vitest';
import { computeStats, dayKey } from './stats';
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
      accuracy: 0,
      avgAnswerMs: 0,
      totalPlayMs: 0,
      byDay: [],
      mostMissed: [],
    });
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
