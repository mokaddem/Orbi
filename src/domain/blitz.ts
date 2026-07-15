// Blitz mode (Phase 42) — the pure, deterministic scoring & clock math for the timed format.
//
// Blitz is a *session format*, not a new mode: the existing modes played against a countdown.
// The domain stays count-based and wall-clock-free (see `session.ts`) — the UI owns the real
// clock and calls `QuizSession.end()` at zero. This module is the pure math both the UI and the
// history rollups read: the streak-combo multiplier, points accrual, the deadline curve (a 60 s
// start plus earned time, capped at 90 s), and the history-derived personal best. Everything is
// total and side-effect-free, so it's trivially unit-tested (no injected clock needed — callers
// pass in elapsed time / answer counts).

import type { GameMode, QuestionResult, RegionFilter } from './types';
// Type-only import across the layer boundary (erased at compile time, like `stats.ts` /
// `recap.ts`) — no runtime dependency on the persistence layer, so no import cycle.
import type { SessionRecord } from '../data/persistence/types';

/** Seconds on the clock when a Blitz run begins. */
export const BLITZ_START_SECONDS = 60;
/** Hard ceiling on total run length — earned time can never push a run past this. */
export const BLITZ_CAP_SECONDS = 90;
/** Seconds added to the clock for each correct answer (the friendly, no-penalty time dynamic). */
export const BLITZ_BONUS_SECONDS = 1;
/** Base points for one correct answer, before the streak-combo multiplier. */
export const BLITZ_BASE_POINTS = 100;

/** The top combo multiplier — the ceiling {@link blitzCombo} climbs to (and its number of tiers). */
export const BLITZ_MAX_COMBO = 5;

/**
 * The combo "reaction window": how long the player may take to pick before losing a combo tier
 * (measured from when the question is shown, i.e. a result's `answerMs`). Answer inside it and a
 * correct answer *climbs* the combo; each further window that elapses *drops one tier*, down to x1 —
 * so a slow-but-correct answer costs a tier, not the whole combo (a wrong answer still resets fully).
 * Kept short (owner: "faster is better") so Blitz rewards *fast* recall, not merely accurate recall.
 */
export const BLITZ_COMBO_TIME_MS = 2300;

/**
 * The streak-combo multiplier for a given current streak (consecutive correct answers): it steps up
 * every two answers — x1 at streak 1–2, x2 at 3–4, x3 at 5–6, x4 at 7–8, x5 at 9+ (the cap, see
 * {@link BLITZ_MAX_COMBO}). A wrong answer resets the streak to 0, so the next correct scores at x1
 * again. Total; streak 0 (or negative) yields x1.
 */
export function blitzCombo(streak: number): number {
  if (streak >= 9) return 5;
  if (streak >= 7) return 4;
  if (streak >= 5) return 3;
  if (streak >= 3) return 2;
  return 1;
}

/**
 * Points for one correct answer that lands at `streak` (the *post-increment* streak — i.e. the
 * 5th correct in a row is scored at x3). Base points × {@link blitzCombo}.
 */
export function blitzPointsForCorrect(streak: number): number {
  return BLITZ_BASE_POINTS * blitzCombo(streak);
}

/** A result carrying just what the combo replay needs: the verdict and how long it took to answer. */
type ComboResult = Pick<QuestionResult, 'correct' | 'answerMs'>;

/** How many combo tiers are lost by taking `elapsedMs` to answer — one per full reaction window
 * ({@link BLITZ_COMBO_TIME_MS}) elapsed. 0 while still inside the first window (a "fast" answer). */
export function blitzTiersLost(elapsedMs: number): number {
  return Math.floor(Math.max(0, elapsedMs) / BLITZ_COMBO_TIME_MS);
}

/** The lowest streak that yields multiplier `m` — the inverse of {@link blitzCombo}'s uniform,
 * two-wide bands (x1→1, x2→3, x3→5, x4→7, x5→9). Lands a demoted combo at the foot of its new tier. */
