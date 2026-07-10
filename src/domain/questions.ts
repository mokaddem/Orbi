// Question generation, distractor selection, and answer checking (Phase 2).
//
// Pure and deterministic given an injected `Rng` — no DOM, no storage. The session
// engine (session.ts) draws answers one at a time via `buildQuestion`; the batch
// `generateQuestions` is a convenience for callers that want a fixed list up front.

import type { Country, CountryName, LanguageRef } from '../data/types';
import type { AttributeOption, GameMode, Question, RegionFilter } from './types';
import { type Rng, defaultRng, shuffle } from './rng';
import { isAttributeMode, isMultiSelectMode } from './modes';

/** Default number of multiple-choice options per question (including the answer). */
export const DEFAULT_CHOICES = 4;

/**
 * Upper bound on how many languages a country may have to be *asked about* in the
 * `country-to-languages` mode (Phase 23). "Select all N languages" stays sane and the grid
 * stays readable; countries above it are excluded as answers (like map modes drop
 * geometry-less countries). At 5 this drops exactly three: Namibia (9), South Africa (11),
 * and Zimbabwe (15) — whose long recognized-language lists are also the fuzziest.
 */
export const MAX_QUIZ_LANGUAGES = 5;

/** Whether a country can be the *answer* in the languages mode (few enough languages). */
export function isLanguageQuizEligible(country: Country): boolean {
  const n = country.languages.length;
  return n >= 1 && n <= MAX_QUIZ_LANGUAGES;
}

/**
 * How many option cards a `country-to-languages` question shows given `k` correct languages:
 * every correct language plus a few distractors, clamped to a readable 6–8 total (so there
 * are always ≥ 3 distractors and the grid never balloons). Independent of `choicesPerQuestion`.
 */
export function languageOptionCount(k: number): number {
  return Math.min(8, Math.max(6, k + 3));
}

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
 * dropped. The languages mode drops countries with too many languages to ask "select all"
 * about ({@link isLanguageQuizEligible}). Other modes accept every country. Distractors are
 * intentionally *not* filtered: an excluded country is still a valid distractor/option.
 */
export function eligibleAnswers(mode: GameMode, pool: readonly Country[]): Country[] {
  if (isMapMode(mode)) return pool.filter((c) => c.hasGeometry);
  if (mode === 'country-to-languages') return pool.filter(isLanguageQuizEligible);
  return pool.slice();
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

/**
 * Pick `count` distractor languages for `answer` — languages the country does **not** speak —
 * tiered by geography like {@link selectDistractors}: languages of its sub-region first, then
 * the rest of its region, then the wider world. Each language is assigned to its *closest*
 * tier, distinct by ISO-639-3 code, and shuffled within the tier. Never returns a language the
 * answer actually speaks. Returns fewer than `count` only if `universe` cannot supply enough
 * distinct foreign languages.
 *
 * Unlike the capitals trick (map a distractor *country* to its lone capital), languages are
 * many-to-many — a neighbour often shares the answer's language — so distractors are drawn
 * from the language pool directly, excluding every language the answer speaks.
 */
export function selectLanguageDistractors(
  answer: Country,
  universe: readonly Country[],
  count: number,
  rng: Rng = defaultRng,
): LanguageRef[] {
  const spoken = new Set(answer.languages.map((l) => l.code));
  // code → the language and the closest geography tier it was seen in.
  const best = new Map<string, { ref: LanguageRef; tier: number }>();
  for (const c of universe) {
    if (c.iso2 === answer.iso2) continue;
    const tier = c.subregion === answer.subregion ? 0 : c.region === answer.region ? 1 : 2;
    for (const lang of c.languages) {
      if (spoken.has(lang.code)) continue;
      const prev = best.get(lang.code);
      if (!prev || tier < prev.tier) best.set(lang.code, { ref: lang, tier });
    }
  }

  const buckets: LanguageRef[][] = [[], [], []];
  for (const { ref, tier } of best.values()) buckets[tier].push(ref);

  const chosen: LanguageRef[] = [];
  for (const bucket of buckets) {
    if (chosen.length >= count) break;
    chosen.push(...shuffle(bucket, rng).slice(0, count - chosen.length));
  }
  return chosen;
}

/** The localized attribute value a country carries for a single-select attribute mode. */
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
 * country options including the answer. Single-select attribute modes (`country-to-capital`)
 * get `attributeOptions` + `correctOptionId`. Multi-select attribute modes
 * (`country-to-languages`) get `attributeOptions` (all the country's languages + foreign
 * distractors) + `correctOptionIds` (every one it speaks). `map-locate` gets neither (the map
 * is the input). Distractors are drawn from `universe` with geography tiering throughout.
 */
export function buildQuestion(
  mode: GameMode,
  answer: Country,
  universe: readonly Country[],
  choices: number = DEFAULT_CHOICES,
  rng: Rng = defaultRng,
): Question {
  const question: Question = { itemKey: itemKey(mode, answer.iso2), mode, answer };
  if (isMultiSelectMode(mode)) {
    // Languages: every language the country speaks is correct; the rest are foreign
    // distractors. Option count adapts to the number of correct languages (6–8 total).
    const correct = answer.languages;
    const distractors = selectLanguageDistractors(
      answer,
      universe,
      Math.max(0, languageOptionCount(correct.length) - correct.length),
      rng,
    );
    const options: AttributeOption[] = shuffle([...correct, ...distractors], rng).map((l) => ({
      id: l.code,
      label: l.name,
    }));
    question.attributeOptions = options;
    question.correctOptionIds = correct.map((l) => l.code);
  } else if (isAttributeMode(mode)) {
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
 * alpha-2/alpha-3 string, a `string[]` (multi-select option ids), or `null`/`undefined`
 * (no answer / timeout → incorrect).
 *
 * - Multi-select attribute modes (`correctOptionIds`): all-or-nothing — the picked set of
 *   ids must equal the correct set exactly (no extras, none missing).
 * - Single-select attribute modes (`correctOptionId`): the pick id must match.
 * - Country modes: the pick's ISO code must match the answer's alpha-2/alpha-3.
 */
export function checkAnswer(
  question: Question,
  pick: Country | string | string[] | null | undefined,
): boolean {
  if (question.correctOptionIds !== undefined) {
    if (!Array.isArray(pick)) return false;
    const want = question.correctOptionIds;
    const got = new Set(pick);
    return got.size === want.length && want.every((id) => got.has(id));
  }
  if (Array.isArray(pick)) return false; // an array pick only makes sense for multi-select
  if (question.correctOptionId !== undefined) {
    const id = typeof pick === 'string' ? pick : (pick?.iso2 ?? null);
    return id != null && id === question.correctOptionId;
  }
  const iso = pickedIso(pick);
  if (iso == null) return false;
  return iso === question.answer.iso2 || iso === question.answer.iso3;
}
