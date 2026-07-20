// Play-session controller for the UI layer.
//
// Thin, reactive glue over the pure `QuizSession` (domain layer). It owns the live
// session, exposes a snapshot the Play shell renders from, and captures the
// per-question feedback the session itself discards once graded (submit() clears the
// current question). Kept mode-agnostic so Phase 4's map modes reuse the same flow.

import { writable } from 'svelte/store';
import {
  DAILY_CHOICES,
  QuizSession,
  filterCountries,
  mulberry32,
  type DailyChallenge,
  type GameMode,
  type Question,
  type QuestionResult,
  type Recommendation,
  type Rng,
  type RegionFilter,
  type SessionState,
  type SessionSummary,
  type SessionType,
} from '../../domain';
import { getCountries, type Country, type Prefs } from '../../data';

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
  /**
   * Explicit `(mode, iso2)` question slots, overriding `answerPoolIso`/`filter`. Set by the
   * combined region×family practice run (Phase 41 follow-on) to interleave both of a family's
   * directions in one session; each question then carries its own slot's mode. The map frames to
   * the regions these codes belong to, exactly as `answerPoolIso` does.
   */
  answerSlots?: { mode: GameMode; iso2: string }[];
  /**
   * Targeted practice launched from a **saved** custom set: its id. Threaded through so a Blitz run's
   * personal best can be scoped to the set ("beat your best on this set"). Absent for ad-hoc
   * selections and for region/World runs.
   */
  setId?: string;
  fixedLength?: number;
  lives?: number;
  choices?: number;
  /**
   * Seeded RNG for a deterministic run. Test-only for ordinary sessions, but the
   * *production* path for the Daily Challenge (a date-seeded, reproducible round).
   */
  rng?: Rng;
  now?: () => number;
  /**
   * Set on a Daily Challenge run to the local day-key it belongs to. Its presence marks the
   * session as the daily so the Play route records the result on finish; absent otherwise.
   */
  dailyDate?: string;
}

/** What the player just answered — retained for the feedback / reveal view. */
export interface AnsweredFeedback {
  question: Question;
  /** Single-select pick (an ISO code / option id), or `null` for no answer / multi-select. */
  pickedIso: string | null;
  /** Multi-select picks (option ids), or `null` for single-select modes. */
  pickedIds: string[] | null;
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
  /**
   * The session's answer-pool size (distinct countries it can ask about, after the mode's
   * eligibility filter) — constant per session, `null` when idle. The survival HUD reads it
   * as the denominator of its "mastered X / N" clear-progress indicator (Phase 40).
   */
  answerCount: number | null;
}

