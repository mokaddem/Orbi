// Shared types for the pure domain layer (Phase 2).
//
// These describe questions, answers, and play sessions. They stay framework- and
// storage-agnostic: the persisted shapes in `main_PRD.md` (SessionRecord, SRItem)
// are built *from* these in Phases 6–7, so `QuestionResult` here is the bridge.

import type { Country, CountryName } from '../data/types';

/** The ways the same country knowledge is exercised. */
export type GameMode =
  | 'flag-to-country' // see a flag → pick the country name
  | 'country-to-flag' // see a country name → pick the flag
  | 'map-highlight' // a country is highlighted on the map → pick its name
  | 'map-locate' // given a country name → click it on the map
  | 'capital-to-country' // see a capital city → pick the country (Phase 24)
  | 'country-to-capital' // see a country → pick its capital city (Phase 24)
  | 'country-to-languages' // see a country → select ALL its languages (Phase 23, multi-select)
  | 'country-to-industry'; // see a country → pick one of its main industries (Phase 25, single-select)

/**
 * A non-country multiple-choice option — a localized *attribute value* the player picks
 * (Phase 24's capital strings; reused by Phases 23/25 for languages/industries). The
 * answer stays a `Country` for keying, so `id` identifies the option (for capitals it is
 * the owning country's ISO2) and `correctOptionId` on the question says which is right.
 */
export interface AttributeOption {
  /**
   * Stable option id, unique within a question. Capitals: owning country's ISO2.
   * Languages: ISO-639-3 code. Industries: taxonomy key (e.g. "oil-gas").
   */
  id: string;
  /** The value shown on the option card, localized. */
  label: CountryName;
}

/**
 * How a session ends. `training` (SR-driven) is wired up in Phase 7. `full` (Phase 35, the
 * "Grand Tour") asks about **every** country in the selected scope exactly once — uncapped,
 * no lives — finishing when the answer pool is exhausted. `blitz` (Phase 42) is time-boxed:
 * the pure engine never ends it (its draw bag refills so only the *clock* stops the run — see
 * `session.ts`), and the UI calls {@link QuizSession.end} when its countdown hits zero.
 */
export type SessionType = 'fixed' | 'survival' | 'training' | 'full' | 'blitz';

/** Optional region / sub-region narrowing of the country pool. */
export interface RegionFilter {
  region?: string;
  subregion?: string;
}

/**
 * One question. `answer` is the country to identify; `options` are the shuffled
 * multiple-choice candidates (including the answer). `map-locate` has no options —
 * the whole map is the input surface — so `options` is left undefined for it.
 */
export interface Question {
  /** Stable per-item key `${mode}:${iso2}`, shared with history and SR state. */
  itemKey: string;
  mode: GameMode;
  answer: Country;
  /** Country options (country-identification modes and `capital-to-country`). */
  options?: Country[];
  /**
   * Attribute-value options (attribute modes like `country-to-capital` / `country-to-languages`).
   * Present instead of `options`; the correct one(s) are {@link correctOptionId} (single-select)
   * or {@link correctOptionIds} (multi-select).
   */
  attributeOptions?: AttributeOption[];
  /** Single-select attribute modes: the id of the one correct {@link AttributeOption}. */
  correctOptionId?: string;
  /**
   * Multi-select attribute modes (`country-to-languages`): the ids of *all* correct options.
   * Grading is all-or-nothing — the picked set must equal this set exactly.
   */
  correctOptionIds?: string[];
}

/**
 * The outcome of a single answered question. Emitted verbatim so Phases 6 (history)
 * and 7 (spaced repetition) can persist and schedule without reshaping data.
 */
export interface QuestionResult {
  itemKey: string; // `${mode}:${iso2}`
  countryIso2: string;
  correct: boolean;
  answerMs: number; // time from question shown to answer submitted
}

/** Lifecycle of a session: before the first question, during play, and after it ends. */
export type SessionStatus = 'idle' | 'active' | 'finished';

/** A snapshot of a session's live state, safe to read from the UI after each call. */
export interface SessionState {
  status: SessionStatus;
  /** 0-based ordinal of the current (or most recent) question. */
  index: number;
  /** The question awaiting an answer, or `null` when idle / finished. */
  current: Question | null;
  results: QuestionResult[];
  correct: number;
  /** Current run of consecutive correct answers. */
  streak: number;
  /** Longest streak reached this session. */
  bestStreak: number;
  /** Survival only; `Infinity` for non-survival sessions. */
  livesRemaining: number;
  startedAt: number | null;
  finishedAt: number | null;
}

/** End-of-session rollup: score, accuracy, timing, and what was missed. */
export interface SessionSummary {
  mode: GameMode;
  type: SessionType;
  regionFilter?: RegionFilter;
  total: number;
  correct: number;
  /** `correct / total`, in [0, 1]; `0` for an empty session. */
  accuracy: number;
  bestStreak: number;
  /** When the first question was shown (falls back to now for an empty session). */
  startedAt: number;
  /** When the session ended (falls back to now if read before finishing). */
  finishedAt: number;
  durationMs: number;
  /** Distinct countries answered incorrectly, in order of first miss. */
  missed: Country[];
  results: QuestionResult[];
  /**
   * Survival only: `true` when the run ended by **clearing the region** — every country in the
   * answer pool answered correctly at least once, finishing with lives to spare (Phase 40).
   * `false` for a survival loss (0 lives) and for every non-survival type.
   */
  cleared?: boolean;
}
