import { describe, it, expect } from 'vitest';
import {
  computeXp,
  sessionXp,
  rankForXp,
  RANKS,
  XP_PER_CORRECT,
  XP_PER_QUESTION,
  XP_PER_SESSION,
  XP_PER_STREAK_DAY,
  XP_PER_BADGE,
  type XpInput,
} from './xp';
import type { QuestionResult } from './types';

/** A minimal XpInput; override any rollup field per test. */
function input(over: Partial<XpInput> = {}): XpInput {
  return {
    stats: { totalCorrect: 0, totalQuestions: 0, sessionCount: 0 },
    streak: { longest: 0 },
    achievementsUnlocked: 0,
    ...over,
  };
}

/** A run of `n` results, `correct` of them right (rest wrong). */
function results(n: number, correct: number): QuestionResult[] {
  return Array.from({ length: n }, (_, i) => ({
    itemKey: `flag-to-country:C${i}`,
    countryIso2: `C${i}`,
    correct: i < correct,
    answerMs: 1000,
  }));
}

describe('computeXp — per source', () => {
  it('is zero for a brand-new player', () => {
    const { total, bySource } = computeXp(input());
    expect(total).toBe(0);
    expect(bySource.every((s) => s.xp === 0 && s.count === 0)).toBe(true);
  });

  it('weights each source by its constant', () => {
    const r = computeXp(
      input({
        stats: { totalCorrect: 5, totalQuestions: 8, sessionCount: 2 },
        streak: { longest: 3 },
        achievementsUnlocked: 4,
      }),
    );
    const by = Object.fromEntries(r.bySource.map((s) => [s.key, s.xp]));
    expect(by.correct).toBe(5 * XP_PER_CORRECT);
    expect(by.questions).toBe(8 * XP_PER_QUESTION);
    expect(by.sessions).toBe(2 * XP_PER_SESSION);
    expect(by.streak).toBe(3 * XP_PER_STREAK_DAY);
    expect(by.badges).toBe(4 * XP_PER_BADGE);
    expect(r.total).toBe(
      5 * XP_PER_CORRECT +
        8 * XP_PER_QUESTION +
        2 * XP_PER_SESSION +
        3 * XP_PER_STREAK_DAY +
        4 * XP_PER_BADGE,
    );
  });

  it('exposes sources in a stable display order with their counts', () => {
    const r = computeXp(input({ stats: { totalCorrect: 1, totalQuestions: 2, sessionCount: 1 } }));
    expect(r.bySource.map((s) => s.key)).toEqual([
      'correct',
      'questions',
      'sessions',
      'streak',
      'badges',
    ]);
    expect(r.bySource.find((s) => s.key === 'questions')?.count).toBe(2);
  });

  it('floors negative / fractional rollups to non-negative integers', () => {
    const r = computeXp(
      input({
        stats: { totalCorrect: -3, totalQuestions: 2.9, sessionCount: 1 },
        streak: { longest: -1 },
      }),
    );
    expect(r.bySource.find((s) => s.key === 'correct')?.xp).toBe(0);
    expect(r.bySource.find((s) => s.key === 'questions')?.xp).toBe(2 * XP_PER_QUESTION);
    expect(r.bySource.find((s) => s.key === 'streak')?.xp).toBe(0);
  });
});

describe('computeXp — monotonicity (the crux: XP must never go down)', () => {
  it('never decreases when any single count rises', () => {
    const base = computeXp(
      input({
        stats: { totalCorrect: 10, totalQuestions: 15, sessionCount: 3 },
        streak: { longest: 5 },
        achievementsUnlocked: 2,
      }),
    ).total;
    const more = [
      input({
        stats: { totalCorrect: 11, totalQuestions: 15, sessionCount: 3 },
        streak: { longest: 5 },
        achievementsUnlocked: 2,
      }),
      input({
        stats: { totalCorrect: 10, totalQuestions: 16, sessionCount: 3 },
        streak: { longest: 5 },
        achievementsUnlocked: 2,
      }),
      input({
        stats: { totalCorrect: 10, totalQuestions: 15, sessionCount: 4 },
        streak: { longest: 5 },
        achievementsUnlocked: 2,
      }),
      input({
        stats: { totalCorrect: 10, totalQuestions: 15, sessionCount: 3 },
        streak: { longest: 6 },
        achievementsUnlocked: 2,
      }),
      input({
        stats: { totalCorrect: 10, totalQuestions: 15, sessionCount: 3 },
        streak: { longest: 5 },
        achievementsUnlocked: 3,
      }),
    ];
    for (const inp of more) expect(computeXp(inp).total).toBeGreaterThan(base);
  });

  it('does NOT drop when live mastery lapses (XP reads only append-only signals)', () => {
    // A lapse demotes a country (Phase 16/41) but leaves history + earned badges untouched: same
    // sessions/answers/badges → same XP. computeXp has no mastery input at all, by design.
    const stable = input({
      stats: { totalCorrect: 40, totalQuestions: 60, sessionCount: 6 },
      streak: { longest: 9 },
      achievementsUnlocked: 5,
    });
    expect(computeXp(stable).total).toBe(computeXp(stable).total);
    expect('mastery' in stable).toBe(false);
  });
});

