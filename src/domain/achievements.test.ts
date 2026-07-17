import { describe, it, expect } from 'vitest';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_IDS,
  CONTINENTS,
  SPEEDY_MAX_AVG_MS,
  SPEEDY_MIN_QUESTIONS,
  evaluateAchievements,
  type AchievementContext,
} from './achievements';
import type { MasteryResult, MasteryRollup, RegionMastery } from './mastery';
import type { StatsOverview } from './stats';
import type { StreakInfo } from './streak';
import type { SessionRecord } from '../data/persistence/types';
import type { QuestionResult } from './types';

const NOW = 1_000_000;

function stats(over: Partial<StatsOverview> = {}): StatsOverview {
  return {
    sessionCount: 0,
    totalQuestions: 0,
    totalCorrect: 0,
    accuracy: 0,
    avgAnswerMs: 0,
    totalPlayMs: 0,
    byDay: [],
    mostMissed: [],
    ...over,
  };
}

function rollup(over: Partial<MasteryRollup> = {}): MasteryRollup {
  return { mastered: 0, learning: 0, unseen: 0, total: 0, ...over };
}

function mastery(
  overall: Partial<MasteryRollup> = {},
  byRegion: RegionMastery[] = [],
): MasteryResult {
  return { overall: rollup({ total: 195, ...overall }), byRegion };
}

function region(name: string, mastered: number, total: number): RegionMastery {
  return { region: name, mastered, learning: total - mastered, unseen: 0, total };
}

function streak(over: Partial<StreakInfo> = {}): StreakInfo {
  return { current: 0, longest: 0, playedToday: false, ...over };
}

function q(answerMs: number): QuestionResult {
  return { itemKey: 'flag-to-country:FR', countryIso2: 'FR', correct: true, answerMs };
}

function session(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 's',
    startedAt: 0,
    finishedAt: 0,
    durationMs: 0,
    mode: 'flag-to-country',
    type: 'fixed',
    total: 0,
    correct: 0,
    questions: [],
    ...over,
  };
}

function ctx(over: Partial<AchievementContext> = {}): AchievementContext {
  return {
    stats: stats(),
    mastery: mastery(),
    capitalMastery: mastery(),
    languageMastery: mastery(),
    industryMastery: mastery(),
    streak: streak(),
    sessions: [],
    now: NOW,
    ...over,
  };
}

/** Convenience: is `id` unlocked under `context`? */
function unlocked(id: string, context: AchievementContext): boolean {
  const found = evaluateAchievements(context).find((a) => a.id === id);
  if (!found) throw new Error(`unknown badge ${id}`);
  return found.unlocked;
}

describe('achievements catalog', () => {
  it('has unique, stable ids including the five continents', () => {
    expect(new Set(ACHIEVEMENT_IDS).size).toBe(ACHIEVEMENT_IDS.length);
    for (const c of CONTINENTS) expect(ACHIEVEMENT_IDS).toContain(`mastered-${c.toLowerCase()}`);
  });

  it('locks every badge for a brand-new profile', () => {
    expect(evaluateAchievements(ctx()).every((a) => !a.unlocked)).toBe(true);
  });

  it('evaluates in catalog order', () => {
    expect(evaluateAchievements(ctx()).map((a) => a.id)).toEqual(ACHIEVEMENTS.map((a) => a.id));
  });
});

