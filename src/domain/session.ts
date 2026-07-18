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
  /**
   * Explicit `(mode, iso2)` question slots, overriding both `answerPool` and `filter`. Powers the
   * combined region×family practice session (Phase 41 follow-on): both of a family's directions
   * interleaved in one run, so a country can be asked twice (once per direction). Each slot is
   * asked once — a `fixed` run of `slots.length` — and each question is built with its **own**
   * slot's mode, so the session's `mode` is only the summary's representative direction. Slots for
   * a country not in `countries`, or a country the slot's mode can't ask about, are dropped; the
   * survivors must be non-empty.
   */
  answerSlots?: readonly { mode: GameMode; iso2: string }[];
  /** `fixed` only — number of questions (default 10). */
  fixedLength?: number;
  /** `survival` only — number of lives (default 3). */
  lives?: number;
  /** Options per question (default 4). */
  choices?: number;
  rng?: Rng;
  /**
   * The 32-bit seed behind `rng`, recorded verbatim on the {@link SessionSummary} so a finished run
   * is reproducible and thus duel-able (Phase 46). The session never derives `rng` from it — the
   * caller passes `rng = mulberry32(seed)` — it is carried through for the summary only. Absent for a
   * run given a bare, seedless `rng`.
   */
  seed?: number;
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
  private readonly seed?: number;
  private readonly now: () => number;

  private readonly universe: readonly Country[];
  private readonly answers: readonly Country[];
  private readonly byIso2: Map<string, Country>;

  /**
   * The interleaved `(mode, country)` queue for a multi-mode run (combined practice), or `null`
   * for an ordinary single-mode session. When set it drives `next()` instead of `answers`, so each
   * question carries its own slot's mode.
   */
  private readonly slotQueue: readonly { mode: GameMode; country: Country }[] | null;
  private slotBag: { mode: GameMode; country: Country }[] = [];

  private bag: Country[] = [];
  private lastAnswerIso: string | null = null;
  private questionStartedAt = 0;
  /**
   * Distinct iso2 answered **correctly at least once** (survival "region cleared" win, Phase 40).
   * A country missed then later gotten right still counts, so a region can be cleared on the last
   * life. `size` can't overshoot `answers.length` — questions only ever draw from `answers`.
   */
  private readonly cleared = new Set<string>();

  private readonly s: SessionState;

  constructor(config: SessionConfig) {
    this.mode = config.mode;
    this.type = config.type;
    this.filter = config.filter;
    this.fixedLength = config.fixedLength ?? DEFAULT_FIXED_LENGTH;
    this.lives = config.lives ?? DEFAULT_LIVES;
    this.choices = config.choices ?? DEFAULT_CHOICES;
    this.rng = config.rng ?? defaultRng;
    this.seed = config.seed;
    this.now = config.now ?? Date.now;

    this.universe = config.countries;
    this.byIso2 = new Map(this.universe.map((c) => [c.iso2, c]));

    // A multi-mode slot queue (combined practice) wins over everything: resolve each slot's country
    // and keep only those the slot's own mode can ask about (map modes drop geometry-less countries,
    // exactly as `eligibleAnswers` does per single mode). `answers` then holds the distinct countries
    // — the distractor/summary universe — while `slotQueue` drives the per-question mode.
    if (config.answerSlots && config.answerSlots.length) {
      const resolved = config.answerSlots
        .map((slot) => {
          const country = this.byIso2.get(slot.iso2);
          return country && eligibleAnswers(slot.mode, [country]).length > 0
            ? { mode: slot.mode, country }
            : null;
        })
        .filter((s): s is { mode: GameMode; country: Country } => s !== null);
      if (resolved.length === 0) {
        throw new Error('QuizSession: the training slot queue is empty');
      }
      this.slotQueue = resolved;
      const distinct = new Map(resolved.map((s) => [s.country.iso2, s.country]));
      this.answers = [...distinct.values()];
    } else {
      this.slotQueue = null;
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
    }

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
   * The number of questions a full pass of this session asks: distinct answerable countries for a
   * single-mode run (the length of a `full` "Grand Tour"), or the total slot count for a multi-mode
   * combined-practice run (where a country can appear once per direction). The UI reads it for the
   * run's total.
   */
  get answerCount(): number {
    return this.slotQueue ? this.slotQueue.length : this.answers.length;
  }

  isFinished(): boolean {
    return this.s.status === 'finished';
  }

  /**
   * End the session immediately, regardless of the normal finish conditions. This is the only
   * way a `blitz` run ends — its {@link shouldFinish} never trips (the draw bag refills forever),
   * so the UI-owned countdown calls this at zero. Idempotent and safe to call at any time; a
   * pending unanswered question is simply dropped (never counted). No-op once finished.
   */
  end(): void {
    this.finish();
  }

  /**
   * Present the next question and start its timer. Returns the current unanswered
   * question if one is already pending, or `null` once the session is finished.
   */
  next(): Question | null {
    if (this.s.status === 'finished') return null;
    if (this.s.current) return this.s.current;

    // A multi-mode run draws a slot (its own mode + country); a single-mode run draws just a
    // country and asks it in the session's one mode.
    const { mode, answer } = this.slotQueue
      ? this.drawSlot()
      : { mode: this.mode, answer: this.drawAnswer() };
    if (this.s.startedAt === null) this.s.startedAt = this.now();
    this.s.status = 'active';
    this.s.index += 1;
    this.s.current = buildQuestion(mode, answer, this.universe, this.choices, this.rng);
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
      this.cleared.add(question.answer.iso2);
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
      // A survival run that *finished with lives left* can only have ended by clearing the
      // region (the sole other survival finish is 0 lives). Gated on `finished` so a mid-run
      // `summary()` never reads as cleared; `false` for non-survival types.
      cleared:
        this.type === 'survival' && this.s.status === 'finished' && this.s.livesRemaining > 0,
      // Carry the run's parameters so the Summary can build a reproducible duel (Phase 46): the seed
      // (question order + distractors), the option count (distractor sampling), and — for survival —
      // the life count (the end condition).
      ...(this.seed !== undefined ? { seed: this.seed } : {}),
      choices: this.choices,
      ...(this.type === 'survival' ? { lives: this.lives } : {}),
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

  /**
   * Draw the next `(mode, country)` slot for a multi-mode run. Mirrors {@link drawAnswer}'s draw-bag
   * (shuffle-without-replacement, refilling only if a `fixedLength` outruns the queue) and its
   * no-immediate-repeat guard, keyed on the country so the same country isn't asked back-to-back in
   * its two directions. Only called when `slotQueue` is set.
   */
  private drawSlot(): { mode: GameMode; answer: Country } {
    if (this.slotBag.length === 0) {
      this.slotBag = shuffle(this.slotQueue!, this.rng);
      if (
        this.lastAnswerIso &&
        this.slotBag.length > 1 &&
        this.slotBag[0].country.iso2 === this.lastAnswerIso
      ) {
        [this.slotBag[0], this.slotBag[1]] = [this.slotBag[1], this.slotBag[0]];
      }
    }
    const slot = this.slotBag.shift()!;
    return { mode: slot.mode, answer: slot.country };
  }

  private shouldFinish(): boolean {
    // Blitz (Phase 42) is time-boxed, not count-boxed: the pure engine never ends it. The draw
    // bag simply reshuffles and continues (see `drawAnswer` — a small pool refills rather than
    // exhausting), so only the UI's countdown, via `end()`, stops the run.
    if (this.type === 'blitz') return false;
    // Survival ends in a **loss** at 0 lives, or a **win** once the region is *cleared* —
    // every country in the answer pool answered correctly at least once (Phase 40). Without
    // the clear, a flawless run reshuffles the draw bag forever.
    if (this.type === 'survival')
      return this.s.livesRemaining <= 0 || this.cleared.size >= this.answers.length;
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
