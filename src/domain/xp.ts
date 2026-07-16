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
// reset), the summed in-game streak-milestone bonus across those sessions (each session's bonus is
// non-negative and sessions never un-happen), the longest-ever daily streak (never shrinks), and
// the count of *earned* (sticky) badges.
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

/**
 * In-game **streak milestone** bonus (agreed 2026-07-16). A run's longest unbroken run of correct
 * answers (`bestStreak`) earns a bonus at each milestone it crosses — the **same** `[3, 5, 10, …]`
 * ladder the streak jingles escalate on: `ui/streak.ts` derives its `STREAK_MILESTONES` from the
 * `streak` values here, so the reward and the celebration can never drift apart. Escalating, so a
 * long clean run pays off (a perfect 10/10 crosses 3·5·10 → +50). Append-only in aggregate: the
 * cumulative total sums each finished session's bonus (see {@link computeXp}'s `streakBonus`
 * source), and sessions never un-happen — so it stays monotonic like every other XP source.
 */
export const STREAK_MILESTONE_XP: readonly { streak: number; xp: number }[] = [
  { streak: 3, xp: 10 },
  { streak: 5, xp: 15 },
  { streak: 10, xp: 25 },
  { streak: 15, xp: 40 },
  { streak: 20, xp: 60 },
  { streak: 25, xp: 85 },
  { streak: 30, xp: 115 },
  { streak: 40, xp: 150 },
  { streak: 50, xp: 200 },
];

/** The longest unbroken run of correct answers in a result list — a run's `bestStreak`. Pure. */
export function bestStreakOf(results: readonly QuestionResult[]): number {
  let best = 0;
  let cur = 0;
  for (const r of results) {
    if (r.correct) {
      cur += 1;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best;
}

/**
 * Streak-milestone XP for a best streak: the summed bonus for every milestone it reached, plus how
 * many milestones that was (for the "×N" count on the breakdown row). Pure and monotonic in
 * `bestStreak` (a longer streak can only add milestones).
 */
export function streakMilestoneXp(bestStreak: number): { xp: number; milestones: number } {
  let xp = 0;
  let milestones = 0;
  for (const m of STREAK_MILESTONE_XP) {
    if (bestStreak >= m.streak) {
      xp += m.xp;
      milestones += 1;
    }
  }
  return { xp, milestones };
}

/** The XP sources, in display order — keys drive the Progress breakdown labels + icons. */
export type XpSourceKey =
  'correct' | 'questions' | 'sessions' | 'streakBonus' | 'streak' | 'badges';

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
  /**
   * History rollup (append-only counts). The two `totalStreak*` fields (the summed in-game
   * streak-milestone bonus + milestone count across all sessions) are optional so pre-existing
   * callers/tests stay valid; absent → 0. `computeStats` always provides them.
   */
  stats: Pick<StatsOverview, 'totalCorrect' | 'totalQuestions' | 'sessionCount'> &
    Partial<Pick<StatsOverview, 'totalStreakBonus' | 'totalStreakMilestones'>>;
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
  const streakBonus = Math.max(0, Math.floor(input.stats.totalStreakBonus ?? 0));
  const streakMilestones = Math.max(0, Math.floor(input.stats.totalStreakMilestones ?? 0));
  const streakDays = Math.max(0, Math.floor(input.streak.longest));
  const badges = Math.max(0, Math.floor(input.achievementsUnlocked));

  const bySource: XpSource[] = [
    { key: 'correct', count: correct, xp: correct * XP_PER_CORRECT },
    { key: 'questions', count: questions, xp: questions * XP_PER_QUESTION },
    { key: 'sessions', count: sessions, xp: sessions * XP_PER_SESSION },
    // In-game streak-milestone bonus, summed over sessions (not a fixed weight × count).
    { key: 'streakBonus', count: streakMilestones, xp: streakBonus },
    { key: 'streak', count: streakDays, xp: streakDays * XP_PER_STREAK_DAY },
    { key: 'badges', count: badges, xp: badges * XP_PER_BADGE },
  ];
  const total = bySource.reduce((sum, s) => sum + s.xp, 0);
  return { total, bySource };
}

/**
 * The per-source breakdown of a single finished run's play-derived XP (Phase 43) — the components
 * of the Summary "+N XP", in display order: correct answers, questions answered, the flat session
 * bonus, and the **in-game streak-milestone bonus** for this run's `bestStreak`. Mirrors
 * {@link computeXp}'s `correct` / `questions` / `sessions` / `streakBonus` sources (same keys), but
 * scoped to *this run*, so the Summary can itemize where the run's XP came from. Sums exactly to
 * {@link sessionXp}. An empty run yields all-zero sources (`count` and `xp` both 0).
 */
export function sessionXpBreakdown(results: readonly QuestionResult[]): XpSource[] {
  const questions = results.length;
  const correct = results.reduce((n, r) => (r.correct ? n + 1 : n), 0);
  const sessions = questions === 0 ? 0 : 1;
  const streak = streakMilestoneXp(bestStreakOf(results));
  return [
    { key: 'correct', count: correct, xp: correct * XP_PER_CORRECT },
    { key: 'questions', count: questions, xp: questions * XP_PER_QUESTION },
    { key: 'sessions', count: sessions, xp: sessions * XP_PER_SESSION },
    { key: 'streakBonus', count: streak.milestones, xp: streak.xp },
  ];
}

/**
 * The play-derived XP a single finished run contributes — the Summary "+N XP" (Phase 43+). It's the
 * per-run portion: correct + questions + the session bonus + the in-game streak-milestone bonus
 * (this run's `bestStreak`). The **daily**-streak and badge chunks are excluded here — they're
 * cumulative / celebrated through their own moments and would double-count. Always equals the run's
 * exact contribution to {@link computeXp}'s `correct` + `questions` + `sessions` + `streakBonus`
 * sources — the sum of {@link sessionXpBreakdown}. Blitz runs use the same rule. 0 for an empty run.
 */
export function sessionXp(results: readonly QuestionResult[]): number {
  return sessionXpBreakdown(results).reduce((sum, s) => sum + s.xp, 0);
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
