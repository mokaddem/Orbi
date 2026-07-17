// Grandmaster Run — the gated "prove-it" capstone (Phase 44).
//
// A one-life, both-directions challenge over an entire continent, unlocked only once that
// continent's family is *already* fully mastered (Phase 41). Every country is asked in **both**
// of the family's directions, the answer options are the **whole continent** (no 4-choice crutch,
// and they never shrink as the board clears), and a single miss ends the run — a clean sweep
// certifies.
//
// Pure and deterministic given an injected `rng` / `now`, like the rest of the domain: the queue
// order, the one-life finish, and pass/fail grading are all unit-testable with no DOM or storage.
// The normal `QuizSession` is left **untouched** — a challenge interleaves two modes and fails
// fast, which does not fit the single-mode draw bag, so it gets its own small driver here.

import type { Country } from '../data/types';
import type { AttributeOption, GameMode, Question, QuestionResult, SessionStatus } from './types';
import { type Rng, defaultRng, shuffle } from './rng';
import { FAMILIES, type MasteryFamily, isAttributeMode } from './modes';
import { checkAnswer, eligibleAnswers, hasOptions, itemKey } from './questions';
import type { FamilyMasteryResult } from './mastery';

/** The two direction modes of a family (e.g. `['flag-to-country', 'country-to-flag']`), or `[]`. */
export function familyModes(family: MasteryFamily): readonly GameMode[] {
  return FAMILIES.find((f) => f.key === family)?.modes ?? [];
}

/**
 * Whether the Grandmaster Run for `family × region` is unlocked: that continent's family is
 * **fully mastered** — every applicable country has the family mastered (both directions, per
 * Phase 41's `computeFamilyMastery`). A pure read of the already-computed rollup, so gating needs
 * no extra persistence. `false` for an unknown region/family or an empty (all-unseen) tally.
 */
export function isChallengeUnlocked(
  mastery: FamilyMasteryResult,
  family: MasteryFamily,
  region: string,
): boolean {
  const tally = mastery.byRegion
    .find((r) => r.region === region)
    ?.families.find((t) => t.family === family);
  return !!tally && tally.total > 0 && tally.mastered === tally.total;
}

/** One question-slot in a run: a country to identify in a specific direction mode. */
export interface ChallengeSlot {
  mode: GameMode;
  iso2: string;
}

/**
 * Build the shuffled clear-the-board queue for `family × countries`: every mode-eligible country,
 * in **both** of the family's directions, interleaved via `rng`. So for Flags/Capitals it is
 * `2 × N` slots; for the Map family the geometry-less countries (only Tuvalu today) drop out of
 * *both* map directions via {@link eligibleAnswers}, exactly as they are excluded from mastery.
 */
export function buildChallengeQueue(
  family: MasteryFamily,
  countries: readonly Country[],
  rng: Rng = defaultRng,
): ChallengeSlot[] {
  const slots: ChallengeSlot[] = [];
  for (const mode of familyModes(family)) {
    for (const c of eligibleAnswers(mode, countries)) slots.push({ mode, iso2: c.iso2 });
  }
  return shuffle(slots, rng);
}

/**
 * How many question-slots a `family × countries` run has — the same `2 × N` (minus mode-ineligible
 * countries) that {@link buildChallengeQueue} produces, without the throwaway shuffle. Used by the
 * offer modal to show the run's real stakes (e.g. Europe map 90, Africa flags 108, Oceania ~52).
 */
export function challengeSlotCount(family: MasteryFamily, countries: readonly Country[]): number {
  let count = 0;
  for (const mode of familyModes(family)) count += eligibleAnswers(mode, countries).length;
  return count;
}

/**
 * Build one challenge question with **fixed, full-continent** options (the anti-crutch rule): the
 * options are every country in `optionPool` and never shrink. `map-locate` gets no options (the
 * map is the input, already unaided). `country-to-capital` (the one attribute mode in a family)
 * gets an option per continent capital keyed by owning ISO2. All other pick-from-list modes
 * (`map-highlight`, `flag-to-country`, `country-to-flag`, `capital-to-country`) get the whole
 * `optionPool` as country options. `optionPool` should be the mode-eligible continent set (so the
 * `answer` is always present); order is left stable — the UI sorts / search-filters it.
 */
export function buildChallengeQuestion(
  mode: GameMode,
  answer: Country,
  optionPool: readonly Country[],
): Question {
  const question: Question = { itemKey: itemKey(mode, answer.iso2), mode, answer };
  if (!hasOptions(mode)) return question; // map-locate — the map is the input surface
  if (isAttributeMode(mode)) {
    const options: AttributeOption[] = optionPool.map((c) => ({ id: c.iso2, label: c.capital }));
    question.attributeOptions = options;
    question.correctOptionId = answer.iso2;
  } else {
    question.options = optionPool.slice();
  }
  return question;
}

/** A snapshot of a run's live state, safe to read from the UI after each `next()` / `submit()`. */
export interface ChallengeState {
  status: SessionStatus;
  /** 0-based ordinal of the current (or most recent) question. */
  index: number;
  /** The question awaiting an answer, or `null` when idle / finished. */
  current: Question | null;
  /** Total question-slots to clear (`2 × N` mode-eligible countries). */
  total: number;
  /** Slots cleared (answered correctly) so far — drives the `cleared / total` bar. */
  cleared: number;
  /** `true` once a miss has ended the run (the one life is spent). */
  failed: boolean;
  results: QuestionResult[];
  startedAt: number | null;
  finishedAt: number | null;
}

