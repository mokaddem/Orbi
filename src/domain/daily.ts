// Daily Challenge definition (Phase 15) — pure, framework-agnostic, unit-testable.
//
// The Daily Challenge is a normal fixed-length session whose *contents are reproducible
// for a given calendar day*: the same date always yields the same mode, region theme, and
// — once the seeded RNG flows through the generator — the same questions, order, and
// distractors. This is the first production use of the seedable `mulberry32` (Phase 2);
// until now it existed only for deterministic tests.
//
// A "seeded rotating theme" (owner-agreed): the date seed itself picks the mode and the
// region, so every day feels fresh with no extra infrastructure. Length and option count
// are fixed constants (not prefs) so the challenge is identical for everyone playing that
// day regardless of their gameplay settings.

import { mulberry32, randomInt } from './rng';
import type { GameMode, RegionFilter } from './types';

/** The four modes the daily rotation draws from, in a fixed order (seed picks the index). */
const DAILY_MODES: readonly GameMode[] = [
  'flag-to-country',
  'country-to-flag',
  'map-highlight',
  'map-locate',
];

/**
 * Region themes for the rotation. `null` means the whole world; the five M49 regions each
 * have at least 10 members (Oceania, the smallest, has 14), so a 10-question fixed session
 * always fills. Kept as plain labels here — the pure layer never touches the dataset; the
 * UI turns the theme into a {@link RegionFilter} and localises the name for display.
 */
const DAILY_THEMES: readonly (string | null)[] = [
  null,
  'Africa',
  'Americas',
  'Asia',
  'Europe',
  'Oceania',
];

/** Fixed question count for every Daily Challenge (independent of the player's prefs). */
export const DAILY_LENGTH = 10;
/** Fixed number of options per question, so distractor sets are reproducible day to day. */
export const DAILY_CHOICES = 4;

/** A fully-specified Daily Challenge for one calendar day. */
export interface DailyChallenge {
  /** The local day-key (`YYYY-MM-DD`) this challenge belongs to. */
  dateKey: string;
  /** Seed derived from `dateKey`; feeds `mulberry32` for reproducible questions. */
  seed: number;
  /** The mode to play. */
  mode: GameMode;
  /** Region narrowing for the theme; absent means the whole world. */
  filter?: RegionFilter;
  /** Number of questions. */
  length: number;
}

/**
 * Deterministic 32-bit seed from a `YYYY-MM-DD` day-key (FNV-1a string hash). Stable across
 * calls for the same input; different days produce different seeds with good spread.
 */
export function dailySeed(dateKey: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < dateKey.length; i += 1) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Build the Daily Challenge for a given day-key. Deterministic: the same `dateKey` always
 * yields the same mode + theme (and seed), and consecutive days differ. The returned seed,
 * fed to `mulberry32` by the caller, makes the actual questions reproducible too.
 */
export function buildDailyChallenge(dateKey: string): DailyChallenge {
  const seed = dailySeed(dateKey);
  const rng = mulberry32(seed);
  const mode = DAILY_MODES[randomInt(rng, DAILY_MODES.length)];
  const theme = DAILY_THEMES[randomInt(rng, DAILY_THEMES.length)];
  return {
    dateKey,
    seed,
    mode,
    ...(theme ? { filter: { region: theme } } : {}),
    length: DAILY_LENGTH,
  };
}
