// Explorer rank & XP (Phase 43) — pure, framework-agnostic, unit-testable.
//
// A continuous progression *spine* layered over the milestone achievements: fold play the app
// already tracks into one climbing XP number, and convert that number into a named Explorer rank
// (Novice → … → Legendary Explorer). Badges are the binary "moments"; XP/rank is the continuous
// line between them.
//
// **Monotonicity is the design constraint.** A progression bar must never go *down*, but live
// mastery can dip (a lapse demotes a country — Phase 16/41). So every XP source here is
// **append-only**: answers / questions / sessions from play history (removed only by a Settings
// reset), the longest-ever streak (never shrinks), and the count of *earned* (sticky) badges.
// Mastery enters XP only through those sticky mastery badges, never the live rollup — so no
// sequence of play can ever lower the total.
//
// Pure over precomputed rollups (`stats`, `streak`) + a sticky badge count, mirroring
// `evaluateAchievements`: no storage, no clock. The rank ladder is a swappable data table (like
// the Phase 39 milestone table), so thresholds/names are trivially tunable and test-pinned.

import type { QuestionResult } from './types';
import type { StatsOverview } from './stats';
import type { StreakInfo } from './streak';

// --- XP weights (tunable; pinned by unit tests) -------------------------------------------------
//
// Correct answers and questions stack: a *correct* answer earns `XP_PER_QUESTION + XP_PER_CORRECT`
// (participation + reward), a *wrong* one just `XP_PER_QUESTION`. Learning (correct recall) is
// weighted most, exactly as the model intends.

/** XP for each correct answer — the primary "you learned something" signal. */
export const XP_PER_CORRECT = 10;
/** XP for each question answered (right or wrong) — participation. */
export const XP_PER_QUESTION = 3;
/** XP for each completed session — a small "you showed up" bonus. */
export const XP_PER_SESSION = 25;
/** XP per day of the **longest-ever** streak (monotonic: `longest` never shrinks). */
export const XP_PER_STREAK_DAY = 20;
/** XP per earned (sticky) achievement badge — the milestone → progression bridge. */
export const XP_PER_BADGE = 150;

/** The XP sources, in display order — keys drive the Progress breakdown labels + icons. */
export type XpSourceKey = 'correct' | 'questions' | 'sessions' | 'streak' | 'badges';

/** One source's contribution: the underlying count and the XP it yields. */
export interface XpSource {
  key: XpSourceKey;
  /** The underlying tally (correct answers, questions, sessions, streak days, badges). */
  count: number;
  /** XP contributed by this source (`count × weight`). */
  xp: number;
}

/** Total XP plus the per-source breakdown. */
export interface XpResult {
  total: number;
  bySource: XpSource[];
}

/** Everything {@link computeXp} reads — all append-only rollups. */
export interface XpInput {
  /** History rollup (append-only counts). */
  stats: Pick<StatsOverview, 'totalCorrect' | 'totalQuestions' | 'sessionCount'>;
  /** Streak rollup — only the monotonic `longest` is used. */
  streak: Pick<StreakInfo, 'longest'>;
  /** Count of *earned* (sticky) achievement badges. */
  achievementsUnlocked: number;
}

/**
 * Compute total XP + a per-source breakdown from append-only signals. Pure and **monotonic in
 * every input**: raising any count can only raise the total, so no play (including a mastery
 * lapse) ever lowers XP — only an explicit history/training reset, which zeroes the counts.
 */
export function computeXp(input: XpInput): XpResult {
  const correct = Math.max(0, Math.floor(input.stats.totalCorrect));
  const questions = Math.max(0, Math.floor(input.stats.totalQuestions));
  const sessions = Math.max(0, Math.floor(input.stats.sessionCount));
  const streakDays = Math.max(0, Math.floor(input.streak.longest));
  const badges = Math.max(0, Math.floor(input.achievementsUnlocked));

  const bySource: XpSource[] = [
    { key: 'correct', count: correct, xp: correct * XP_PER_CORRECT },
    { key: 'questions', count: questions, xp: questions * XP_PER_QUESTION },
    { key: 'sessions', count: sessions, xp: sessions * XP_PER_SESSION },
    { key: 'streak', count: streakDays, xp: streakDays * XP_PER_STREAK_DAY },
    { key: 'badges', count: badges, xp: badges * XP_PER_BADGE },
  ];
  const total = bySource.reduce((sum, s) => sum + s.xp, 0);
  return { total, bySource };
}

