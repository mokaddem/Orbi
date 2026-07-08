// "Next up" recommendation engine (Phase 14) — pure, framework-agnostic, unit-testable.
//
// Turns the player's own state into a single prioritised suggestion of what to do next.
// The signals already exist — SM-2 `dueAt` per item (what to review and when) and play
// history (where the player is weak) — but until now they only powered one binary
// "Train my mistakes" button. This module surfaces them as a reasoned, ordered list of
// typed recommendations; the UI renders the top one as a "Next up" card and, on start,
// resolves the chosen recommendation to a `RunConfig`.
//
// Everything here is pure and deterministic given the injected `now` + `regionOf`, so it
// unit-tests with seeded data and no clock — mirroring `selectTrainingItems`.

import type { SessionRecord, SRItem } from '../data/persistence/types';
import { computeRegionAccuracy, type RegionResolver } from './stats';
import { dominantTrainingMode, parseItemKey, selectTrainingItems } from './training';
import type { GameMode, RegionFilter, SessionType } from './types';

/**
 * The kinds of recommendation, in overall priority order:
 * - `due` — SM-2 reviews are due now (`dueAt <= now`); drill the weakest.
 * - `weak-spot` — no reviews due, but one sub-region's recent accuracy is low.
 * - `fresh-start` — the always-available fallback so the card is never empty (fresh
 *   profile, or caught up with nothing weak): just play a round.
 */
export type RecommendationKind = 'due' | 'weak-spot' | 'fresh-start';

/** The launch payload for a recommendation — the recommendation-specific parts of a run. */
export interface RecommendationRun {
  mode: GameMode;
  type: SessionType;
  /** Region narrowing (weak-spot fixed sessions). */
  filter?: RegionFilter;
  /** Explicit countries to drill (due-review training sessions), weakest first. */
  answerPoolIso?: string[];
}

/** One typed suggestion. The UI maps `kind` to a title/reason string and an icon. */
export interface Recommendation {
  kind: RecommendationKind;
  /** The mode this would play (absent for `fresh-start`, which opens the setup screen). */
  mode?: GameMode;
  /** Sub-region key for a weak spot (the untranslated M49 label, localised at render). */
  regionKey?: string;
  /** Parent region of `regionKey` — used to pick the continent silhouette for the icon. */
  iconRegion?: string;
  /** Payload count: number of due items (`due`), or attempts in the region (`weak-spot`). */
  count?: number;
  /** Recent accuracy in the weak sub-region, in [0, 1] (`weak-spot` only). */
  accuracy?: number;
  /** Ready-to-launch config, absent for `fresh-start` (the card just routes to setup). */
  run?: RecommendationRun;
}

export interface RecommendOptions {
  /** Clock, injected for deterministic tests (default `Date.now`). */
  now?: number;
  /** Resolve an ISO alpha-2 code to its region/sub-region (data-agnostic; see stats.ts). */
  regionOf: RegionResolver;
  /** Cap on how many due items a due-review recommendation drills. */
  dueLimit?: number;
  /** Minimum attempts in a sub-region before it can qualify as a weak spot. */
  weakSpotMinAttempts?: number;
  /** Accuracy (in [0, 1]) a sub-region must be *below* to count as weak. */
  weakSpotMaxAccuracy?: number;
}

/** Owner-agreed defaults (Phase 14): drill ≤ 20 due items; a weak spot needs ≥ 10 attempts and < 70%. */
export const DEFAULT_DUE_LIMIT = 20;
export const DEFAULT_WEAK_SPOT_MIN_ATTEMPTS = 10;
export const DEFAULT_WEAK_SPOT_MAX_ACCURACY = 0.7;

/**
 * Pick the mode to play when drilling a weak sub-region: the mode most-often attempted
 * there (so the recommendation targets how the player actually plays it). The mode lives
 * in each `itemKey` (`mode:iso2`). Ties break by the fixed mode order via
 * `dominantTrainingMode`-style iteration; `flag-to-country` is the ultimate fallback.
 */
function modeForSubregion(
  records: readonly SessionRecord[],
  subregion: string,
  regionOf: RegionResolver,
): GameMode {
  const counts = new Map<GameMode, number>();
  for (const rec of records) {
    for (const q of rec.questions) {
      if (regionOf(q.countryIso2)?.subregion !== subregion) continue;
      const parsed = parseItemKey(q.itemKey);
      if (!parsed) continue;
      counts.set(parsed.mode, (counts.get(parsed.mode) ?? 0) + 1);
    }
  }
  let best: GameMode = 'flag-to-country';
  let bestCount = 0;
  // Iterate a fixed mode order for a deterministic tie-break.
  for (const mode of [
    'flag-to-country',
    'country-to-flag',
    'map-highlight',
    'map-locate',
  ] as const) {
    const count = counts.get(mode) ?? 0;
    if (count > bestCount) {
      best = mode;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Build the ordered list of recommendations from persisted SR state + play history.
 * Priority (owner-agreed): due-for-review → weak-spot → fresh-start. The list always
 * ends with a `fresh-start`, so it is never empty and the UI's top card always renders.
 * Pure and deterministic given `now` and `regionOf`.
 */
export function recommend(
  srItems: readonly SRItem[],
  sessions: readonly SessionRecord[],
  options: RecommendOptions,
): Recommendation[] {
  const now = options.now ?? Date.now();
  const dueLimit = options.dueLimit ?? DEFAULT_DUE_LIMIT;
  const minAttempts = options.weakSpotMinAttempts ?? DEFAULT_WEAK_SPOT_MIN_ATTEMPTS;
  const maxAccuracy = options.weakSpotMaxAccuracy ?? DEFAULT_WEAK_SPOT_MAX_ACCURACY;

  const recs: Recommendation[] = [];

  // 1. DUE — items whose SM-2 review is strictly due (dueAt <= now). A session commits to
  //    one mode, so drill the mode with the most due items, weakest first. Missed-but-not-
  //    yet-due items are intentionally excluded here (they're covered by the "train all
  //    mistakes" link) so weak-spot gets a turn once reviews are caught up.
  const dueMode = dominantTrainingMode(srItems, { now, dueOnly: true });
  if (dueMode) {
    const dueItems = selectTrainingItems(srItems, {
      now,
      mode: dueMode,
      dueOnly: true,
      limit: dueLimit,
    });
    if (dueItems.length > 0) {
      recs.push({
        kind: 'due',
        mode: dueMode,
        count: dueItems.length,
        run: { mode: dueMode, type: 'training', answerPoolIso: dueItems.map((i) => i.iso2) },
      });
    }
  }

  // 2. WEAK-SPOT — the weakest sub-region with enough of a sample to be meaningful.
  //    computeRegionAccuracy already sorts weakest-first, so the first qualifier wins.
  const weakest = computeRegionAccuracy(sessions, options.regionOf).find(
    (r) => r.attempts >= minAttempts && r.accuracy < maxAccuracy,
  );
  if (weakest) {
    const mode = modeForSubregion(sessions, weakest.subregion, options.regionOf);
    recs.push({
      kind: 'weak-spot',
      mode,
      regionKey: weakest.subregion,
      iconRegion: weakest.region,
      count: weakest.attempts,
      accuracy: weakest.accuracy,
      run: {
        mode,
        type: 'fixed',
        filter: { region: weakest.region, subregion: weakest.subregion },
      },
    });
  }

  // 3. FRESH-START — always present as the tail so the card is never empty. Carries no
  //    run payload: starting it routes to the normal Play setup screen.
  recs.push({ kind: 'fresh-start' });

  return recs;
}
