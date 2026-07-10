// Reactive-mascot logic (Phase 33) — pure, framework-agnostic, unit-testable.
//
// The mascot (Orbi) is rendered by `Mascot.svelte`, but *which* pose and motion it shows in
// response to what just happened (how a session went, a streak milestone) is decided here, in
// plain functions with no Svelte/DOM dependency — mirroring how the SR scheduler, recommender
// and recap keep their decision logic pure. The component just draws what it's told.
//
// The canonical `MascotPose` / `MascotMotion` unions live here too so the pure layer and the
// component agree on one vocabulary; `Mascot.svelte` imports (and re-exports) them.

/** Every emotional beat Orbi can strike. The first six are the Phase-18 originals; `proud`,
 *  `encouraging` and `cheer` were added in Phase 33 for reactive moments. */
export type MascotPose =
  | 'wave'
  | 'celebrate'
  | 'relaxed'
  | 'sleepy'
  | 'thinking'
  | 'daily'
  | 'proud'
  | 'encouraging'
  | 'cheer';

/** A motion intent applied to a pose. `none` is the static frame (also the reduced-motion
 *  fallback for every other value). CSS/SVG only — see `Mascot.svelte`. */
export type MascotMotion = 'none' | 'idle' | 'bounce-in' | 'cheer' | 'wiggle';

/** A pose paired with the motion to play it with. */
export interface MascotReaction {
  pose: MascotPose;
  animate: MascotMotion;
}

/** What a finished session looked like, as far as the mascot cares. */
export interface SummaryReactionInput {
  /** Fraction correct, 0..1. */
  accuracy: number;
  /** Number of questions answered (0 for an empty/unstarted summary). */
  total: number;
}

/**
 * Pick Orbi's reaction to a finished session.
 *
 * A flawless run gets the full `cheer` (confetti); a strong run a `proud` bounce; a solid run
 * the calm `celebrate`; a rough run a warm, encouraging bounce rather than anything that reads
 * as mockery. An empty summary (nothing played) stays `thinking` and still.
 *
 * Thresholds are deliberately simple and live in one place so they're easy to tune.
 */
export function pickSummaryReaction({ accuracy, total }: SummaryReactionInput): MascotReaction {
  if (total <= 0) return { pose: 'thinking', animate: 'none' };
  if (accuracy >= 1) return { pose: 'cheer', animate: 'cheer' };
  if (accuracy >= 0.8) return { pose: 'proud', animate: 'bounce-in' };
  if (accuracy >= 0.5) return { pose: 'celebrate', animate: 'bounce-in' };
  return { pose: 'encouraging', animate: 'bounce-in' };
}

/** Streak lengths (in days) worth celebrating: early wins, then every 50 days, plus a year. */
export function isStreakMilestone(days: number): boolean {
  if (!Number.isInteger(days) || days <= 0) return false;
  return days === 3 || days === 7 || days === 14 || days === 30 || days === 365 || days % 50 === 0;
}

/** Orbi's reaction to hitting a streak milestone today — a proud wiggle. */
export function pickStreakReaction(days: number): MascotReaction {
  return isStreakMilestone(days)
    ? { pose: 'proud', animate: 'wiggle' }
    : { pose: 'relaxed', animate: 'none' };
}