export interface ChallengeConfig {
  family: MasteryFamily;
  /** The continent's M49 region key (recorded on the summary; used by the unlock/reward side). */
  region: string;
  /** The continent's countries — the queue and the fixed option pools are built from these. */
  countries: readonly Country[];
  rng?: Rng;
  /** Clock injection for deterministic timing in tests (default `Date.now`). */
  now?: () => number;
}

/** End-of-run rollup: pass/fail, coverage, the country a failed run died on, and timing. */
export interface ChallengeSummary {
  type: 'challenge';
  family: MasteryFamily;
  region: string;
  total: number;
  cleared: number;
  /** `true` only for a clean sweep (every slot cleared, no miss) — the sole certifying outcome. */
  passed: boolean;
  /** The country whose miss ended a failed run, else `null` (passed or unfinished). */
  missed: Country | null;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  results: QuestionResult[];
}

/**
 * One Grandmaster Run. Usage mirrors {@link QuizSession}: `next()` to present a question,
 * `submit(pick)` to grade it; repeat until `isFinished()`, then read `summary()`. **One life** —
 * a wrong `submit()` ends the run immediately (`failed`); a clean sweep of the whole board ends
 * it as a pass. `next()` is a no-op once finished; `submit()` throws with no active question.
 */
export class ChallengeSession {
  readonly family: MasteryFamily;
  readonly region: string;
  private readonly now: () => number;
  private readonly byIso2: Map<string, Country>;
  private readonly optionPools: Map<GameMode, readonly Country[]>;
  private readonly queue: ChallengeSlot[];
  private cursor = 0;
  private questionStartedAt = 0;
  private readonly s: ChallengeState;

  constructor(config: ChallengeConfig) {
    this.family = config.family;
    this.region = config.region;
    this.now = config.now ?? Date.now;
    const rng = config.rng ?? defaultRng;

    this.byIso2 = new Map(config.countries.map((c) => [c.iso2, c]));
    this.optionPools = new Map(
      familyModes(config.family).map((mode) => [mode, eligibleAnswers(mode, config.countries)]),
    );
    this.queue = buildChallengeQueue(config.family, config.countries, rng);
    if (this.queue.length === 0) {
      throw new Error('ChallengeSession: no eligible countries for this family × region');
    }

    this.s = {
      status: 'idle',
      index: -1,
      current: null,
      total: this.queue.length,
      cleared: 0,
      failed: false,
      results: [],
      startedAt: null,
      finishedAt: null,
    };
  }

  /** The live run state. Treat as read-only; snapshot it into UI state as needed. */
  get state(): Readonly<ChallengeState> {
    return this.s;
  }

  /** Total slots to clear (`2 × N` mode-eligible countries). */
  get total(): number {
    return this.s.total;
  }

  isFinished(): boolean {
    return this.s.status === 'finished';
  }

  /** `true` once the board is cleared with no miss — the certifying outcome. */
  get passed(): boolean {
    return this.s.status === 'finished' && !this.s.failed && this.s.cleared === this.s.total;
  }

  /**
   * Present the next question and start its timer. Returns the pending question if one is already
   * active, or `null` once the run is finished (cleared or failed).
   */
  next(): Question | null {
    if (this.s.status === 'finished') return null;
    if (this.s.current) return this.s.current;
    if (this.cursor >= this.queue.length) {
      this.finish();
      return null;
    }

    const slot = this.queue[this.cursor];
    const answer = this.byIso2.get(slot.iso2)!;
    if (this.s.startedAt === null) this.s.startedAt = this.now();
    this.s.status = 'active';
    this.s.index += 1;
    this.s.current = buildChallengeQuestion(
      slot.mode,
      answer,
      this.optionPools.get(slot.mode) ?? [],
    );
    this.questionStartedAt = this.now();
    return this.s.current;
  }

  /**
   * Grade the active question and record a {@link QuestionResult}. A **correct** pick clears the
   * slot and advances (finishing as a pass once the whole board is cleared); a **wrong** pick
   * spends the one life and ends the run immediately. `pick` may be a `Country`, an ISO code, or
   * `null`/`undefined` (no answer → incorrect).
   */
  submit(pick: Country | string | null | undefined): QuestionResult {
    const question = this.s.current;
    if (!question) {
      throw new Error('ChallengeSession.submit(): no active question — call next() first');
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
    this.cursor += 1;

    if (correct) {
      this.s.cleared += 1;
      if (this.s.cleared >= this.s.total) this.finish(); // clean sweep → pass
    } else {
      this.s.failed = true; // one life spent → run over
      this.finish();
    }
    return result;
  }

  /** End the run immediately (e.g. the player quits). Idempotent; a pending question is dropped. */
  end(): void {
    this.finish();
  }

  /** The end-of-run rollup. Safe to call before finishing (reflects progress so far). */
  summary(): ChallengeSummary {
    const started = this.s.startedAt ?? this.now();
    const finished = this.s.finishedAt ?? this.now();
    const last = this.s.results[this.s.results.length - 1];
    const missed = last && !last.correct ? (this.byIso2.get(last.countryIso2) ?? null) : null;

    return {
      type: 'challenge',
      family: this.family,
      region: this.region,
      total: this.s.total,
      cleared: this.s.cleared,
      passed: this.passed,
      missed,
      startedAt: started,
      finishedAt: finished,
      durationMs: Math.max(0, finished - started),
      results: this.s.results.slice(),
    };
  }

  private finish(): void {
    if (this.s.status === 'finished') return;
    this.s.status = 'finished';
    this.s.current = null;
    this.s.finishedAt = this.now();
  }
}

/** Convenience factory mirroring the functional style of the rest of the domain. */
export function createChallenge(config: ChallengeConfig): ChallengeSession {
  return new ChallengeSession(config);
}
