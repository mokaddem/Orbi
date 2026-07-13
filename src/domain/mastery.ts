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
import type { GameMode } from './types';
import { parseItemKey } from './training';
import { FAMILIES, MASTERY_MODES, type MasteryFamily } from './modes';

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
  /**
   * Whether the country has map geometry (default `true`). `false` (only Tuvalu today) makes the
   * **Map family N/A** in {@link computeFamilyMastery} — it has no map SR items, so counting Map
   * against it would cap its mastery below 100% forever. Ignored by the legacy {@link computeMastery}.
   */
  hasGeometry?: boolean;
}

export interface MasteryOptions {
  /** Clock, injected for deterministic tests (default `Date.now`). */
  now?: number;
  /**
   * Which game modes count toward this rollup (default: the four country-identification
   * {@link MASTERY_MODES}). Pass `CAPITAL_MODES` to compute the separate capital-mastery
   * tally (Phase 24) over the same country denominator.
   */
  modes?: readonly GameMode[];
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
  const modes = options.modes ?? MASTERY_MODES;

  // Fold the per-mode items down to two per-country facts: has it been seen at all, and is
  // at least one mode mastered (the lenient rule). Only items in `modes` count — by default
  // the four identity modes; capital modes (Phase 24) roll up separately via CAPITAL_MODES.
  const seen = new Set<string>();
  const mastered = new Set<string>();
  for (const item of srItems) {
    const parsed = parseItemKey(item.itemKey);
    if (!parsed) continue;
    if (!modes.includes(parsed.mode)) continue;
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

// --- Per-family mastery (Phase 41) --------------------------------------------------------
//
// Replaces the lenient "any one of four modes masters a country" headline with a **combined,
// per-family** model. Country knowledge is split into the three {@link FAMILIES} — Map, Flags,
// Capitals — each covering *both* of its directions. A family is `mastered` only when **both**
// direction items clear {@link isItemMastered} (the "both ways" rule, Phase 41 OQ1; flip the
// `>= 2` below to `>= 1` for an "either direction" rule); `learning` once *any* of its modes is
// seen; `unseen` otherwise. Capitals is now core here (it used to be a separate "extra" topic);
// languages & industries stay on the legacy {@link computeMastery} as separate tallies.

/** Per-family country tally within a scope (region or overall). */
export interface FamilyTally {
  family: MasteryFamily;
  /** Countries (for which the family applies) with **both** directions mastered. */
  mastered: number;
  /** Applicable countries seen in ≥ 1 of the family's modes but not both-mastered. */
  learning: number;
  /** Applicable countries with no SR state in either of the family's modes. */
  unseen: number;
  /** Applicable countries — the family's denominator (Map excludes geometry-less countries). */
  total: number;
}

/** A combined per-family rollup: the three families plus the blended + fully-mastered headline. */
export interface FamilyMasteryRollup {
  /** One entry per {@link FAMILIES} member, in that order. */
  families: FamilyTally[];
  /** Countries whose *every applicable* family is mastered — the honest "fully learned" count. */
  fullyMastered: number;
  /**
   * Countries with some core activity (≥ 1 family seen) but **not yet** fully mastered — the
   * "learning" bucket. Makes a single high-accuracy pass visible (it moves items to learning long
   * before mastery). `fullyMastered + inProgress + unseen === total`.
   */
  inProgress: number;
  /** Countries with no core (Map / Flags / Capitals) SR state at all. */
  unseen: number;
  /**
   * Blended progress in [0, 1]: mastered *(country × applicable-family)* cells over all applicable
   * cells. Rises with any family for any country, so the meter stays motivating; equals the mean of
   * the family fractions when every family applies to every country.
   */
  blended: number;
  /** Country denominator in scope. */
  total: number;
}

/** A per-region combined rollup, carrying the untranslated M49 region key. */
export interface RegionFamilyMastery extends FamilyMasteryRollup {
  region: string;
}

/** The full per-family picture: overall + per-region, regions least-complete (lowest blended) first. */
export interface FamilyMasteryResult {
  overall: FamilyMasteryRollup;
  byRegion: RegionFamilyMastery[];
}

/** Map applies to a country unless it has no geometry; Flags & Capitals apply to every country. */
function familyApplies(family: MasteryFamily, c: MasteryCountry): boolean {
  return family === 'map' ? c.hasGeometry !== false : true;
}

/**
 * Roll persisted SR state up into overall + per-region **combined family** mastery (Phase 41).
 * Pure and order-independent given `now`. `countries` is the injected denominator (carry
 * `hasGeometry` so the Map family is skipped for geometry-less countries).
 */
export function computeFamilyMastery(
  srItems: readonly SRItem[],
  countries: readonly MasteryCountry[],
  options: { now?: number } = {},
): FamilyMasteryResult {
  const now = options.now ?? Date.now();

  // Which family each core mode belongs to (languages/industries map to nothing → skipped).
  const familyOf = new Map<GameMode, MasteryFamily>();
  for (const fam of FAMILIES) for (const m of fam.modes) familyOf.set(m, fam.key);

  // iso2 → family → count of the family's direction modes seen / mastered (each 0–2).
  const perCountry = new Map<string, Map<MasteryFamily, { seen: number; mastered: number }>>();
  for (const item of srItems) {
    const parsed = parseItemKey(item.itemKey);
    if (!parsed) continue;
    const fam = familyOf.get(parsed.mode);
    if (!fam) continue;
    let byFam = perCountry.get(parsed.iso2);
    if (!byFam) perCountry.set(parsed.iso2, (byFam = new Map()));
    const cell = byFam.get(fam) ?? { seen: 0, mastered: 0 };
    cell.seen += 1;
    if (isItemMastered(item, now)) cell.mastered += 1;
    byFam.set(fam, cell);
  }

  const familyStateOf = (iso2: string, family: MasteryFamily): MasteryState => {
    const cell = perCountry.get(iso2)?.get(family);
    if (!cell || cell.seen === 0) return 'unseen';
    return cell.mastered >= 2 ? 'mastered' : 'learning'; // OQ1: both directions ⇒ mastered
  };

  const emptyRollup = (): FamilyMasteryRollup => ({
    families: FAMILIES.map((f) => ({
      family: f.key,
      mastered: 0,
      learning: 0,
      unseen: 0,
      total: 0,
    })),
    fullyMastered: 0,
    inProgress: 0,
    unseen: 0,
    blended: 0,
    total: 0,
  });

  const overall = emptyRollup();
  const byRegionMap = new Map<string, RegionFamilyMastery>();
  // Applicable/mastered "cells" (country × family) for the blended fraction, per scope.
  const overallCells = { mastered: 0, applicable: 0 };
  const regionCells = new Map<string, { mastered: number; applicable: number }>();

  for (const c of countries) {
    let region = byRegionMap.get(c.region);
    if (!region) byRegionMap.set(c.region, (region = { region: c.region, ...emptyRollup() }));
    const rc = regionCells.get(c.region) ?? { mastered: 0, applicable: 0 };
    regionCells.set(c.region, rc);

    let applicable = 0;
    let mastered = 0;
    let seenAny = false;
    for (let i = 0; i < FAMILIES.length; i++) {
      const family = FAMILIES[i].key;
      if (!familyApplies(family, c)) continue;
      applicable += 1;
      const state = familyStateOf(c.iso2, family);
      region.families[i][state] += 1;
      region.families[i].total += 1;
      overall.families[i][state] += 1;
      overall.families[i].total += 1;
      if (state === 'mastered') mastered += 1;
      if (state !== 'unseen') seenAny = true;
    }

    // Bucket the country: fully mastered (every applicable family) → in progress (some activity,
    // not yet full) → unseen (no core SR). These three always sum to the total.
    if (applicable > 0 && mastered === applicable) {
      overall.fullyMastered += 1;
      region.fullyMastered += 1;
    } else if (seenAny) {
      overall.inProgress += 1;
      region.inProgress += 1;
    } else {
      overall.unseen += 1;
      region.unseen += 1;
    }
    overall.total += 1;
    region.total += 1;
    overallCells.mastered += mastered;
    overallCells.applicable += applicable;
    rc.mastered += mastered;
    rc.applicable += applicable;
  }

  overall.blended =
    overallCells.applicable === 0 ? 0 : overallCells.mastered / overallCells.applicable;
  for (const [region, cells] of regionCells) {
    const r = byRegionMap.get(region)!;
    r.blended = cells.applicable === 0 ? 0 : cells.mastered / cells.applicable;
  }

  // Least-complete first (lowest blended), then most cells still to master, then name.
  const byRegion = [...byRegionMap.values()].sort(
    (a, b) =>
      a.blended - b.blended ||
      b.total - b.fullyMastered - (a.total - a.fullyMastered) ||
      a.region.localeCompare(b.region),
  );

  return { overall, byRegion };
}

// --- Region × family practice pool (Phase 41 follow-on) --------------------------------------
//
// Powers the per-family "practise" shortcut on the Progress world-mastery breakdown: given a
// region and a family, assemble a launchable drill of that region's **unmastered** countries
// (learning + unseen) for the family's **weaker direction** — whichever of its two direction
// modes has more not-yet-mastered countries. A session runs a single mode, so we target the
// direction with the most work; the family fills as the player drills each direction in turn.
// Mirrors {@link computeFamilyMastery}'s applicability rules (Map is N/A for geometry-less
// countries), so the pool always matches the count the mini-bar shows. Pure & deterministic
// given `now`.

/** A launchable region×family drill: the direction mode to run and its weakest-first pool. */
export interface RegionFamilyPractice {
  mode: GameMode;
  iso2s: string[];
}

/**
 * Assemble the region×family practice pool, or `null` when the family is already fully mastered
 * in this region (nothing to drill). The chosen `mode` is the family's weaker direction; `iso2s`
 * are that direction's not-yet-mastered applicable countries, weakest-first (most-overdue seen
 * items ahead of never-seen ones).
 */
export function regionFamilyPracticePool(
  srItems: readonly SRItem[],
  countries: readonly MasteryCountry[],
  region: string,
  family: MasteryFamily,
  options: { now?: number } = {},
): RegionFamilyPractice | null {
  const now = options.now ?? Date.now();
  const fam = FAMILIES.find((f) => f.key === family);
  if (!fam) return null;

  // Index this family's SR items by `mode:iso2` for O(1) mastered lookups.
  const items = new Map<string, SRItem>();
  const famModes = new Set<GameMode>(fam.modes);
  for (const item of srItems) {
    const parsed = parseItemKey(item.itemKey);
    if (parsed && famModes.has(parsed.mode)) items.set(item.itemKey, item);
  }
  const masteredIn = (mode: GameMode, iso2: string): boolean => {
    const it = items.get(`${mode}:${iso2}`);
    return !!it && isItemMastered(it, now);
  };

  // Applicable countries in this region (Map excludes geometry-less countries, as in mastery).
  const applicable = countries.filter((c) => c.region === region && familyApplies(family, c));

  // Pick the weaker direction: the family mode with more not-yet-mastered applicable countries.
  // Ties keep the family's first mode (stable, matching `FAMILIES` order).
  let chosen: GameMode = fam.modes[0];
  let chosenUnmastered = -1;
  for (const mode of fam.modes) {
    const n = applicable.reduce((s, c) => (masteredIn(mode, c.iso2) ? s : s + 1), 0);
    if (n > chosenUnmastered) {
      chosen = mode;
      chosenUnmastered = n;
    }
  }
  if (chosenUnmastered <= 0) return null; // both directions fully mastered here

  // The pool: applicable countries not yet mastered in the chosen direction, weakest-first —
  // seen-but-weak (most overdue, then most-missed) ahead of never-seen (dataset order).
  const weakness = (iso2: string): { seen: boolean; dueAt: number; lapses: number } => {
    const it = items.get(`${chosen}:${iso2}`);
    return it
      ? { seen: true, dueAt: it.dueAt, lapses: it.lapses }
      : { seen: false, dueAt: Infinity, lapses: -1 };
  };
  const pool = applicable
    .filter((c) => !masteredIn(chosen, c.iso2))
    .sort((a, b) => {
      const wa = weakness(a.iso2);
      const wb = weakness(b.iso2);
      if (wa.seen !== wb.seen) return wa.seen ? -1 : 1; // seen (has SR state) before never-seen
      if (wa.dueAt !== wb.dueAt) return wa.dueAt - wb.dueAt; // most overdue first
      return wb.lapses - wa.lapses; // then most-missed
    });

  return { mode: chosen, iso2s: pool.map((c) => c.iso2) };
}