/**
 * The play-derived XP a single finished run contributes — the Summary "+N XP" (Phase 43). It's the
 * per-answer portion only (correct + questions + the session bonus); the streak/badge chunks are
 * celebrated through their own moments and would double-count here. Always equals the run's exact
 * contribution to {@link computeXp}'s `correct` + `questions` + `sessions` sources. Blitz runs use
 * the same rule — no special case. Returns 0 for an empty run.
 */
export function sessionXp(results: readonly QuestionResult[]): number {
  const questions = results.length;
  if (questions === 0) return 0;
  const correct = results.reduce((n, r) => (r.correct ? n + 1 : n), 0);
  return questions * XP_PER_QUESTION + correct * XP_PER_CORRECT + XP_PER_SESSION;
}

// --- Rank ladder (Phase 43) ---------------------------------------------------------------------

/** One rung of the Explorer ladder: its index, an i18n key, and the XP needed to reach it. */
export interface Rank {
  /** 0-based position in {@link RANKS}. */
  index: number;
  /** i18n key suffix — resolved as `rank.names.<key>`. */
  key: string;
  /** Total XP required to reach this rank; `RANKS[0]` is 0. */
  minXp: number;
}

/**
 * The 10-tier Explorer ladder (owner-picked, Phase 43). Escalating thresholds — each rank costs
 * more than the last — so early rank-ups come quickly and the top rank stays aspirational but
 * reachable for a dedicated learner. Pure data: swap names or retune thresholds freely (the unit
 * tests pin the boundaries, not the exact numbers).
 */
export const RANKS: readonly Rank[] = [
  { index: 0, key: 'novice', minXp: 0 },
  { index: 1, key: 'scout', minXp: 400 },
  { index: 2, key: 'wanderer', minXp: 1_000 },
  { index: 3, key: 'pathfinder', minXp: 2_200 },
  { index: 4, key: 'navigator', minXp: 4_200 },
  { index: 5, key: 'voyager', minXp: 7_500 },
  { index: 6, key: 'adventurer', minXp: 12_500 },
  { index: 7, key: 'cartographer', minXp: 20_000 },
  { index: 8, key: 'globetrotter', minXp: 30_000 },
  { index: 9, key: 'legend', minXp: 45_000 },
];

/** Where a player sits on the ladder: current rank, the next rung, and progress toward it. */
export interface RankProgress {
  /** The highest rank whose `minXp` the player has reached. */
  rank: Rank;
  /** The next rank up, or `null` at the top of the ladder. */
  next: Rank | null;
  /** XP accumulated into the current rank (`total − rank.minXp`). */
  xpIntoRank: number;
  /** XP span of the current rank (`next.minXp − rank.minXp`); 0 at the top. */
  rankSpan: number;
  /** XP still needed to reach the next rank; 0 at the top. */
  xpToNext: number;
  /** Progress toward the next rank in [0, 1]; 1 at the top rank. */
  fraction: number;
}

/**
 * Resolve a total XP figure to its rank + progress toward the next. Pure; the ladder is a plain
 * lookup so this is O(RANKS). Negative/fractional inputs are floored to a non-negative integer.
 */
export function rankForXp(totalXp: number): RankProgress {
  const xp = Math.max(0, Math.floor(totalXp));

  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (xp >= RANKS[i].minXp) idx = i;
    else break;
  }

  const rank = RANKS[idx];
  const next = idx + 1 < RANKS.length ? RANKS[idx + 1] : null;
  const xpIntoRank = xp - rank.minXp;
  const rankSpan = next ? next.minXp - rank.minXp : 0;
  const xpToNext = next ? Math.max(0, next.minXp - xp) : 0;
  const fraction = next ? (rankSpan === 0 ? 1 : Math.min(1, xpIntoRank / rankSpan)) : 1;

  return { rank, next, xpIntoRank, rankSpan, xpToNext, fraction };
}
