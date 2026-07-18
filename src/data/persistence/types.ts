// Persistence layer — shapes and the storage port (Phase 6).
//
// These are the *persisted* shapes from the main PRD's data model: play history
// (`SessionRecord`), spaced-repetition state (`SRItem`, structurally reserved for
// Phase 7), and user preferences (`Prefs`). They are built from the domain layer's
// `SessionSummary` / `QuestionResult`, so no reshaping is needed at the boundary.
//
// `QuizStore` is a small interface (a "port") that keeps the rest of the app
// storage-agnostic: the IndexedDB adapter and the in-memory fallback both implement
// it, and the domain/stats code never touches IndexedDB directly.

import type { GameMode, QuestionResult, RegionFilter, SessionType } from '../../domain/types';
import { isLocale, type Locale } from '../../i18n/locale';

/** One completed play session, persisted verbatim from a {@link SessionSummary}. */
export interface SessionRecord {
  /** Unique id (UUID when available, else a time-based fallback). */
  id: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  mode: GameMode;
  type: SessionType;
  regionFilter?: RegionFilter;
  total: number;
  correct: number;
  /**
   * Blitz (Phase 42) points for this run — base × the streak-combo multiplier, summed over the
   * answers. Present only on `type: 'blitz'` records; the personal best is the max of these. It's
   * fully derivable from `questions` (see `computeBlitzPoints`), so it's an optional cache — a
   * record without it (or a non-blitz record) is simply scored 0 / recomputed on read.
   */
  points?: number;
  /**
   * The 32-bit seed that drove this run (Phase 46), copied from the {@link SessionSummary}. Present
   * on every seeded run (all ordinary play now seeds), enabling a later duel/rematch from history.
   * Absent on legacy records and on runs given a bare, seedless `rng`.
   */
  seed?: number;
  /** Per-question outcomes, in the order they were answered. */
  questions: QuestionResult[];
}

/**
 * Spaced-repetition state for one item (`${mode}:${iso2}`), SM-2 shaped. The store
 * is created now so Phase 7 needs no schema migration; only CRUD is wired here.
 */
export interface SRItem {
  itemKey: string;
  repetitions: number;
  easeFactor: number; // starts 2.5
  intervalDays: number;
  dueAt: number; // timestamp
  lapses: number; // times missed
  lastReviewedAt?: number;
}

/**
 * Result of the most recent Daily Challenge (Phase 15) — a persisted singleton, not a log.
 * "Done today" is `date === <today's local day-key> && completed`; on a new day the stored
 * row is simply stale and the challenge is playable again. A replay overwrites it (latest
 * attempt's score wins) but never un-completes the day.
 */
export interface DailyResult {
  /** Local day-key (`YYYY-MM-DD`) the challenge was completed on. */
  date: string;
  completed: boolean;
  /** Questions in the run and how many were correct — shown as today's score. */
  total: number;
  correct: number;
  /** The mode that day's challenge was played in (for display). */
  mode: GameMode;
}

/**
 * A badge the player has earned (Phase 16), with when it first unlocked. Persisted one row
 * per earned badge so the UI can fire a one-time "unlocked!" celebration and mark a badge as
 * "new"; locked badges have no row. The `id` matches an entry in the achievements catalog.
 */
export interface AchievementUnlock {
  id: string;
  /** Timestamp the badge first unlocked. */
  unlockedAt: number;
}

/**
 * Grandmaster Challenge state (Phase 45) — one row per `family|region` capstone. Deliberately
 * decoupled from play history / XP: a finished run writes here, **not** a `SessionRecord`, so it
 * grants no XP, feeds no History stats, and never counts toward the play-streak. `certified` is
 * **monotonic** — a clean sweep sets it and no later attempt (nor a mastery lapse) ever revokes it;
 * it drives the gilded cells + the "Grandmaster X/15" prestige. `lastAttemptDay` is the local
 * day-key of the most recent attempt (win *or* lose), driving the once-a-day-per-family×region
 * cooldown. One store serves both certification *and* the cooldown.
 */
export interface GrandmasterRecord {
  /** Composite key `${family}|${region}` (e.g. `flags|Oceania`). */
  key: string;
  /** `true` once a clean-sweep run certified this family × region (never revoked). */
  certified: boolean;
  /** Timestamp the capstone first certified — present once `certified`. */
  certifiedAt?: number;
  /** Local day-key (`YYYY-MM-DD`) of the most recent attempt — the daily-cooldown gate. */
  lastAttemptDay: string;
}

