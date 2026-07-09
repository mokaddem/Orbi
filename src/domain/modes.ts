// Game-mode registry — the canonical lists the rest of the domain filters against.
//
// A single source of truth for "which modes exist" and "which modes count toward
// progress", so adding a mode is a one-line change here rather than a hunt through
// every consumer. Kept pure and dependency-free.

import type { GameMode } from './types';

/**
 * Every playable mode, in display order. Used to validate item keys (`parseItemKey`),
 * enumerate modes for training, and drive mode labels. A capital mode belongs here so
 * its SR items parse and it is trainable — but see {@link MASTERY_MODES}.
 */
export const ALL_MODES: readonly GameMode[] = [
  'flag-to-country',
  'country-to-flag',
  'map-highlight',
  'map-locate',
  'capital-to-country',
  'country-to-capital',
];

/**
 * The country-identification modes that feed **per-country mastery and achievements**
 * (Phase 16). The capital modes (Phase 24) are deliberately excluded: capitals is a
 * standalone play + spaced-repetition mode that records history and is trainable, but
 * does not move the "how much of the world have I learned" mastery tally. Consumers that
 * roll SR state up into mastery filter on this set.
 */
export const MASTERY_MODES: readonly GameMode[] = [
  'flag-to-country',
  'country-to-flag',
  'map-highlight',
  'map-locate',
];

/**
 * Modes whose options are attribute values (not countries), so the question carries
 * {@link AttributeOption}s + a `correctOptionId` instead of country `options`. The
 * `capital-to-country` direction is *not* here — its answer and options are countries;
 * only the prompt is a capital string.
 */
export const ATTRIBUTE_MODES: readonly GameMode[] = ['country-to-capital'];

/**
 * The two capital-quiz modes (Phase 24). They roll up into their *own* mastery tally +
 * achievements (kept separate from {@link MASTERY_MODES}); pass this to `computeMastery`'s
 * `modes` option to compute capital mastery.
 */
export const CAPITAL_MODES: readonly GameMode[] = ['capital-to-country', 'country-to-capital'];

/** Whether `mode` presents attribute-value options rather than country options. */
export function isAttributeMode(mode: GameMode): boolean {
  return ATTRIBUTE_MODES.includes(mode);
}

/** Whether `mode` contributes to per-country mastery / achievements. */
export function isMasteryMode(mode: GameMode): boolean {
  return MASTERY_MODES.includes(mode);
}
