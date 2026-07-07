// Spaced-repetition scheduler (Phase 7) — pure, framework-agnostic, unit-testable.
//
// Implements the classic SM-2 algorithm over the persisted `SRItem` shape. It maps a
// `QuestionResult` (correct/incorrect + answer speed) to a quality grade, then updates
// the item's repetitions, ease factor, interval, due date, and lapse count. No storage
// or DOM here: the persistence layer reads the previous item, calls `scheduleNext`, and
// writes the result back.
//
// The key teaching behaviour — a missed item resurfaces far sooner than a known one —
// falls out of SM-2 directly: a wrong answer resets the item to due-now (interval 0) and
// bumps the lapse counter, while correct answers grow the interval geometrically
// (1 → 6 → ×EF days). This "due immediately on a lapse" tweak suits a session-based app
// (rather than a daily-review one): the training selector (`training.ts`) then surfaces
// those due, high-lapse items first.

import type { SRItem } from '../data/persistence/types';
import type { QuestionResult } from './types';

/** Starting ease factor for a fresh item (SM-2 canonical value). */
export const DEFAULT_EASE = 2.5;
/** Ease never drops below this floor, so hard items stay reviewable rather than frozen. */
export const MIN_EASE = 1.3;
/** Milliseconds in a day — the unit intervals are measured in. */
export const MS_PER_DAY = 86_400_000;

/**
 * Answer-speed thresholds used to grade a *correct* answer. A quick recall scores
 * higher (longer next interval); a slow-but-correct one scores lower (shorter interval).
 */
export const FAST_ANSWER_MS = 3_000;
export const SLOW_ANSWER_MS = 8_000;

/** SM-2 quality grade: 0–2 = incorrect/failed, 3–5 = correct (3 hard … 5 easy). */
export type SRQuality = 0 | 1 | 2 | 3 | 4 | 5;

/** The grade below which a review counts as a lapse and resets the schedule. */
export const PASS_GRADE = 3;

/** A fresh SR item — never reviewed, so it is due immediately. */
export function newSRItem(itemKey: string, now: number = Date.now()): SRItem {
  return {
    itemKey,
    repetitions: 0,
    easeFactor: DEFAULT_EASE,
    intervalDays: 0,
    dueAt: now,
    lapses: 0,
  };
}

/**
 * Grade an answer on the SM-2 0–5 scale. Wrong answers are always a hard failure (0);
 * correct answers are scaled by how quickly they were given, so confident fast recalls
 * space out faster than laboured ones. Documented, deliberately simple mapping.
 */
export function gradeAnswer(result: QuestionResult): SRQuality {
  if (!result.correct) return 0;
  if (result.answerMs <= FAST_ANSWER_MS) return 5;
  if (result.answerMs >= SLOW_ANSWER_MS) return 3;
  return 4;
}

/** Apply the SM-2 ease-factor update for a given quality, floored at {@link MIN_EASE}. */
function nextEase(ease: number, quality: SRQuality): number {
  const delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  return Math.max(MIN_EASE, ease + delta);
}

/**
 * Compute the next SM-2 state for an item after grading `result`. `prev` is the item's
 * current state (or `undefined` for a never-seen item). Pure given `now`.
 *
 * - **Correct** (grade ≥ 3): repetitions increment; interval grows 1 → 6 → round(prev×EF).
 * - **Incorrect** (grade < 3): repetitions reset to 0, interval to 0 (due now), lapses += 1.
 *
 * The ease factor is nudged on every review (down for hard/failed, up for easy), so
 * chronically-missed items keep short intervals even once you start getting them right.
 */
export function scheduleNext(
  prev: SRItem | undefined,
  result: QuestionResult,
  now: number = Date.now(),
): SRItem {
  const base = prev ?? newSRItem(result.itemKey, now);
  const quality = gradeAnswer(result);
  const easeFactor = nextEase(base.easeFactor, quality);

  let repetitions: number;
  let intervalDays: number;
  let lapses = base.lapses;

  if (quality >= PASS_GRADE) {
    repetitions = base.repetitions + 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.max(1, Math.round(base.intervalDays * easeFactor));
  } else {
    repetitions = 0;
    intervalDays = 0; // due now — relearn this session / next
    lapses += 1;
  }

  return {
    itemKey: base.itemKey,
    repetitions,
    easeFactor,
    intervalDays,
    dueAt: now + intervalDays * MS_PER_DAY,
    lapses,
    lastReviewedAt: now,
  };
}