/**
 * Progression state (Phase 43) — a persisted singleton for the Explorer rank / XP spine. XP itself
 * is *derived* from append-only history + sticky badges (never stored, like the streak), so the
 * only thing that must persist is the **last rank that was celebrated** — enough to fire the
 * one-time "Rank up!" moment exactly once and, seeded to the computed rank on first run, to
 * suppress a retroactive burst for pre-existing history. Cleared by the Settings progress resets
 * alongside earned badges.
 */
export interface ProgressionState {
  /** Index into the XP rank ladder (`RANKS`) that has already been celebrated. */
  lastCelebratedRank: number;
}

/**
 * A player-authored country set for targeted practice (Phase 27). Stores *only* the
 * countries — the mode is chosen at play time, so one set ("these 8 Balkans") is reusable
 * across modes (flags today, capitals tomorrow). Persisted as authored content (like prefs),
 * so it survives the History/Training progress resets.
 */
export interface CustomSet {
  /** Unique id (UUID when available, else a time-based fallback). */
  id: string;
  /** Player-given name, e.g. "Balkan flags". */
  name: string;
  /** ISO alpha-2 codes in the set, deduped. Order is insertion order. */
  iso2: string[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Map surface offered for the map modes. The first four (Phase 28) are planar D3-geo
 * projections that fit the flat board via `fitExtent`; kept a small curated set so every
 * in-scope country stays visible. `'globe'` (Phase 38) is not a planar projection but an
 * interactive WebGL 3D globe, selected via the same preference and rendered by a separate
 * component. `naturalEarth` is the historical default (and the flat fallback when WebGL is
 * unavailable).
 */
export type MapProjection =
  'naturalEarth' | 'equalEarth' | 'equirectangular' | 'mercator' | 'globe';

/** The offered surfaces, in display order (drives the Settings dropdown). */
export const MAP_PROJECTIONS = [
  'naturalEarth',
  'equalEarth',
  'equirectangular',
  'mercator',
  'globe',
] as const satisfies readonly MapProjection[];

/** Type guard so a corrupted/legacy stored value falls back to the default. */
export function isMapProjection(value: unknown): value is MapProjection {
  return typeof value === 'string' && (MAP_PROJECTIONS as readonly string[]).includes(value);
}

/** User-editable preferences, persisted and applied at startup. */
export interface Prefs {
  language: Locale;
  survivalLives: number;
  fixedLength: number;
  choicesPerQuestion: number;
  mapProjection: MapProjection;
  /** Force the static (no-animation) presentation regardless of the OS setting (Phase 33). */
  reduceMotion: boolean;
  /** Play sound effects & jingles at feedback moments; single master on/off (Phase 36). */
  sound: boolean;
  /**
   * The setup last launched from the Play screen — restored as the pre-selected mode / direction /
   * format / region on the next visit, so returning resumes where the player left off. Absent until
   * the first launch. Stored as primitives (region as a plain string, not a `RegionFilter` proxy) so
   * it survives structured clone; the UI re-validates it on restore, ignoring anything stale.
   */
  lastSetup?: { mode: GameMode; type: SessionType; region?: string; subregion?: string };
  /**
   * Display name for async friend duels (Phase 46) — captured once on the first duel and editable in
   * Settings, embedded in a challenge to personalise it (and to seed a future duel history). Purely
   * cosmetic/local; trimmed and length-clamped ({@link PLAYER_NAME_MAX_LENGTH}). Absent until set.
   */
  playerName?: string;
}

/** Max length of the duel {@link Prefs.playerName}; longer input is clamped (Phase 46). */
export const PLAYER_NAME_MAX_LENGTH = 24;

/** Defaults applied on first run and merged over any partially-stored prefs. */
export const DEFAULT_PREFS: Prefs = {
  language: 'en',
  survivalLives: 3,
  fixedLength: 10,
  choicesPerQuestion: 4,
  mapProjection: 'naturalEarth',
  reduceMotion: false,
  sound: true,
};

/** Bounds for the numeric prefs, shared by the Settings UI and validation. */
export const PREFS_BOUNDS = {
  survivalLives: { min: 3, max: 10 },
  fixedLength: { min: 5, max: 50 },
  choicesPerQuestion: { min: 4, max: 8 },
} as const;

/** Clamp a partial prefs patch to valid ranges (leaves absent fields untouched). */
export function clampPrefs(prefs: Prefs): Prefs {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));
  return {
    // Guard against a corrupted/legacy persisted value leaking through as the active locale.
    language: isLocale(prefs.language) ? prefs.language : DEFAULT_PREFS.language,
    survivalLives: clamp(
      prefs.survivalLives,
      PREFS_BOUNDS.survivalLives.min,
      PREFS_BOUNDS.survivalLives.max,
    ),
    fixedLength: clamp(
      prefs.fixedLength,
      PREFS_BOUNDS.fixedLength.min,
      PREFS_BOUNDS.fixedLength.max,
    ),
    choicesPerQuestion: clamp(
      prefs.choicesPerQuestion,
      PREFS_BOUNDS.choicesPerQuestion.min,
      PREFS_BOUNDS.choicesPerQuestion.max,
    ),
    // Guard against a corrupted/legacy or absent value; absent → default via the merge.
    mapProjection: isMapProjection(prefs.mapProjection)
      ? prefs.mapProjection
      : DEFAULT_PREFS.mapProjection,
    // Coerce any legacy/absent value to a real boolean.
    reduceMotion: !!prefs.reduceMotion,
    // Absent in a pre-Phase-36 prefs blob → default (on) via the merge; else coerced.
    sound: prefs.sound === undefined ? DEFAULT_PREFS.sound : !!prefs.sound,
    // Pass through the remembered Play setup when structurally sound; the UI validates it against
    // the live dataset on restore, so only a coarse shape check is needed here (drop obvious junk).
    ...(prefs.lastSetup &&
    typeof prefs.lastSetup.mode === 'string' &&
    typeof prefs.lastSetup.type === 'string'
      ? { lastSetup: prefs.lastSetup }
      : {}),
    // Trim + length-clamp the duel display name; drop an absent/blank value so it stays truly unset
    // (the first-duel prompt keys off its absence).
    ...(typeof prefs.playerName === 'string' && prefs.playerName.trim()
      ? { playerName: prefs.playerName.trim().slice(0, PLAYER_NAME_MAX_LENGTH) }
      : {}),
  };
}

