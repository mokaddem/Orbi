// "Next up" recommendation engine (Phase 14; region-scoped in Phase 26) — pure and
// framework-agnostic.
//
// Turns the player's own state into a single prioritised suggestion of what to do next.
// The signal is SM-2 `dueAt` + `lapses` per item (what to review): until Phase 26 this
// powered a global "Time to review" that pooled every weak item worldwide, so a one-off
// "World" round could bury the region the player is actually studying. It is now
// **region-scoped**: the top recommendation reviews the single most-urgent region's
// trainable items (see `reviewByRegion`), and Home offers the full per-region list. The
// old fresh-round "weak-spot" nudge is folded into this region review (unify, Phase 26).
//
// Everything here is pure and deterministic given the injected `now` + `regionOf`, so it
// unit-tests with seeded data and no clock — mirroring `selectTrainingItems`.

import type { SessionRecord, SRItem } from '../data/persistence/types';
import type { RegionResolver } from './stats';
import { reviewByRegion } from './review';
import type { GameMode, RegionFilter, SessionType } from './types';

/**
 * The kinds of recommendation, in overall priority order:
 * - `due` — there are items worth reviewing (due now, or previously missed); drill the
 *   most-urgent region's weakest items, scoped to that region so foreign-region items
 *   never enter the session.
 * - `fresh-start` — the always-available fallback so the card is never empty (fresh
 *   profile, or all caught up with nothing weak): just play a round.
 */
export type RecommendationKind = 'due' | 'fresh-start';

/** The launch payload for a recommendation — the recommendation-specific parts of a run. */
export interface RecommendationRun {
  mode: GameMode;
  type: SessionType;
  /** Region narrowing (unused by the current kinds; kept for forward-compat fixed sessions). */
  filter?: RegionFilter;
  /** Explicit countries to drill (region-scoped review sessions), weakest first. */
  answerPoolIso?: string[];
}

/** One typed suggestion. The UI maps `kind` to a title/reason string and an icon. */
export interface Recommendation {
  kind: RecommendationKind;
  /** The mode this would play (absent for `fresh-start`, which opens the setup screen). */
  mode?: GameMode;
  /** Top-level region a `due` review is scoped to (raw M49 key; localised at render). */
  regionKey?: string;
  /** Payload count: number of items the region review will drill (`due` only). */
  count?: number;
  /** Ready-to-launch config, absent for `fresh-start` (the card just routes to setup). */
  run?: RecommendationRun;
}

export interface RecommendOptions {
  /** Clock, injected for deterministic tests (default `Date.now`). */
  now?: number;
  /** Resolve an ISO alpha-2 code to its region/sub-region (data-agnostic; see stats.ts). */
  regionOf: RegionResolver;
  /** Cap on how many items the region review drills. */
  dueLimit?: number;
}

/** Owner-agreed default (Phase 14): drill ≤ 20 items in a single review. */
export const DEFAULT_DUE_LIMIT = 20;

/**
 * Build the ordered list of recommendations from persisted SR state. Priority: a
 * region-scoped review (the most-urgent region with trainable items) → fresh-start. The
 * list always ends with a `fresh-start`, so it is never empty and the UI's top card always
 * renders. `sessions` is accepted for signature stability (history-based signals may return)
 * but is unused now that weak-spot is folded into the region review. Pure and deterministic
 * given `now` and `regionOf`.
 */
export function recommend(
  srItems: readonly SRItem[],
  _sessions: readonly SessionRecord[],
  options: RecommendOptions,
): Recommendation[] {
  const now = options.now ?? Date.now();
  const dueLimit = options.dueLimit ?? DEFAULT_DUE_LIMIT;

  const recs: Recommendation[] = [];

  // 1. REGION REVIEW — the most-urgent region's trainable items (due now or previously
  //    missed), scoped to that region so a polluted "World" backlog can't bury it. Ordered
  //    most-due-first by reviewByRegion, so the first entry is the region worth reviewing now.
  const topRegion = reviewByRegion(srItems, options.regionOf, { now, limit: dueLimit })[0];
  if (topRegion && topRegion.total > 0) {
    recs.push({
      kind: 'due',
      mode: topRegion.mode,
      regionKey: topRegion.region,
      count: topRegion.total,
      run: { mode: topRegion.mode, type: 'training', answerPoolIso: topRegion.iso2s },
    });
  }

  // 2. FRESH-START — always present as the tail so the card is never empty. Carries no
  //    run payload: starting it routes to the normal Play setup screen.
  recs.push({ kind: 'fresh-start' });

  return recs;
}