describe('badge predicates', () => {
  it('first-round: unlocks after one session', () => {
    expect(unlocked('first-round', ctx({ stats: stats({ sessionCount: 0 }) }))).toBe(false);
    expect(unlocked('first-round', ctx({ stats: stats({ sessionCount: 1 }) }))).toBe(true);
  });

  it('perfect-fixed: a flawless fixed round only', () => {
    expect(
      unlocked(
        'perfect-fixed',
        ctx({ sessions: [session({ type: 'fixed', total: 10, correct: 10 })] }),
      ),
    ).toBe(true);
    // A single miss disqualifies it.
    expect(
      unlocked(
        'perfect-fixed',
        ctx({ sessions: [session({ type: 'fixed', total: 10, correct: 9 })] }),
      ),
    ).toBe(false);
    // A flawless *survival* run doesn't count for the fixed badge.
    expect(
      unlocked(
        'perfect-fixed',
        ctx({ sessions: [session({ type: 'survival', total: 10, correct: 10 })] }),
      ),
    ).toBe(false);
    // An empty round doesn't count.
    expect(
      unlocked(
        'perfect-fixed',
        ctx({ sessions: [session({ type: 'fixed', total: 0, correct: 0 })] }),
      ),
    ).toBe(false);
  });

  it('flawless-survival: a flawless survival run only', () => {
    expect(
      unlocked(
        'flawless-survival',
        ctx({ sessions: [session({ type: 'survival', total: 12, correct: 12 })] }),
      ),
    ).toBe(true);
    expect(
      unlocked(
        'flawless-survival',
        ctx({ sessions: [session({ type: 'fixed', total: 12, correct: 12 })] }),
      ),
    ).toBe(false);
  });

  it('speedy: enough questions answered fast on average', () => {
    const fast = session({
      total: SPEEDY_MIN_QUESTIONS,
      correct: SPEEDY_MIN_QUESTIONS,
      questions: Array.from({ length: SPEEDY_MIN_QUESTIONS }, () => q(SPEEDY_MAX_AVG_MS - 500)),
    });
    expect(unlocked('speedy', ctx({ sessions: [fast] }))).toBe(true);

    // Too few questions.
    const tooFew = session({
      total: SPEEDY_MIN_QUESTIONS - 1,
      questions: Array.from({ length: SPEEDY_MIN_QUESTIONS - 1 }, () => q(500)),
    });
    expect(unlocked('speedy', ctx({ sessions: [tooFew] }))).toBe(false);

    // Exactly at the threshold is not under it (strict <).
    const borderline = session({
      total: SPEEDY_MIN_QUESTIONS,
      questions: Array.from({ length: SPEEDY_MIN_QUESTIONS }, () => q(SPEEDY_MAX_AVG_MS)),
    });
    expect(unlocked('speedy', ctx({ sessions: [borderline] }))).toBe(false);
  });

  it('streak-7 / streak-30: on the longest run, at the boundary', () => {
    expect(unlocked('streak-7', ctx({ streak: streak({ longest: 6 }) }))).toBe(false);
    expect(unlocked('streak-7', ctx({ streak: streak({ longest: 7 }) }))).toBe(true);
    expect(unlocked('streak-30', ctx({ streak: streak({ longest: 29 }) }))).toBe(false);
    expect(unlocked('streak-30', ctx({ streak: streak({ longest: 30 }) }))).toBe(true);
  });

  it('region-mastered: any fully-mastered region', () => {
    expect(
      unlocked('region-mastered', ctx({ mastery: mastery({}, [region('Oceania', 7, 14)]) })),
    ).toBe(false);
    expect(
      unlocked('region-mastered', ctx({ mastery: mastery({}, [region('Oceania', 14, 14)]) })),
    ).toBe(true);
    // A region with no countries can't be "mastered".
    expect(
      unlocked('region-mastered', ctx({ mastery: mastery({}, [region('Nowhere', 0, 0)]) })),
    ).toBe(false);
  });

  it('mastered-<continent>: only the matching continent', () => {
    const europeDone = ctx({ mastery: mastery({}, [region('Europe', 45, 45)]) });
    expect(unlocked('mastered-europe', europeDone)).toBe(true);
    expect(unlocked('mastered-africa', europeDone)).toBe(false);
  });

  it('century: 100 countries mastered', () => {
    expect(unlocked('century', ctx({ mastery: mastery({ mastered: 99 }) }))).toBe(false);
    expect(unlocked('century', ctx({ mastery: mastery({ mastered: 100 }) }))).toBe(true);
  });

  it('world-mastered: every country mastered', () => {
    expect(
      unlocked('world-mastered', ctx({ mastery: mastery({ mastered: 195, total: 195 }) })),
    ).toBe(true);
    expect(
      unlocked('world-mastered', ctx({ mastery: mastery({ mastered: 194, total: 195 }) })),
    ).toBe(false);
    // A zero-total world isn't "mastered".
    expect(unlocked('world-mastered', ctx({ mastery: mastery({ mastered: 0, total: 0 }) }))).toBe(
      false,
    );
  });

  // Capitals (Phase 24) — a separate ladder driven by capitalMastery, not mastery.
  it('capital badges read capitalMastery, never the country mastery rollup', () => {
    // Full country mastery must NOT unlock any capital badge.
    const countryOnly = ctx({ mastery: mastery({ mastered: 195, total: 195 }) });
    expect(unlocked('capitals-collector', countryOnly)).toBe(false);
    expect(unlocked('capitals-world', countryOnly)).toBe(false);
    // …and full capital mastery must NOT unlock the country badges.
    const capitalOnly = ctx({ capitalMastery: mastery({ mastered: 195, total: 195 }) });
    expect(unlocked('century', capitalOnly)).toBe(false);
    expect(unlocked('world-mastered', capitalOnly)).toBe(false);
  });

  it('capitals-collector / capitals-century: at the 25 / 100 thresholds', () => {
    expect(unlocked('capitals-collector', ctx({ capitalMastery: mastery({ mastered: 24 }) }))).toBe(
      false,
    );
    expect(unlocked('capitals-collector', ctx({ capitalMastery: mastery({ mastered: 25 }) }))).toBe(
      true,
    );
    expect(unlocked('capitals-century', ctx({ capitalMastery: mastery({ mastered: 99 }) }))).toBe(
      false,
    );
    expect(unlocked('capitals-century', ctx({ capitalMastery: mastery({ mastered: 100 }) }))).toBe(
      true,
    );
  });

  it('capitals-<continent>: unlocks when that continent’s capitals are all mastered', () => {
    const oceaniaDone = ctx({ capitalMastery: mastery({}, [region('Oceania', 14, 14)]) });
    expect(unlocked('capitals-oceania', oceaniaDone)).toBe(true);
    expect(unlocked('capitals-europe', oceaniaDone)).toBe(false);
    expect(
      unlocked(
        'capitals-oceania',
        ctx({ capitalMastery: mastery({}, [region('Oceania', 13, 14)]) }),
      ),
    ).toBe(false);
  });

  it('capitals-world: every capital mastered', () => {
    expect(
      unlocked('capitals-world', ctx({ capitalMastery: mastery({ mastered: 195, total: 195 }) })),
    ).toBe(true);
    expect(
      unlocked('capitals-world', ctx({ capitalMastery: mastery({ mastered: 194, total: 195 }) })),
    ).toBe(false);
  });

  // Languages (Phase 23) — a parallel ladder driven by languageMastery, isolated from the
  // country and capital rollups (the "keep separate, folded into the extras view" decision).
  it('language badges read languageMastery, never country or capital mastery', () => {
    const others = ctx({
      mastery: mastery({ mastered: 195, total: 195 }),
      capitalMastery: mastery({ mastered: 195, total: 195 }),
    });
    expect(unlocked('languages-collector', others)).toBe(false);
    expect(unlocked('languages-world', others)).toBe(false);
    // …and full language mastery must not unlock the country or capital badges.
    const languageOnly = ctx({ languageMastery: mastery({ mastered: 192, total: 192 }) });
    expect(unlocked('century', languageOnly)).toBe(false);
    expect(unlocked('capitals-world', languageOnly)).toBe(false);
  });

  it('languages-collector / languages-century: at the 25 / 100 thresholds', () => {
    expect(
      unlocked('languages-collector', ctx({ languageMastery: mastery({ mastered: 24 }) })),
    ).toBe(false);
    expect(
      unlocked('languages-collector', ctx({ languageMastery: mastery({ mastered: 25 }) })),
    ).toBe(true);
    expect(
      unlocked('languages-century', ctx({ languageMastery: mastery({ mastered: 100 }) })),
    ).toBe(true);
  });

  it('languages-<continent> / languages-world: unlock on full mastery of that scope', () => {
    const europeDone = ctx({ languageMastery: mastery({}, [region('Europe', 45, 45)]) });
    expect(unlocked('languages-europe', europeDone)).toBe(true);
    expect(unlocked('languages-asia', europeDone)).toBe(false);
    expect(
      unlocked('languages-world', ctx({ languageMastery: mastery({ mastered: 192, total: 192 }) })),
    ).toBe(true);
  });
});
