// Question generation, distractor selection, and answer checking (Phase 2).
//
// Pure and deterministic given an injected `Rng` — no DOM, no storage. The session
// engine (session.ts) draws answers one at a time via `buildQuestion`; the batch
// `generateQuestions` is a convenience for callers that want a fixed list up front.

import type { Country, CountryName } from '../data/types';
import type { AttributeOption, GameMode, Question, RegionFilter } from './types';
import { type Rng, defaultRng, shuffle } from './rng';
import { isAttributeMode } from './modes';

/** Default number of multiple-choice options per question (including the answer). */
export const DEFAULT_CHOICES = 4;

/** The stable per-item key used across questions, history, and SR state. */
export function itemKey(mode: GameMode, iso2: string): string {
  return `${mode}:${iso2}`;
}

/** Whether a mode presents multiple-choice options. `map-locate` uses the map instead. */
export function hasOptions(mode: GameMode): boolean {
  return mode !== 'map-locate';
}

/** Whether a mode renders the world map (as prompt or answer surface). */
export function isMapMode(mode: GameMode): boolean {
  return mode === 'map-highlight' || mode === 'map-locate';
}

/** True when the filter actually constrains something. */
function isActive(filter?: RegionFilter): filter is RegionFilter {
  return !!filter && (!!filter.region || !!filter.subregion);
}

/** Narrow a country list to a region / sub-region filter. No filter → a copy of all. */
export function filterCountries(countries: readonly Country[], filter?: RegionFilter): Country[] {
  if (!isActive(filter)) return countries.slice();
  return countries.filter(
    (c) =>
      (!filter.region || c.region === filter.region) &&
      (!filter.subregion || c.subregion === filter.subregion),
  );
}

/**
 * Narrow a pool to the countries that can be the *answer* in `mode`. Map modes need
 * map geometry — a country the bundled TopoJSON has no shape for (e.g. Tuvalu) can be
 * neither highlighted nor clicked, making the question impossible — so those are
 * dropped. Flag modes accept every country. Distractors are intentionally *not*
 * filtered: a geometry-less country is still a perfectly valid name option.
 */
export function eligibleAnswers(mode: GameMode, pool: readonly Country[]): Country[] {
  return isMapMode(mode) ? pool.filter((c) => c.hasGeometry) : pool.slice();
}

/**
 * Pick `count` distractors for `answer`, preferring the closest geography: same
 * sub-region first, then the rest of the region, then the rest of the world. The
 * three tiers are disjoint and exclude the answer, so results never duplicate and
 * never include the answer. Returns fewer than `count` only if `universe` as a
 * whole cannot supply enough distinct countries.
 */
export function selectDistractors(
  answer: Country,
  universe: readonly Country[],
  count: number,
  rng: Rng = defaultRng,
): Country[] {
  const others = universe.filter((c) => c.iso2 !== answer.iso2);
  const sameSubregion = others.filter((c) => c.subregion === answer.subregion);
  const sameRegionOnly = others.filter(
    (c) => c.region === answer.region && c.subregion !== answer.subregion,
  );
  const elsewhere = others.filter((c) => c.region !== answer.region);

  const chosen: Country[] = [];
  for (const tier of [sameSubregion, sameRegionOnly, elsewhere]) {
    if (chosen.length >= count) break;
    chosen.push(...shuffle(tier, rng).slice(0, count - chosen.length));
  }
  return chosen;
}

/** The localized attribute value a country carries for an attribute mode. */
function attributeOf(mode: GameMode, country: Country): CountryName {
  switch (mode) {
    case 'country-to-capital':
      return country.capital;
    default:
      throw new Error(`attributeOf: ${mode} is not an attribute mode`);
  }
}

/**
 * Build one question for `answer` in `mode`. Country-option modes get `choices` shuffled
 * country options including the answer; attribute modes (e.g. `country-to-capital`) get
 * `attributeOptions` — localized values keyed by the owning country's ISO2, with
 * `correctOptionId` marking the answer's. `map-locate` gets neither (the map is the input).
 * Distractors are drawn from `universe` with the same geography tiering in both cases.
 */
