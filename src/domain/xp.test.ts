import { describe, it, expect } from 'vitest';
import {
  computeXp,
  sessionXp,
  sessionXpBreakdown,
  bestStreakOf,
  streakMilestoneXp,
  rankForXp,
  RANKS,
  XP_PER_CORRECT,
  XP_PER_QUESTION,
  XP_PER_SESSION,
  XP_PER_STREAK_DAY,
  XP_PER_BADGE,
  estimateReach,
  EST_XP_PER_GAME,
  EST_MINUTES_PER_GAME,
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
      'streakBonus',
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

  it('counts questions + correct + a session bonus + the in-game streak bonus', () => {
    // 10 questions, first 7 correct → bestStreak 7, crossing milestones 3 & 5 (+10 +15 = +25).
    const run = results(10, 7);
    expect(bestStreakOf(run)).toBe(7);
    expect(sessionXp(run)).toBe(
      10 * XP_PER_QUESTION + 7 * XP_PER_CORRECT + XP_PER_SESSION + streakMilestoneXp(7).xp,
    );
    expect(streakMilestoneXp(7).xp).toBe(25);
  });

  it("exactly matches the run's contribution to computeXp play sources (streak included)", () => {
    const run = results(8, 6); // bestStreak 6 → crosses 3 & 5
    const bonus = streakMilestoneXp(bestStreakOf(run));
    const before = computeXp(
      input({ stats: { totalCorrect: 0, totalQuestions: 0, sessionCount: 0 } }),
    ).total;
    const after = computeXp(
      input({
        stats: {
          totalCorrect: 6,
          totalQuestions: 8,
          sessionCount: 1,
          totalStreakBonus: bonus.xp,
          totalStreakMilestones: bonus.milestones,
        },
      }),
    ).total;
    expect(after - before).toBe(sessionXp(run));
  });
});

describe('sessionXpBreakdown — the Summary itemization', () => {
  it('is all-zero for an empty run', () => {
    expect(sessionXpBreakdown([])).toEqual([
      { key: 'correct', count: 0, xp: 0 },
      { key: 'questions', count: 0, xp: 0 },
      { key: 'sessions', count: 0, xp: 0 },
      { key: 'streakBonus', count: 0, xp: 0 },
    ]);
  });

  it('splits into correct, questions, a session bonus, and the streak-milestone bonus', () => {
    // 10 questions, first 7 correct → bestStreak 7 crosses 2 milestones (3, 5) for +25.
    expect(sessionXpBreakdown(results(10, 7))).toEqual([
      { key: 'correct', count: 7, xp: 7 * XP_PER_CORRECT },
      { key: 'questions', count: 10, xp: 10 * XP_PER_QUESTION },
      { key: 'sessions', count: 1, xp: XP_PER_SESSION },
      { key: 'streakBonus', count: 2, xp: 25 },
    ]);
  });

  it('sums exactly to sessionXp', () => {
    for (const [n, c] of [
      [0, 0],
      [1, 0],
      [5, 5],
      [12, 9],
    ] as const) {
      const run = results(n, c);
      const sum = sessionXpBreakdown(run).reduce((t, s) => t + s.xp, 0);
      expect(sum).toBe(sessionXp(run));
    }
  });
});

describe('streak-milestone bonus (in-game streak → XP)', () => {
  it('bestStreakOf finds the longest unbroken correct run', () => {
    expect(bestStreakOf([])).toBe(0);
    // 3 right, 1 wrong, 5 right → longest run is 5.
    const mixed = [...results(3, 3), ...results(1, 0), ...results(5, 5)];
    expect(bestStreakOf(mixed)).toBe(5);
    expect(bestStreakOf(results(10, 10))).toBe(10);
  });

  it('awards the agreed escalating tiers, summing every milestone crossed', () => {
    expect(streakMilestoneXp(2)).toEqual({ xp: 0, milestones: 0 }); // below the first
    expect(streakMilestoneXp(3)).toEqual({ xp: 10, milestones: 1 });
    expect(streakMilestoneXp(5)).toEqual({ xp: 25, milestones: 2 }); // 10 + 15
    expect(streakMilestoneXp(10)).toEqual({ xp: 50, milestones: 3 }); // perfect 10/10: 10+15+25
    expect(streakMilestoneXp(50)).toEqual({ xp: 700, milestones: 9 }); // every tier
    expect(streakMilestoneXp(999)).toEqual(streakMilestoneXp(50)); // caps at the last tier
  });

  it('is monotonic — a longer streak never lowers the bonus', () => {
    let prev = -1;
    for (let s = 0; s <= 55; s++) {
      const xp = streakMilestoneXp(s).xp;
      expect(xp).toBeGreaterThanOrEqual(prev);
      prev = xp;
    }
  });

  it('feeds computeXp as an append-only streakBonus source', () => {
    const r = computeXp(
      input({
        stats: {
          totalCorrect: 0,
          totalQuestions: 0,
          sessionCount: 0,
          totalStreakBonus: 50,
          totalStreakMilestones: 3,
        },
      }),
    );
    expect(r.bySource.find((s) => s.key === 'streakBonus')).toEqual({
      key: 'streakBonus',
      count: 3,
      xp: 50,
    });
    expect(r.total).toBe(50);
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
    expect(RANKS).toHaveLength(15);
  });
});

describe('estimateReach', () => {
  it('the starting rank (0 XP) costs no games and no time', () => {
    expect(estimateReach(0)).toEqual({ games: 0, minutes: 0 });
  });

  it('rounds games up and derives minutes from the per-game constants', () => {
    expect(estimateReach(EST_XP_PER_GAME)).toEqual({
      games: 1,
      minutes: EST_MINUTES_PER_GAME,
    });
    // One XP into the next game still counts as a whole game.
    expect(estimateReach(EST_XP_PER_GAME + 1)).toEqual({
      games: 2,
      minutes: 2 * EST_MINUTES_PER_GAME,
    });
  });

  it('is non-decreasing across the ladder and floors negatives to zero', () => {
    expect(estimateReach(-500)).toEqual({ games: 0, minutes: 0 });
    for (let i = 1; i < RANKS.length; i++) {
      expect(estimateReach(RANKS[i].minXp).games).toBeGreaterThanOrEqual(
        estimateReach(RANKS[i - 1].minXp).games,
      );
    }
  });
});
