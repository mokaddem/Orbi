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
  'country-to-languages',
  'country-to-industry',
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

/** The three core knowledge families that combine into per-country mastery (Phase 41). */
export type MasteryFamily = 'map' | 'flags' | 'capitals';

/**
 * The core mastery **families** (Phase 41) — the redefinition of country mastery from the
 * Phase-16 "any one of four identity modes" (lenient OR) to a **combined, per-family** model.
 * Each family covers **both directions** of a skill; a country is *fully mastered* only when all
 * its applicable families are (see `computeFamilyMastery`). Capitals is now core (it used to roll
 * up as a separate "extra knowledge" topic); languages & industries stay separate extras.
 *
 * The `map` family is **N/A for geometry-less countries** (only Tuvalu today) — they can never get
 * map SR items, so `computeFamilyMastery` excludes `map` from their denominator rather than
 * capping their mastery below 100% forever.
 */
export const FAMILIES: readonly { key: MasteryFamily; modes: readonly [GameMode, GameMode] }[] = [
  { key: 'map', modes: ['map-highlight', 'map-locate'] },
  { key: 'flags', modes: ['flag-to-country', 'country-to-flag'] },
  { key: 'capitals', modes: ['capital-to-country', 'country-to-capital'] },
];

/**
 * Modes whose options are attribute values (not countries), so the question carries
 * {@link AttributeOption}s + a `correctOptionId`/`correctOptionIds` instead of country
 * `options`. The `capital-to-country` direction is *not* here — its answer and options are
 * countries; only the prompt is a capital string.
 */
export const ATTRIBUTE_MODES: readonly GameMode[] = [
  'country-to-capital',
  'country-to-languages',
  'country-to-industry',
];

/**
 * Attribute modes where the player selects **several** options (all-or-nothing grading), so
 * the question carries `correctOptionIds`. `country-to-languages` (Phase 23) is the first.
 * `country-to-industry` (Phase 25) is single-select, so it is deliberately *not* here.
 */
export const MULTI_SELECT_MODES: readonly GameMode[] = ['country-to-languages'];

/**
 * The two capital-quiz modes (Phase 24). They roll up into their *own* mastery tally +
 * achievements (kept separate from {@link MASTERY_MODES}); pass this to `computeMastery`'s
 * `modes` option to compute capital mastery.
 */
export const CAPITAL_MODES: readonly GameMode[] = ['capital-to-country', 'country-to-capital'];

/**
 * The national-languages mode(s) (Phase 23). Like capitals, kept out of {@link MASTERY_MODES}
 * and rolled up into their own tally — surfaced together with capitals in the combined
 * "extra knowledge" progress view rather than each getting its own panel.
 */
export const LANGUAGE_MODES: readonly GameMode[] = ['country-to-languages'];

/**
 * The main-industries mode (Phase 25). Single-select "which is a main industry of X"; like
 * capitals/languages it stays out of {@link MASTERY_MODES} and rolls up into its own tally,
 * surfaced in the combined "extra knowledge" progress view.
 */
export const INDUSTRY_MODES: readonly GameMode[] = ['country-to-industry'];

/**
 * The non-country "attribute" topics (Phases 23–25), each a separate mastery ladder folded
 * into one combined progress surface. Order is display order.
 */
export const EXTRA_TOPICS: readonly {
  key: 'capitals' | 'languages' | 'industries';
  modes: readonly GameMode[];
}[] = [
  { key: 'capitals', modes: CAPITAL_MODES },
  { key: 'languages', modes: LANGUAGE_MODES },
  { key: 'industries', modes: INDUSTRY_MODES },
];

/**
 * Modes the app will **propose a spaced-repetition review for** ("Time to review", Phase 26):
 * the country-identification quizzes (maps + flags) plus capitals. The extra-knowledge topics
 * (languages, industries) are deliberately excluded — they are still played and still accrue SR
 * state (and a just-played round can be re-drilled from its summary), but the app never *suggests*
 * a review round for them. `reviewByRegion` and the "review everything" plan filter on this set.
 */
export const REVIEW_MODES: readonly GameMode[] = [...MASTERY_MODES, ...CAPITAL_MODES];

/** Whether `mode` presents attribute-value options rather than country options. */
export function isAttributeMode(mode: GameMode): boolean {
  return ATTRIBUTE_MODES.includes(mode);
}

/** Whether `mode` asks the player to select several options at once (all-or-nothing). */
export function isMultiSelectMode(mode: GameMode): boolean {
  return MULTI_SELECT_MODES.includes(mode);
}

/** Whether `mode` is the single-select main-industries mode (Phase 25). */
export function isIndustryMode(mode: GameMode): boolean {
  return INDUSTRY_MODES.includes(mode);
}

/** Whether `mode` contributes to per-country mastery / achievements. */
export function isMasteryMode(mode: GameMode): boolean {
  return MASTERY_MODES.includes(mode);
}