function streakForCombo(m: number): number {
  return 2 * m - 1;
}

/**
 * The live multiplier for a combo built to `baseStreak` when the current question has gone `elapsedMs`
 * without an answer: the combo *decays one tier per reaction window* ({@link BLITZ_COMBO_TIME_MS}) that
 * passes, floored at x1. Pure; drives the HUD's live badge + meter and mirrors how a slow answer scores
 * in {@link computeBlitzPoints}.
 */
export function blitzDecayedCombo(baseStreak: number, elapsedMs: number): number {
  return Math.max(1, blitzCombo(baseStreak) - blitzTiersLost(elapsedMs));
}

/**
 * Replay an ordered results list, tracking the running combo streak and the points it earns. A correct
 * answer either *climbs* the combo (answered fast, inside the first reaction window → streak + 1) or
 * *decays* it (answered slow → drop one tier per further {@link BLITZ_COMBO_TIME_MS} elapsed, landing at
 * the foot of the new tier, floored at x1); a wrong answer breaks it to 0. Each correct scores
 * base × combo at the resulting streak. Shared by {@link computeBlitzPoints} and {@link
 * blitzComboStreak} so points and the displayed multiplier can never disagree. Pure of the wall clock —
 * timing is read from each result's `answerMs`, exactly what history persists.
 */
function replayCombo(results: readonly ComboResult[]): { points: number; streak: number } {
  let streak = 0;
  let points = 0;
  for (const r of results) {
    if (!r.correct) {
      streak = 0;
      continue;
    }
    const tiers = blitzTiersLost(r.answerMs ?? 0);
    // Fast → climb a step; slow → drop `tiers` tiers to the foot of the new (lower) tier, min x1.
    streak = tiers === 0 ? streak + 1 : streakForCombo(Math.max(1, blitzCombo(streak) - tiers));
    points += blitzPointsForCorrect(streak);
  }
  return { points, streak };
}

/**
 * Total Blitz points for an ordered results list (see {@link replayCombo}). Accepts anything carrying
 * `correct` + `answerMs` (a `QuestionResult`, or a `SessionRecord`'s `questions`).
 */
export function computeBlitzPoints(results: readonly ComboResult[]): number {
  return replayCombo(results).points;
}

/**
 * The current running combo streak for a results list — the tail run of answers that were correct
 * *and* fast enough (within {@link BLITZ_COMBO_TIME_MS}); a wrong or slow answer restarts/breaks it.
 * Feed it to {@link blitzCombo} for the live multiplier. Shares {@link computeBlitzPoints}'s replay.
 */
export function blitzComboStreak(results: readonly ComboResult[]): number {
  return replayCombo(results).streak;
}

/**
 * How many seconds a Blitz run lasts given how many answers were correct: the 60 s start plus
 * 1 s per correct, capped at 90 s. Monotonic and clamped; maxes out at 30 correct.
 */
export function blitzRunSeconds(correctCount: number): number {
  const earned = BLITZ_START_SECONDS + Math.max(0, correctCount) * BLITZ_BONUS_SECONDS;
  return Math.min(earned, BLITZ_CAP_SECONDS);
}

/**
 * The bonus time a Blitz run gained from correct answers — the seconds added to the clock beyond
 * the {@link BLITZ_START_SECONDS} start, i.e. `blitzRunSeconds(correct) − start`. Bounded by the
 * cap headroom ({@link BLITZ_CAP_SECONDS} − start): a run that answered enough correct to pin the
 * clock at the cap reports the full bonus and no more (so this reveals cap-hitting runs, unlike the
 * raw correct count). 0 for a run with no correct answers.
 */
export function blitzEarnedSeconds(correctCount: number): number {
  return blitzRunSeconds(correctCount) - BLITZ_START_SECONDS;
}

