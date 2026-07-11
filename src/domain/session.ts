// Play-session state machine (Phase 2).
//
// A `QuizSession` drives one game from first question to summary. It is pure and
// deterministic given injected `rng` and `now`, so end conditions, scoring, and
// timing are all unit-testable. No DOM, no storage — the UI reads `state` after
// each `next()` / `submit()` and persistence (Phase 6) consumes `summary()`.

import type { Country } from '../data/types';
import type {
  GameMode,
  Question,
  QuestionResult,
  RegionFilter,
  SessionState,
  SessionSummary,
  SessionType,
} from './types';
import { type Rng, defaultRng, shuffle } from './rng';
import {
  DEFAULT_CHOICES,
  buildQuestion,
  checkAnswer,
  eligibleAnswers,
  filterCountries,
} from './questions';

/** Default number of questions in a `fixed` session. */
export const DEFAULT_FIXED_LENGTH = 10;
/** Default number of lives in a `survival` session. */
export const DEFAULT_LIVES = 3;

export interface SessionConfig {
  mode: GameMode;
  type: SessionType;
  /** The candidate list; distractors tier against this whole set. */
  countries: readonly Country[];
  /** Narrows which countries are asked about (also recorded in the summary). */
  filter?: RegionFilter;
  /**
   * Explicit set of countries to *ask about*, overriding `filter`. Used by `training`
   * sessions to focus on specific weak items while still drawing distractors from the
   * full `countries` universe. Must be non-empty.
   */
  answerPool?: readonly Country[];
  /** `fixed` only — number of questions (default 10). */
  fixedLength?: number;
  /** `survival` only — number of lives (default 3). */
  lives?: number;
  /** Options per question (default 4). */
  choices?: number;
  rng?: Rng;
  /** Clock injection for deterministic timing in tests (default `Date.now`). */
  now?: () => number;
}

/**
 * One quiz session. Usage: `next()` to present a question, `submit(pick)` to grade
 * it; repeat until `isFinished()`, then read `summary()`. `next()` is a no-op once
 * finished; `submit()` throws if there is no active question.
 */
export class QuizSession {
  readonly mode: GameMode;
  readonly type: SessionType;
  private readonly filter?: RegionFilter;
  private readonly fixedLength: number;
  private readonly lives: number;
  private readonly choices: number;
  private readonly rng: Rng;
  private readonly now: () => number;

  private readonly universe: readonly Country[];
  private readonly answers: readonly Country[];
  private readonly byIso2: Map<string, Country>;

  private bag: Country[] = [];
  private lastAnswerIso: string | null = null;
  private questionStartedAt = 0;

  private readonly s: SessionState;

  constructor(config: SessionConfig) {
    this.mode = config.mode;
    this.type = config.type;
    this.filter = config.filter;
    this.fixedLength = config.fixedLength ?? DEFAULT_FIXED_LENGTH;
    this.lives = config.lives ?? DEFAULT_LIVES;
    this.choices = config.choices ?? DEFAULT_CHOICES;
    this.rng = config.rng ?? defaultRng;
    this.now = config.now ?? Date.now;

    this.universe = config.countries;
    // An explicit answer pool (training) wins over the region filter; otherwise the
    // filter narrows the *answers*. Distractors always tier against `universe` — the
    // `countries` list exactly as passed in — so a caller that wants region-scoped
    // distractors (as the UI's play store does for a filtered game) passes an already
    // region-filtered `countries` list. Map modes then drop geometry-less countries
    // (they can't be highlighted/clicked); flag modes keep everything.
    const rawAnswers = config.answerPool
      ? config.answerPool.slice()
      : filterCountries(config.countries, config.filter);
    this.answers = eligibleAnswers(this.mode, rawAnswers);
    if (this.answers.length === 0) {
      throw new Error(
        config.answerPool
          ? 'QuizSession: the training answer pool is empty'
          : 'QuizSession: the country pool is empty after applying the region filter',
      );
    }
    this.byIso2 = new Map(this.universe.map((c) => [c.iso2, c]));

    this.s = {
      status: 'idle',
      index: -1,
      current: null,
      results: [],
      correct: 0,
      streak: 0,
      bestStreak: 0,
      livesRemaining: this.type === 'survival' ? this.lives : Infinity,
      startedAt: null,
      finishedAt: null,
    };
  }

