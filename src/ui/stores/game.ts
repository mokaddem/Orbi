// Play-session controller for the UI layer.
//
// Thin, reactive glue over the pure `QuizSession` (domain layer). It owns the live
// session, exposes a snapshot the Play shell renders from, and captures the
// per-question feedback the session itself discards once graded (submit() clears the
// current question). Kept mode-agnostic so Phase 4's map modes reuse the same flow.

import { writable } from 'svelte/store';
import {
  QuizSession,
  filterCountries,
  type GameMode,
  type Question,
  type QuestionResult,
  type Rng,
  type RegionFilter,
  type SessionState,
  type SessionSummary,
  type SessionType,
} from '../../domain';
import { getCountries, type Country } from '../../data';

/** UI-level description of a session to run — everything needed to (re)start one. */
export interface RunConfig {
  mode: GameMode;
  type: SessionType;
  filter?: RegionFilter;
  /**
   * Explicit ISO alpha-2 codes to ask about, overriding `filter`. Set by training
   * sessions; distractors still come from the whole world. Unknown codes are dropped.
   */
  answerPoolIso?: string[];
  fixedLength?: number;
  lives?: number;
  choices?: number;
  /** Test-only injection for deterministic runs; omitted in production. */
  rng?: Rng;
  now?: () => number;
}

/** What the player just answered — retained for the feedback / reveal view. */
export interface AnsweredFeedback {
  question: Question;
  pickedIso: string | null;
  correct: boolean;
}

export type PlayStatus = 'idle' | 'playing' | 'answered' | 'finished';

/** The reactive view the Play shell renders from. */
export interface PlayView {
  status: PlayStatus;
  config: RunConfig | null;
  state: SessionState | null;
  /** Current unanswered question, or (while `answered`) the one just graded. */
  question: Question | null;
  feedback: AnsweredFeedback | null;
}

const idleView: PlayView = {
  status: 'idle',
  config: null,
  state: null,
  question: null,
  feedback: null,
};

function createPlayStore() {
  const { subscribe, set } = writable<PlayView>(idleView);
  let session: QuizSession | null = null;
  let config: RunConfig | null = null;

  /** Shallow-copy the live session state so each emit is a fresh object for Svelte. */
  const snapshot = (): SessionState | null => (session ? { ...session.state } : null);

  return {
    subscribe,

    /** Begin a new session from `cfg` and present its first question. */
    start(cfg: RunConfig): void {
      config = cfg;
      const all = getCountries();

      // Training sessions carry an explicit answer pool (specific weak countries); they
      // ask only about those but tier distractors against the whole world, so the full
      // list is the universe. Otherwise, restrict the whole session — both the countries
      // asked about *and* the distractors — to the selected region by scoping the
      // universe to the filtered pool: a sub-region with < 4 countries then simply yields
      // fewer options per question (buildQuestion caps at what the pool can supply)
      // instead of failing. `filter` is still passed so the summary records what was played.
      let countries: readonly Country[];
      let answerPool: Country[] | undefined;
      if (cfg.answerPoolIso && cfg.answerPoolIso.length) {
        const byIso = new Map(all.map((c) => [c.iso2, c]));
        answerPool = cfg.answerPoolIso
          .map((iso) => byIso.get(iso))
          .filter((c): c is Country => !!c);
        countries = all;
      } else {
        countries = filterCountries(all, cfg.filter);
      }

      session = new QuizSession({
        mode: cfg.mode,
        type: cfg.type,
        countries,
        filter: cfg.filter,
        answerPool,
        fixedLength: cfg.fixedLength,
        lives: cfg.lives,
        choices: cfg.choices,
        rng: cfg.rng,
        now: cfg.now,
      });
      const question = session.next();
      set({ status: 'playing', config, state: snapshot(), question, feedback: null });
    },

    /**
     * Grade the current question with `pickedIso` (or `null` for no answer). Returns the
     * {@link QuestionResult} so the caller can feed it to spaced-repetition, or `null`
     * if there was no active question.
     */
    answer(pickedIso: string | null): QuestionResult | null {
      if (!session) return null;
      const question = session.state.current;
      if (!question) return null;
      const result = session.submit(pickedIso);
      set({
        status: 'answered',
        config,
        state: snapshot(),
        question,
        feedback: { question, pickedIso, correct: result.correct },
      });
      return result;
    },

    /**
     * Leave the feedback view: present the next question, or finish. Returns `true`
     * when the session is over (the caller then reads {@link summary} and routes on).
     */
    advance(): boolean {
      if (!session) return false;
      if (session.isFinished()) {
        set({ status: 'finished', config, state: snapshot(), question: null, feedback: null });
        return true;
      }
      const question = session.next();
      set({ status: 'playing', config, state: snapshot(), question, feedback: null });
      return false;
    },

    /** The end-of-session rollup, or `null` if no session has been started. */
    summary(): SessionSummary | null {
      return session ? session.summary() : null;
    },

    /** Discard any session and return to the idle (setup) state. */
    reset(): void {
      session = null;
      config = null;
      set(idleView);
    },
  };
}

/** Singleton play controller shared across the Play and Summary routes. */
export const play = createPlayStore();

/** The most recent finished session's summary, handed off to the Summary route. */
export const lastSummary = writable<SessionSummary | null>(null);

/** A config staged for the Play route to auto-start (e.g. a Retry from Summary). */
export const pendingConfig = writable<RunConfig | null>(null);