describe('sessionXp — the Summary "+N XP"', () => {
  it('is zero for an empty run', () => {
    expect(sessionXp([])).toBe(0);
  });

  it('counts questions + correct + a session bonus', () => {
    // 10 questions, 7 correct.
    expect(sessionXp(results(10, 7))).toBe(
      10 * XP_PER_QUESTION + 7 * XP_PER_CORRECT + XP_PER_SESSION,
    );
  });

  it("exactly matches the run's contribution to computeXp play sources", () => {
    const run = results(8, 6);
    const before = computeXp(
      input({ stats: { totalCorrect: 0, totalQuestions: 0, sessionCount: 0 } }),
    ).total;
    const after = computeXp(
      input({ stats: { totalCorrect: 6, totalQuestions: 8, sessionCount: 1 } }),
    ).total;
    expect(after - before).toBe(sessionXp(run));
  });
});

describe('rankForXp — ladder boundaries', () => {
  it('is Novice at 0 XP, progressing toward Scout', () => {
    const p = rankForXp(0);
    expect(p.rank.key).toBe('novice');
    expect(p.rank.index).toBe(0);
    expect(p.next?.key).toBe('scout');
    expect(p.xpIntoRank).toBe(0);
    expect(p.fraction).toBe(0);
  });

  it('lands exactly on a threshold as the new rank with 0 into it', () => {
    const scout = RANKS[1];
    const p = rankForXp(scout.minXp);
    expect(p.rank.key).toBe('scout');
    expect(p.xpIntoRank).toBe(0);
    expect(p.xpToNext).toBe(RANKS[2].minXp - scout.minXp);
  });

  it('stays on a rank one XP below the next threshold', () => {
    const p = rankForXp(RANKS[2].minXp - 1);
    expect(p.rank.key).toBe('scout');
    expect(p.xpToNext).toBe(1);
    expect(p.fraction).toBeGreaterThan(0.99);
    expect(p.fraction).toBeLessThanOrEqual(1);
  });

  it('reports the correct fraction mid-rank', () => {
    // Halfway between Wanderer (1000) and Pathfinder (2200) = 1600.
    const p = rankForXp(1600);
    expect(p.rank.key).toBe('wanderer');
    expect(p.rankSpan).toBe(1200);
    expect(p.xpIntoRank).toBe(600);
    expect(p.fraction).toBeCloseTo(0.5, 5);
  });

  it('caps at the top rank with no next and a full bar', () => {
    const top = RANKS[RANKS.length - 1];
    const p = rankForXp(top.minXp + 999_999);
    expect(p.rank.key).toBe('legend');
    expect(p.next).toBeNull();
    expect(p.xpToNext).toBe(0);
    expect(p.fraction).toBe(1);
  });

  it('floors negatives to Novice', () => {
    expect(rankForXp(-500).rank.key).toBe('novice');
  });

  it('every rank is reachable in ascending, strictly-increasing order', () => {
    for (let i = 0; i < RANKS.length; i++) {
      expect(rankForXp(RANKS[i].minXp).rank.index).toBe(i);
      if (i > 0) expect(RANKS[i].minXp).toBeGreaterThan(RANKS[i - 1].minXp);
    }
    expect(RANKS[0].minXp).toBe(0);
    expect(RANKS).toHaveLength(10);
  });
});
