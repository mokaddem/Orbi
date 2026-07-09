// Mastery rollup (Phase 16) — pure, framework-agnostic, unit-testable.
//
// Turns the persisted SM-2 state into a "how much of the world have I learned" tally:
// overall and per M49 region. Mastery is defined per *country*, but SR state is per item
// (`mode:iso2`, four modes per country), so this module rolls the four modes into one
// country verdict.
//
// Owner-agreed rules (see Phase 16 PRD open questions):
//  - **Lenient country rule** — a country is "mastered" if *any* one of its four modes
//    clears the item bar. Numbers climb early and stay motivating; revisit if it feels loose.
//  - **Item bar** — an item is mastered once it has ≥ `MASTERY_MIN_REPETITIONS` correct
//    recalls in a row *and* its next review is still in the future (not overdue). A lapse
//    resets SM-2 `repetitions` to 0, so a missed item drops back to "learning" for free.
//  - **Denominator** — all countries in the dataset ("learn the world"), injected by the
//    caller so this module never imports the data layer and stays pure/testable.
//
// Clock and country list are injected, so this is deterministic and needs no fake timer.

import type { SRItem } from '../data/persistence/types';
import { parseItemKey } from './training';
import { isMasteryMode } from './modes';

/** Owner-agreed SR bar: consecutive correct recalls required to count an item mastered. */
export const MASTERY_MIN_REPETITIONS = 2;

/** Per-country mastery verdict. */
export type MasteryState = 'mastered' | 'learning' | 'unseen';

/** A tally of countries partitioned by mastery state, plus the denominator. */
export interface MasteryRollup {
  mastered: number;
  learning: number;
  /** Countries never answered in any mode. `mastered + learning + unseen === total`. */
  unseen: number;
  total: number;
}

/** A per-region tally, carrying the untranslated M49 region key for display/icon. */
export interface RegionMastery extends MasteryRollup {
  region: string;
}

/** The full mastery picture: overall tally + per-region breakdown. */
export interface MasteryResult {
  overall: MasteryRollup;
  /** One entry per region, ordered least-complete first (doubles as a to-do list). */
  byRegion: RegionMastery[];
}

/** A country to count, reduced to just what mastery needs (keeps this module data-agnostic). */
export interface MasteryCountry {
  iso2: string;
  region: string;
}

export interface MasteryOptions {
  /** Clock, injected for deterministic tests (default `Date.now`). */
  now?: number;
}

/**
 * Whether a single SR item clears the "mastered" bar at `now`: enough repetitions and not
 * overdue. A fresh lapse (repetitions reset to 0, due now) fails both halves, demoting the
 * item — and, via the lenient rule, possibly its country — back to "learning".
 */
export function isItemMastered(item: SRItem, now: number): boolean {
  return item.repetitions >= MASTERY_MIN_REPETITIONS && item.dueAt > now;
}

/** `mastered / total` in [0, 1]; `0` for an empty denominator. */
export function masteryFraction(rollup: MasteryRollup): number {
  return rollup.total === 0 ? 0 : rollup.mastered / rollup.total;
}

/**
 * Roll persisted SR state up into overall + per-region country mastery. `countries` is the
 * full denominator (injected). Pure and order-independent given `now`.
 *
 * A country is `mastered` if any of its mode items {@link isItemMastered}, `learning` if it
 * has been answered in some mode but none is mastered, and `unseen` if it has no SR state
 * at all. Regions are ordered least-complete first (lowest mastered fraction).
 */
export function computeMastery(
  srItems: readonly SRItem[],
  countries: readonly MasteryCountry[],
  options: MasteryOptions = {},
): MasteryResult {
  const now = options.now ?? Date.now();

  // Fold the four per-mode items down to two per-country facts: has it been seen at all,
  // and is at least one mode mastered (the lenient rule).
  const seen = new Set<string>();
  const mastered = new Set<string>();
  for (const item of srItems) {
    const parsed = parseItemKey(item.itemKey);
    if (!parsed) continue;
    // Only the country-identification modes count toward mastery; capital modes (Phase 24)
    // are trained and recorded but deliberately don't move the mastery tally.
    if (!isMasteryMode(parsed.mode)) continue;
    seen.add(parsed.iso2);
    if (isItemMastered(item, now)) mastered.add(parsed.iso2);
  }

  const stateOf = (iso2: string): MasteryState =>
    mastered.has(iso2) ? 'mastered' : seen.has(iso2) ? 'learning' : 'unseen';

  const overall: MasteryRollup = { mastered: 0, learning: 0, unseen: 0, total: 0 };
  const byRegionMap = new Map<string, RegionMastery>();

  for (const c of countries) {
    const state = stateOf(c.iso2);

    const region = byRegionMap.get(c.region) ?? {
      region: c.region,
      mastered: 0,
      learning: 0,
      unseen: 0,
      total: 0,
    };
    region[state] += 1;
    region.total += 1;
    byRegionMap.set(c.region, region);

    overall[state] += 1;
    overall.total += 1;
  }

  // Least-complete first: lowest mastered fraction, then most countries still to learn,
  // then region name for a stable total order.
  const byRegion = [...byRegionMap.values()].sort(
    (a, b) =>
      masteryFraction(a) - masteryFraction(b) ||
      b.total - b.mastered - (a.total - a.mastered) ||
      a.region.localeCompare(b.region),
  );

  return { overall, byRegion };
}