/**
 * Storage port. Both {@link IdbQuizStore} and {@link MemoryQuizStore} implement it.
 * `persistent` is `false` for the in-memory fallback, so the UI can warn that
 * progress won't survive a reload.
 */
export interface QuizStore {
  /** `true` when backed by IndexedDB; `false` for the in-memory fallback. */
  readonly persistent: boolean;

  // History
  addSession(record: SessionRecord): Promise<void>;
  getAllSessions(): Promise<SessionRecord[]>;
  clearSessions(): Promise<void>;

  // Preferences (a singleton row)
  getPrefs(): Promise<Prefs | undefined>;
  savePrefs(prefs: Prefs): Promise<void>;

  // Spaced-repetition state (CRUD only for now; scheduling lands in Phase 7)
  getSRItem(itemKey: string): Promise<SRItem | undefined>;
  putSRItem(item: SRItem): Promise<void>;
  getAllSRItems(): Promise<SRItem[]>;
  /** Erase all SR/training state (leaves history and prefs intact). */
  clearSRItems(): Promise<void>;

  // Daily Challenge (a singleton row: the most recent result)
  getDailyResult(): Promise<DailyResult | undefined>;
  saveDailyResult(result: DailyResult): Promise<void>;
  /** Erase the Daily Challenge result (cleared alongside play history). */
  clearDailyResult(): Promise<void>;

  // Achievements (one row per earned badge, recording when it unlocked)
  getAchievements(): Promise<AchievementUnlock[]>;
  putAchievement(unlock: AchievementUnlock): Promise<void>;
  /** Erase all earned badges (cleared alongside a full progress reset). */
  clearAchievements(): Promise<void>;

  // Custom targeted-practice sets (Phase 27 — one row per named country set)
  getCustomSets(): Promise<CustomSet[]>;
  putCustomSet(set: CustomSet): Promise<void>;
  deleteCustomSet(id: string): Promise<void>;
  /** Erase all saved sets (not part of the progress resets; exposed for completeness). */
  clearCustomSets(): Promise<void>;

  // Progression (Phase 43 — a singleton row: the last-celebrated Explorer rank)
  getProgression(): Promise<ProgressionState | undefined>;
  saveProgression(state: ProgressionState): Promise<void>;
  /** Erase the progression state (cleared alongside a progress reset). */
  clearProgression(): Promise<void>;

  // Grandmaster Challenge (Phase 45 — one row per `family|region`: certification + daily cooldown)
  getGrandmasterRecords(): Promise<GrandmasterRecord[]>;
  putGrandmasterRecord(record: GrandmasterRecord): Promise<void>;
  /** Erase all Grandmaster certification + cooldown state (cleared alongside a progress reset). */
  clearGrandmaster(): Promise<void>;
}