/**
 * Milliseconds left `elapsedMs` into a run that has `correctCount` correct answers so far
 * (clamped ≥ 0). The UI drives `elapsedMs` off `performance.now()` deltas and lets `correctCount`
 * climb live as answers land, so each correct visibly adds a second — until the 90 s cap, after
 * which further correct answers stop extending the clock.
 */
export function blitzRemainingMs(elapsedMs: number, correctCount: number): number {
  return Math.max(0, blitzRunSeconds(correctCount) * 1000 - elapsedMs);
}

/** Identifies a personal-best "slot": a mode played over a region (and optionally a sub-region). */
export interface BlitzBestQuery {
  mode: GameMode;
  /** Selected region, or absent/empty for World. */
  region?: string;
  /** Selected sub-region, or absent/empty for the whole region. */
  subregion?: string;
}

/**
 * The best Blitz score (points) in history for a given slot — the personal best surfaced on the
 * setup card and celebrated in the Summary. A record counts when it is a `blitz` run in the same
 * mode whose region filter matches the query (see {@link blitzSlotMatches}). Points come from the
 * persisted `points`, falling back to replaying the stored `questions` so a record written without
 * the cache still counts. Returns 0 when nothing matches (i.e. no best yet).
 */
export function computeBlitzBest(
  sessions: readonly SessionRecord[],
  query: BlitzBestQuery,
): number {
  let best = 0;
  for (const s of sessions) {
    if (s.type !== 'blitz' || s.mode !== query.mode) continue;
    if (!blitzSlotMatches(s.regionFilter, query)) continue;
    const points = s.points ?? computeBlitzPoints(s.questions);
    if (points > best) best = points;
  }
  return best;
}

/** One personal-best entry: the top score for a specific mode × region (× sub-region) slot. */
export interface BlitzBestEntry {
  mode: GameMode;
  /** Present only when the slot is region-scoped. */
  region?: string;
  /** Present only when the slot is sub-region-scoped. */
  subregion?: string;
  points: number;
}

/**
 * Every Blitz personal best in history — one entry per (mode × region × sub-region) slot that has
 * been played — sorted by points descending (ties broken by mode, then region, for a stable order).
 * Powers the Progress "Blitz best" panel. Pure; points fall back to replaying `questions` when the
 * cached `points` is absent. Returns an empty array when no blitz runs exist.
 */
export function computeBlitzBests(sessions: readonly SessionRecord[]): BlitzBestEntry[] {
  const best = new Map<string, BlitzBestEntry>();
  for (const s of sessions) {
    if (s.type !== 'blitz') continue;
    const region = s.regionFilter?.region ?? '';
    const subregion = s.regionFilter?.subregion ?? '';
    const key = `${s.mode}|${region}|${subregion}`;
    const points = s.points ?? computeBlitzPoints(s.questions);
    const prev = best.get(key);
    if (!prev || points > prev.points) {
      best.set(key, {
        mode: s.mode,
        ...(region ? { region } : {}),
        ...(subregion ? { subregion } : {}),
        points,
      });
    }
  }
  return [...best.values()].sort(
    (a, b) =>
      b.points - a.points ||
      a.mode.localeCompare(b.mode) ||
      (a.subregion ?? a.region ?? '').localeCompare(b.subregion ?? b.region ?? ''),
  );
}

/**
 * Whether a record's region filter belongs to the queried slot. A sub-region query is the
 * *narrowest* slot — it matches only records with that exact sub-region. A region-only query
 * (no sub-region) matches records with that region and **no** sub-region, so a Northern-Europe
 * run is not counted as the Europe-wide best. World (no region) matches only World records.
 */
export function blitzSlotMatches(filter: RegionFilter | undefined, query: BlitzBestQuery): boolean {
  const region = filter?.region ?? '';
  const subregion = filter?.subregion ?? '';
  const wantRegion = query.region ?? '';
  const wantSub = query.subregion ?? '';
  if (wantSub) return subregion === wantSub && region === wantRegion;
  return region === wantRegion && subregion === '';
}
