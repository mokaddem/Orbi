// Region-scoped review selection (Phase 26) — pure, framework-agnostic, unit-testable.
//
// "Train my mistakes" used to pool *every* weak item worldwide into one queue, so a one-off
// "World" round that seeded failed items across many regions would then drown out the region
// the player is actually working on. This module groups the trainable SR state (items due for
// review OR ever missed — see `selectTrainingItems`) by **top-level M49 region**, so the UI can
// offer "review Europe" without foreign-region items entering the session.
//
// It is a pure *selection + grouping* step on top of `selectTrainingItems`; the session engine
// already accepts an explicit answer pool (`answerPoolIso`), so a region-scoped review is just
// one of these region pools handed to a training session. `regionOf` is injected (mirroring
// `recommend`) so this stays decoupled from the bundled dataset.

import type { SRItem } from '../data/persistence/types';
import type { RegionResolver } from './stats';
import { selectTrainingItems, type TrainingItem } from './training';
import { ALL_MODES, REVIEW_MODES } from './modes';
import type { GameMode } from './types';

/** One top-level region's review pool: the items to drill and how urgent it is. */
export interface RegionReview {
  /** Top-level M49 region, e.g. "Europe" (the raw English key; localised at render). */
  region: string;
  /** The mode this region's review runs — the one most-represented among its trainable items. */
  mode: GameMode;
  /** ISO alpha-2 codes to drill, weakest first, in the chosen `mode`, capped at `limit`. */
  iso2s: string[];
  /** How many of `iso2s` are currently due (`dueAt <= now`) — drives the most-urgent ordering. */
  due: number;
  /** `iso2s.length` — the number of items a region-scoped session actually asks about. */
  total: number;
}

export interface ReviewByRegionOptions {
  /** Clock, injected for deterministic tests (default `Date.now`). */
  now?: number;
  /** Per-region cap on the drilled pool (mirrors a training session's length cap). */
  limit?: number;
  /**
   * Modes eligible to be *proposed* for review. Defaults to {@link REVIEW_MODES} (maps, flags,
   * capitals): the app never suggests reviewing the extra-knowledge topics (languages/industries),
   * even when the player has missed them — so a region whose only weak items are in an excluded
   * mode produces no review at all.
   */
  modes?: readonly GameMode[];
}

/**
 * Pick the mode to run for a region's review: the mode with the most trainable items there
 * (a session commits to one mode, so target how the player most plays this region). Ties break
 * by the fixed `ALL_MODES` order for determinism.
 */
function dominantModeOf(items: readonly TrainingItem[]): GameMode {
  const counts = new Map<GameMode, number>();
  for (const it of items) counts.set(it.mode, (counts.get(it.mode) ?? 0) + 1);
  let best: GameMode = ALL_MODES[0];
  let bestCount = -1;
  for (const mode of ALL_MODES) {
    const count = counts.get(mode) ?? 0;
    if (count > bestCount) {
      best = mode;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Group the trainable SR state by top-level region into per-region review pools, most-urgent
 * first. Trainable = due or ever-missed (the `selectTrainingItems` default), restricted to the
 * review-eligible modes (`options.modes`, default {@link REVIEW_MODES}: maps, flags, capitals) —
 * so this subsumes the old global "train all" pool *and* the weak-spot nudge, partitioned by
 * region, but never proposes reviewing the extra-knowledge topics.
 *
 * Each region commits to its dominant mode; `iso2s` are that mode's items, weakest first,
 * capped at `limit`. Regions are ordered by most-due, then most-total, then region name — so
 * `result[0]` is the region worth reviewing first. Pure and deterministic given `now`.
 */
export function reviewByRegion(
  srItems: readonly SRItem[],
  regionOf: RegionResolver,
  options: ReviewByRegionOptions = {},
): RegionReview[] {
  const now = options.now ?? Date.now();

  // All trainable items, already ordered weakest-first (due before not-due, then by lapses…),
  // scoped to the review-eligible modes so we never propose reviewing languages/industries.
  const items = selectTrainingItems(srItems, { now, modes: options.modes ?? REVIEW_MODES });

  // Partition by top-level region, preserving the weakest-first order within each group.
  const byRegion = new Map<string, TrainingItem[]>();
  for (const it of items) {
    const region = regionOf(it.iso2)?.region;
    if (!region) continue; // unknown code — skip, mirroring stats/recommend
    const group = byRegion.get(region) ?? [];
    group.push(it);
    byRegion.set(region, group);
  }

  const reviews: RegionReview[] = [];
  for (const [region, group] of byRegion) {
    const mode = dominantModeOf(group);
    let pool = group.filter((it) => it.mode === mode); // weakest-first preserved by filter
    if (options.limit != null) pool = pool.slice(0, Math.max(0, options.limit));
    reviews.push({
      region,
      mode,
      iso2s: pool.map((it) => it.iso2),
      due: pool.filter((it) => it.due).length,
      total: pool.length,
    });
  }

  // Most urgent first: most due, then largest pool, then region name for a stable total order.
  return reviews.sort(
    (a, b) => b.due - a.due || b.total - a.total || a.region.localeCompare(b.region),
  );
}
