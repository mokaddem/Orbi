import { describe, it, expect } from 'vitest';
import { computeWeeklyRecap, localWeekStart } from './recap';
import type { SessionRecord, SRItem } from '../data/persistence/types';
import type { QuestionResult } from './types';

const DAY = 86_400_000;

function q(correct: boolean): QuestionResult {
  return { itemKey: 'flag-to-country:FR', countryIso2: 'FR', correct, answerMs: 1000 };
}

function session(startedAt: number, correct: number, total: number): SessionRecord {
  return {
    id: `s${startedAt}`,
    startedAt,
    finishedAt: startedAt,
    durationMs: 0,
    mode: 'flag-to-country',
    type: 'fixed',
    total,
    correct,
    questions: [
      ...Array.from({ length: correct }, () => q(true)),
      ...Array.from({ length: total - correct }, () => q(false)),
    ],
  };
}

function sr(itemKey: string, lastReviewedAt: number, over: Partial<SRItem> = {}): SRItem {
  return {
    itemKey,
    repetitions: 3,
    easeFactor: 2.5,
    intervalDays: 30,
    dueAt: lastReviewedAt + 30 * DAY, // future → mastered
    lapses: 0,
    lastReviewedAt,
    ...over,
  };
}

describe('localWeekStart', () => {
  it('lands on the local Monday at 00:00', () => {
    const start = new Date(localWeekStart(new Date(2026, 6, 8, 15, 30).getTime()));
    expect(start.getDay()).toBe(1); // Monday
    expect([start.getHours(), start.getMinutes(), start.getSeconds()]).toEqual([0, 0, 0]);
  });

  it('rolls a Sunday back to the Monday six days earlier', () => {
    // Find a Sunday, then check the week start is the Monday before it.
    let sunday = new Date(2026, 6, 12, 9, 0); // pick a date…
    while (sunday.getDay() !== 0) sunday = new Date(sunday.getTime() + DAY); // …advance to Sunday
    const start = new Date(localWeekStart(sunday.getTime()));
    expect(start.getDay()).toBe(1);
    expect(start.getTime()).toBeLessThanOrEqual(sunday.getTime());
    // Sunday is the 7th day of the week → 6 days after its Monday.
    expect(Math.round((sunday.setHours(0, 0, 0, 0) - start.getTime()) / DAY)).toBe(6);
  });

  it('treats a Monday as its own week start', () => {
    let monday = new Date(2026, 6, 1, 8, 0);
    while (monday.getDay() !== 1) monday = new Date(monday.getTime() + DAY);
    const start = new Date(localWeekStart(monday.getTime()));
    expect(start.getDay()).toBe(1);
    expect(Math.round((monday.setHours(0, 0, 0, 0) - start.getTime()) / DAY)).toBe(0);
  });
});

describe('computeWeeklyRecap', () => {
  const now = new Date(2026, 6, 8, 10, 0).getTime(); // arbitrary mid-week moment
  const weekStart = localWeekStart(now);

  it('is all-zero for no history', () => {
    expect(computeWeeklyRecap([], { now })).toMatchObject({
      sessions: 0,
      questions: 0,
      correct: 0,
      accuracy: 0,
      masteredThisWeek: 0,
      currentStreak: 0,
    });
  });

  it('counts only sessions within [weekStart, now]', () => {
    const sessions = [
      session(weekStart - 1, 5, 5), // just before the window → excluded
      session(weekStart, 8, 10), // exactly at the window start → included
      session(now, 9, 10), // right at now → included
      session(now + DAY, 10, 10), // future (shouldn't happen) → excluded
    ];
    const recap = computeWeeklyRecap(sessions, { now });
    expect(recap.sessions).toBe(2);
    expect(recap.questions).toBe(20);
    expect(recap.correct).toBe(17);
    expect(recap.accuracy).toBeCloseTo(17 / 20);
  });

  it('approximates newly-mastered as mastered items reviewed this week', () => {
    const srItems = [
      sr('flag-to-country:FR', weekStart + DAY), // reviewed this week → counted
      sr('map-locate:DE', weekStart - DAY), // mastered but reviewed last week → not counted
      sr('flag-to-country:JP', now, { repetitions: 1, dueAt: now }), // not mastered → ignored
    ];
    expect(computeWeeklyRecap([], { now, srItems }).masteredThisWeek).toBe(1);
  });

  it('counts a country once even if several of its modes were mastered this week', () => {
    const srItems = [
      sr('flag-to-country:FR', weekStart + DAY),
      sr('map-highlight:FR', weekStart + 2 * DAY),
    ];
    expect(computeWeeklyRecap([], { now, srItems }).masteredThisWeek).toBe(1);
  });

  it('ignores capital & language mastery — country mastery only (kept separate)', () => {
    const srItems = [
      sr('capital-to-country:FR', weekStart + DAY),
      sr('country-to-languages:JP', weekStart + 2 * DAY),
    ];
    expect(computeWeeklyRecap([], { now, srItems }).masteredThisWeek).toBe(0);
  });

  it('reports the streak over all history, not just this week', () => {
    // Three consecutive local days ending today → current streak 3.
    const sessions = [session(now - 2 * DAY, 1, 1), session(now - DAY, 1, 1), session(now, 1, 1)];
    const recap = computeWeeklyRecap(sessions, { now });
    expect(recap.currentStreak).toBe(3);
    expect(recap.longestStreak).toBeGreaterThanOrEqual(3);
  });
});