export function buildQuestion(
  mode: GameMode,
  answer: Country,
  universe: readonly Country[],
  choices: number = DEFAULT_CHOICES,
  rng: Rng = defaultRng,
): Question {
  const question: Question = { itemKey: itemKey(mode, answer.iso2), mode, answer };
  if (isAttributeMode(mode)) {
    const distractors = selectDistractors(answer, universe, Math.max(0, choices - 1), rng);
    const options: AttributeOption[] = shuffle([answer, ...distractors], rng).map((c) => ({
      id: c.iso2,
      label: attributeOf(mode, c),
    }));
    question.attributeOptions = options;
    question.correctOptionId = answer.iso2;
  } else if (hasOptions(mode)) {
    const distractors = selectDistractors(answer, universe, Math.max(0, choices - 1), rng);
    question.options = shuffle([answer, ...distractors], rng);
  }
  return question;
}

/**
 * Produce an ordered sequence of `count` answer countries from `pool`, shuffling
 * and reshuffling as needed. Avoids the same country appearing back-to-back across
 * a reshuffle boundary (impossible only when the pool has a single country).
 */
export function drawAnswerSequence(
  pool: readonly Country[],
  count: number,
  rng: Rng = defaultRng,
): Country[] {
  if (pool.length === 0 || count <= 0) return [];
  const out: Country[] = [];
  let bag: Country[] = [];
  while (out.length < count) {
    if (bag.length === 0) {
      bag = shuffle(pool, rng);
      const prev = out[out.length - 1];
      if (prev && bag.length > 1 && bag[0].iso2 === prev.iso2) {
        [bag[0], bag[1]] = [bag[1], bag[0]];
      }
    }
    out.push(bag.shift()!);
  }
  return out;
}

/** Options for {@link generateQuestions}. */
export interface GenerateOptions {
  mode: GameMode;
  /** The full candidate list (typically every in-scope country). */
  countries: readonly Country[];
  /** How many questions to produce. */
  count: number;
  /** Optional filter narrowing which countries are *asked about*. */
  filter?: RegionFilter;
  /** Options per question (default 4). Ignored for `map-locate`. */
  choices?: number;
  rng?: Rng;
}

/**
 * Generate a batch of questions. The `filter` restricts which countries are asked;
 * distractors are always tiered against the full `countries` list so a tiny
 * sub-region filter can still fall back to region/world for enough options.
 */
export function generateQuestions(opts: GenerateOptions): Question[] {
  const rng = opts.rng ?? defaultRng;
  const choices = opts.choices ?? DEFAULT_CHOICES;
  const answers = eligibleAnswers(opts.mode, filterCountries(opts.countries, opts.filter));
  const sequence = drawAnswerSequence(answers, opts.count, rng);
  return sequence.map((answer) => buildQuestion(opts.mode, answer, opts.countries, choices, rng));
}

/** Resolve a picked answer to an uppercase ISO code, or `null` for "no answer". */
function pickedIso(pick: Country | string | null | undefined): string | null {
  if (pick == null) return null;
  return typeof pick === 'string' ? pick.toUpperCase() : pick.iso2;
}

/**
 * Whether `pick` correctly answers `question`. Accepts a `Country`, an ISO
 * alpha-2/alpha-3 string, or `null`/`undefined` (no answer / timeout → incorrect).
 *
 * For attribute modes the pick is an {@link AttributeOption} id (a raw string, compared
 * as-is to `correctOptionId`); for country modes it is an ISO code / `Country`.
 */
export function checkAnswer(
  question: Question,
  pick: Country | string | null | undefined,
): boolean {
  if (question.correctOptionId !== undefined) {
    const id = typeof pick === 'string' ? pick : (pick?.iso2 ?? null);
    return id != null && id === question.correctOptionId;
  }
  const iso = pickedIso(pick);
  if (iso == null) return false;
  return iso === question.answer.iso2 || iso === question.answer.iso3;
}