  /** The live session state. Treat as read-only; snapshot it into UI state as needed. */
  get state(): Readonly<SessionState> {
    return this.s;
  }

  /**
   * The number of distinct countries this session can ask about — the answer pool *after*
   * the mode's eligibility filter (map modes drop geometry-less countries). This is exactly
   * the length of a `full` ("Grand Tour") run, so the UI reads it to show the right total.
   */
  get answerCount(): number {
    return this.answers.length;
  }

  isFinished(): boolean {
    return this.s.status === 'finished';
  }

  /**
   * Present the next question and start its timer. Returns the current unanswered
   * question if one is already pending, or `null` once the session is finished.
   */
  next(): Question | null {
    if (this.s.status === 'finished') return null;
    if (this.s.current) return this.s.current;

    const answer = this.drawAnswer();
    if (this.s.startedAt === null) this.s.startedAt = this.now();
    this.s.status = 'active';
    this.s.index += 1;
    this.s.current = buildQuestion(this.mode, answer, this.universe, this.choices, this.rng);
    this.lastAnswerIso = answer.iso2;
    this.questionStartedAt = this.now();
    return this.s.current;
  }

  /**
   * Grade the active question, record a {@link QuestionResult} (with timing), update
   * score / streak / lives, and finish the session if an end condition is met.
   * `pick` may be a `Country`, an ISO code, a `string[]` (multi-select option ids), or
   * `null` (no answer → incorrect).
   */
  submit(pick: Country | string | string[] | null | undefined): QuestionResult {
    const question = this.s.current;
    if (!question) {
      throw new Error('QuizSession.submit(): no active question — call next() first');
    }

    const correct = checkAnswer(question, pick);
    const result: QuestionResult = {
      itemKey: question.itemKey,
      countryIso2: question.answer.iso2,
      correct,
      answerMs: Math.max(0, this.now() - this.questionStartedAt),
    };
    this.s.results.push(result);
    this.s.current = null;

    if (correct) {
      this.s.correct += 1;
      this.s.streak += 1;
      if (this.s.streak > this.s.bestStreak) this.s.bestStreak = this.s.streak;
    } else {
      this.s.streak = 0;
      if (this.type === 'survival') this.s.livesRemaining -= 1;
    }

    if (this.shouldFinish()) this.finish();
    return result;
  }

  /** The end-of-session rollup. Safe to call before finishing (reflects progress so far). */
  summary(): SessionSummary {
    const results = this.s.results;
    const total = results.length;
    const started = this.s.startedAt ?? this.now();
    const finished = this.s.finishedAt ?? this.now();

    const seen = new Set<string>();
    const missed: Country[] = [];
    for (const r of results) {
      if (r.correct || seen.has(r.countryIso2)) continue;
      seen.add(r.countryIso2);
      const country = this.byIso2.get(r.countryIso2);
      if (country) missed.push(country);
    }

    return {
      mode: this.mode,
      type: this.type,
      regionFilter: this.filter,
      total,
      correct: this.s.correct,
      accuracy: total === 0 ? 0 : this.s.correct / total,
      bestStreak: this.s.bestStreak,
      startedAt: started,
      finishedAt: finished,
      durationMs: Math.max(0, finished - started),
      missed,
      results: results.slice(),
    };
  }

  private drawAnswer(): Country {
    if (this.bag.length === 0) {
      this.bag = shuffle(this.answers, this.rng);
      if (this.lastAnswerIso && this.bag.length > 1 && this.bag[0].iso2 === this.lastAnswerIso) {
        [this.bag[0], this.bag[1]] = [this.bag[1], this.bag[0]];
      }
    }
    return this.bag.shift()!;
  }

  private shouldFinish(): boolean {
    if (this.type === 'survival') return this.s.livesRemaining <= 0;
    // `full` (Grand Tour) runs until every country in the answer pool has been asked once;
    // the draw bag is exhausted without replacement, so this asks each exactly once.
    if (this.type === 'full') return this.s.results.length >= this.answers.length;
    return this.s.results.length >= this.fixedLength;
  }

  private finish(): void {
    if (this.s.status === 'finished') return;
    this.s.status = 'finished';
    this.s.current = null;
    this.s.finishedAt = this.now();
  }
}

/** Convenience factory mirroring the functional style of the data layer. */
export function createSession(config: SessionConfig): QuizSession {
  return new QuizSession(config);
}
