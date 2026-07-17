// Grandmaster Run controller for the UI layer (Phase 44).
//
// Thin, reactive glue over the pure `ChallengeSession` (domain layer), mirroring the `play` store
// but for the gated one-life capstone. Kept **separate** so the normal play path (`QuizSession`)
// stays untouched: a challenge interleaves two modes and ends on the first miss. The Play surface
// drives it the same `next` / `answer` / `advance` way; the difference is that a wrong answer
// finishes the run (one life), and the HUD shows `cleared / total` rather than lives.

import { writable } from 'svelte/store';
import {
  ChallengeSession,
  filterCountries,
  type ChallengeState,
  type ChallengeSummary,
  type MasteryFamily,
  type Question,
  type QuestionResult,
  type Rng,
} from '../../domain';
import { getCountries } from '../../data';

/** Everything needed to (re)start a Grandmaster Run: a family over one continent. */
export interface ChallengeRunConfig {
  family: MasteryFamily;
  /** A continent's M49 region key (World and sub-regions are out of scope — continents only). */
  region: string;
  /** Seeded RNG for a deterministic run (test-only; production runs use the default). */
  rng?: Rng;
  now?: () => number;
}

/** What the player just answered — retained for the feedback / reveal view. */
export interface ChallengeFeedback {
  question: Question;
  /** The picked ISO code / option id, or `null` for no answer. */
  pickedIso: string | null;
  correct: boolean;
}

export type ChallengeStatus = 'idle' | 'playing' | 'answered' | 'finished';

/** The reactive view the Play shell renders a Grandmaster Run from. */
export interface ChallengeView {
  status: ChallengeStatus;
  config: ChallengeRunConfig | null;
  state: ChallengeState | null;
  /** Current unanswered question, or (while `answered`) the one just graded. */
  question: Question | null;
  feedback: ChallengeFeedback | null;
}

const idleView: ChallengeView = {
  status: 'idle',
  config: null,
  state: null,
  question: null,
  feedback: null,
};

function createChallengeStore() {
  const { subscribe, set } = writable<ChallengeView>(idleView);
  let session: ChallengeSession | null = null;
  let config: ChallengeRunConfig | null = null;

  /** Shallow-copy the live state so each emit is a fresh object for Svelte. */
  const snapshot = (): ChallengeState | null => (session ? { ...session.state } : null);

  return {
    subscribe,

    /** Begin a run over `cfg.family × cfg.region` (a whole continent) and present question one. */
    start(cfg: ChallengeRunConfig): void {
      config = cfg;
      const countries = filterCountries(getCountries(), { region: cfg.region });
      session = new ChallengeSession({
        family: cfg.family,
        region: cfg.region,
        countries,
        rng: cfg.rng,
        now: cfg.now,
      });
      const question = session.next();
      set({ status: 'playing', config, state: snapshot(), question, feedback: null });
    },

    /**
     * Grade the current question with `pick` (an ISO code / option id, or `null` for no answer).
     * A wrong pick spends the one life — the run finishes and the next `advance()` reports it.
     * Returns the graded {@link QuestionResult} (for SR recording), or `null` with no active question.
     */
    answer(pick: string | null): QuestionResult | null {
      if (!session) return null;
      const question = session.state.current;
      if (!question) return null;
      const result = session.submit(pick);
      set({
        status: 'answered',
        config,
        state: snapshot(),
        question,
        feedback: { question, pickedIso: pick ?? null, correct: result.correct },
      });
      return result;
    },

    /**
     * Leave the feedback view: present the next question, or finish (cleared or failed). Returns
     * `true` when the run is over (the caller then reads {@link summary} / {@link sessionSummary}).
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

    /** End the run now (e.g. the player quits mid-board). Emits `finished`; no-op if not running. */
    end(): void {
      if (!session || session.isFinished()) return;
      session.end();
      set({ status: 'finished', config, state: snapshot(), question: null, feedback: null });
    },

    /** The rich end-of-run rollup (pass/fail, cleared/total, the fatal miss), or `null`. */
    summary(): ChallengeSummary | null {
      return session ? session.summary() : null;
    },

    /** Discard any run and return to idle. */
    reset(): void {
      session = null;
      config = null;
      set(idleView);
    },
  };
}

/** Singleton Grandmaster Run controller, shared across the Play and Summary routes. */
export const challenge = createChallengeStore();

/** The most recent finished run's rich summary, handed off to the in-arena end screen. */
export const lastChallengeSummary = writable<ChallengeSummary | null>(null);

/** A challenge staged for the Play route to auto-start (launched from a Progress / Play entry). */
export const pendingChallenge = writable<ChallengeRunConfig | null>(null);

/**
 * A family × region just certified by a clean-sweep run (Phase 45) — a session-scoped handoff the
 * Progress "badge unlocked" toast reads once on the return from the arena, then clears. Not
 * persisted: the durable certification lives in the `grandmaster` store, and the in-arena victory
 * bloom is the primary celebration; this is the secondary Progress-side acknowledgement.
 */
export const justCertified = writable<{ family: MasteryFamily; region: string } | null>(null);

/**
 * A Home → Progress handoff (Phase 45 ⑥): set `true` when the Grandmaster invitation card is tapped
 * with **more than one** challenge available (so it can't pick a single run to offer directly).
 * Progress reads it once on load, scrolls its World Mastery panel into view with a brief
 * (reduce-motion-safe) highlight, then clears it. Not persisted — a same-session navigation cue.
 */
export const focusMastery = writable(false);