const idleView: PlayView = {
  status: 'idle',
  config: null,
  state: null,
  question: null,
  feedback: null,
  answerCount: null,
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
      // A multi-mode slot queue (combined practice) also tiers distractors against the whole world,
      // so its universe is the full list too; the engine reads `answerSlots` directly.
      if (
        (cfg.answerSlots && cfg.answerSlots.length) ||
        (cfg.answerPoolIso && cfg.answerPoolIso.length)
      ) {
        if (cfg.answerSlots && cfg.answerSlots.length) {
          countries = all;
        } else {
          const byIso = new Map(all.map((c) => [c.iso2, c]));
          answerPool = cfg
            .answerPoolIso!.map((iso) => byIso.get(iso))
            .filter((c): c is Country => !!c);
          countries = all;
        }
      } else {
        countries = filterCountries(all, cfg.filter);
      }

      session = new QuizSession({
        mode: cfg.mode,
        type: cfg.type,
        countries,
        filter: cfg.filter,
        answerPool,
        answerSlots: cfg.answerSlots,
        fixedLength: cfg.fixedLength,
        lives: cfg.lives,
        choices: cfg.choices,
        rng: cfg.rng,
        now: cfg.now,
      });
      // A "Grand Tour" (full) run asks about every eligible country once — a count only the
      // session knows (after the map-geometry filter). Pin it into the config as `fixedLength`
      // so the HUD progress bar and the summary total read the real length, not a prefs default.
      if (cfg.type === 'full') config = { ...cfg, fixedLength: session.answerCount };
      const question = session.next();
      set({
        status: 'playing',
        config,
        state: snapshot(),
        question,
        feedback: null,
        answerCount: session.answerCount,
      });
    },

    /**
     * Grade the current question with `pick`: an ISO code / option id (single-select),
     * a `string[]` of option ids (multi-select), or `null` for no answer. Returns the
     * {@link QuestionResult} so the caller can feed it to spaced-repetition, or `null`
     * if there was no active question.
     */
    answer(pick: string | string[] | null): QuestionResult | null {
      if (!session) return null;
      const question = session.state.current;
      if (!question) return null;
      const result = session.submit(pick);
      const isMulti = Array.isArray(pick);
      set({
        status: 'answered',
        config,
        state: snapshot(),
        question,
        feedback: {
          question,
          pickedIso: isMulti ? null : (pick ?? null),
          pickedIds: isMulti ? pick : null,
          correct: result.correct,
        },
        answerCount: session.answerCount,
      });
      return result;
    },

    /**
     * End a running Blitz session now — its UI-owned countdown hit zero (Phase 42). Blitz never
     * finishes on its own (the engine's `shouldFinish` is always false for it), so this is the
     * sole path to its summary. Emits `finished`; a no-op with no live/already-finished session.
     */
    endBlitz(): void {
      if (!session || session.isFinished()) return;
      session.end();
      set({
        status: 'finished',
        config,
        state: snapshot(),
        question: null,
        feedback: null,
        answerCount: session.answerCount,
      });
    },

    /**
     * Leave the feedback view: present the next question, or finish. Returns `true`
     * when the session is over (the caller then reads {@link summary} and routes on).
     */
    advance(): boolean {
      if (!session) return false;
      if (session.isFinished()) {
        set({
          status: 'finished',
          config,
          state: snapshot(),
          question: null,
          feedback: null,
          answerCount: session.answerCount,
        });
        return true;
      }
      const question = session.next();
      set({
        status: 'playing',
        config,
        state: snapshot(),
        question,
        feedback: null,
        answerCount: session.answerCount,
      });
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

/** A finished Blitz run's score vs. its personal best, handed to the Summary route (Phase 42). */
export interface BlitzResult {
  /** Points scored this run. */
  points: number;
  /**
   * The best score for this slot, including this run (so ≥ `points`), or `null` when this run's slot
   * tracks no best — an ad-hoc targeted-practice set (Phase-49 follow-on). A `null` best shows just
   * the run's score with no "personal best" line and no new-best celebration.
   */
  best: number | null;
  /** `true` when this run set a new personal best (fires the celebration). Always `false` when `best` is `null`. */
  isNewBest: boolean;
}

/** The most recent Blitz result, or `null` after any non-blitz run. Read by the Summary route. */
export const lastBlitzResult = writable<BlitzResult | null>(null);

/** A config staged for the Play route to auto-start (e.g. a Retry from Summary). */
export const pendingConfig = writable<RunConfig | null>(null);

/**
 * A review chosen on Home/Summary, staged for the `#/review` preview screen (Phase 48). Instead of
 * dropping straight into the game, a "time to review" tap stages the selection here and routes to
 * the "Ready to review?" study card, which revises the covered countries and then hands the same
 * run to the Play route via {@link reviewSelectionToConfig} → {@link pendingConfig}.
 */
export interface ReviewSelection {
  /** The single mode this review runs (the region's dominant mode, or the global plan's mode). */
  mode: GameMode;
  /** Top-level M49 region key, or `null` for the global "review everything" plan. */
  region: string | null;
  /** ISO alpha-2 codes to drill, weakest-first (already capped). */
  iso2s: string[];
}

/** The review staged for the `#/review` preview, or `null` on a cold load (re-derived there). */
export const pendingReview = writable<ReviewSelection | null>(null);

/**
 * The launch action the mobile Play FAB runs when it stands in for the setup screen's "Start"
 * button (Play route only). The Play route publishes its animated-start function here while it
 * is showing setup, and clears it otherwise; the nav FAB reads it to (a) morph into its eager,
 * pulsing state and (b) start the game with the current selections on press. `null` whenever the
 * FAB should behave as an ordinary link — any other route, or a session already in progress.
 */
export const playFabAction = writable<(() => void) | null>(null);

/**
 * Turn a "Next up" {@link Recommendation} into a launchable {@link RunConfig}, filling in
 * the gameplay prefs (choices, fixed length, lives) the pure engine deliberately omits.
 * Returns `null` for a `fresh-start` (no run payload): the caller then routes to the Play
 * setup screen instead of staging a config. Mirrors Home's `train()` and Summary's
 * `retry()` config shapes.
 */
export function recommendationToConfig(rec: Recommendation, prefs: Prefs): RunConfig | null {
  const run = rec.run;
  if (!run) return null;
  if (run.type === 'training') {
    const iso2s = run.answerPoolIso ?? [];
    return {
      mode: run.mode,
      type: 'training',
      answerPoolIso: iso2s,
      fixedLength: iso2s.length,
      choices: prefs.choicesPerQuestion,
    };
  }
  return {
    mode: run.mode,
    type: run.type,
    filter: run.filter,
    fixedLength: prefs.fixedLength,
    lives: prefs.survivalLives,
    choices: prefs.choicesPerQuestion,
  };
}

/**
 * Turn a {@link ReviewSelection} (staged for the `#/review` preview) into the launchable
 * {@link RunConfig} for its "Start review" action. Byte-for-byte the training config the direct
 * review path built before Phase 48 (`ReviewByRegion`/`recommendationToConfig`): the same mode,
 * `type: 'training'`, explicit `answerPoolIso`, `fixedLength = pool size`, and the player's option
 * count — so the game behaves identically once started; only the entry gained a preview step.
 */
export function reviewSelectionToConfig(sel: ReviewSelection, prefs: Prefs): RunConfig {
  return {
    mode: sel.mode,
    type: 'training',
    answerPoolIso: sel.iso2s,
    fixedLength: sel.iso2s.length,
    choices: prefs.choicesPerQuestion,
  };
}

/**
 * Turn today's {@link DailyChallenge} into a launchable {@link RunConfig}. A normal fixed
 * session, but with a **date-seeded** RNG so the questions, order, and distractors are
 * identical every time the day's challenge is opened — and `dailyDate` set so Play records
 * the result on finish. Length and option count are the daily's fixed constants (not prefs),
 * keeping the day's challenge the same regardless of the player's gameplay settings.
 */
export function dailyToConfig(challenge: DailyChallenge): RunConfig {
  return {
    mode: challenge.mode,
    type: 'fixed',
    filter: challenge.filter,
    fixedLength: challenge.length,
    choices: DAILY_CHOICES,
    rng: mulberry32(challenge.seed),
    dailyDate: challenge.dateKey,
  };
}

/**
 * Build a launchable {@link RunConfig} for a targeted-practice run (Phase 27): a player-picked
 * country set drilled in a single chosen `mode`. Like training, it carries an explicit
 * `answerPoolIso` — pass the codes already narrowed to those the mode can ask about
 * (`practiceEligibility`) so the session length matches what's actually drilled. A **fixed**
 * run drills each eligible country once (`fixedLength = eligibleIso.length`); a **survival**
 * run uses the player's configured lives. Distractors still tier against the whole world.
 */
export function practiceToConfig(
  mode: GameMode,
  type: SessionType,
  eligibleIso: readonly string[],
  prefs: Prefs,
  setId?: string,
): RunConfig {
  const answerPoolIso = [...eligibleIso];
  return {
    mode,
    type,
    answerPoolIso,
    // A **fixed** run drills each eligible country once; **survival** and **blitz** run on lives /
    // the clock (their draw bag refills), so the pool size isn't the length — carry the prefs default.
    fixedLength: type === 'fixed' ? answerPoolIso.length : prefs.fixedLength,
    lives: prefs.survivalLives,
    choices: prefs.choicesPerQuestion,
    // A saved-set launch carries its id so a Blitz run's best is scoped to the set; omitted for
    // ad-hoc selections (which track no Blitz best).
    ...(setId ? { setId } : {}),
  };
}

/**
 * ISO alpha-2 codes to frame the map on for `cfg`, or `null` to fit the whole world.
 *
 * A region / sub-region `filter` (normal region play, the Daily Challenge) frames to that
 * region directly. A region-scoped review or targeted-practice run carries **no** filter —
 * its scope lives in the explicit `answerPoolIso` — so frame to the whole region(s) those
 * countries belong to. Reviewing "Europe" then shows the Europe map (not the world), matching
 * normal Europe play, while still asking only about the pooled countries. Framing to the full
 * region rather than just the pooled codes keeps the board from zooming onto the handful of due
 * countries (which would give the answer away in map-locate). Falls back to the whole world when
 * neither is set, or when the pool's regions can't be resolved.
 */
export function focusIsosForConfig(
  countries: readonly Country[],
  cfg: RunConfig | null,
): string[] | null {
  if (!cfg) return null;
  if (cfg.filter && (cfg.filter.region || cfg.filter.subregion)) {
    return filterCountries(countries, cfg.filter).map((c) => c.iso2);
  }
  // The pooled codes: an explicit answer pool, or (combined practice) the slot queue's countries.
  const poolIsos =
    cfg.answerPoolIso && cfg.answerPoolIso.length
      ? cfg.answerPoolIso
      : cfg.answerSlots && cfg.answerSlots.length
        ? cfg.answerSlots.map((s) => s.iso2)
        : null;
  if (poolIsos) {
    const byIso = new Map(countries.map((c) => [c.iso2, c]));
    const regions = new Set<string>();
    for (const iso of poolIsos) {
      const region = byIso.get(iso)?.region;
      if (region) regions.add(region);
    }
    if (regions.size === 0) return null;
    return countries.filter((c) => regions.has(c.region)).map((c) => c.iso2);
  }
  return null;
}
