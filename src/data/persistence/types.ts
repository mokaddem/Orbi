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
import type { Locale } from '../../i18n';

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

/** User-editable preferences, persisted and applied at startup. */
export interface Prefs {
  language: Locale;
  survivalLives: number;
  fixedLength: number;
  choicesPerQuestion: number;
}

/** Defaults applied on first run and merged over any partially-stored prefs. */
export const DEFAULT_PREFS: Prefs = {
  language: 'en',
  survivalLives: 3,
  fixedLength: 10,
  choicesPerQuestion: 4,
};

/** Bounds for the numeric prefs, shared by the Settings UI and validation. */
export const PREFS_BOUNDS = {
  survivalLives: { min: 1, max: 9 },
  fixedLength: { min: 5, max: 50 },
  choicesPerQuestion: { min: 2, max: 6 },
} as const;

/** Clamp a partial prefs patch to valid ranges (leaves absent fields untouched). */
export function clampPrefs(prefs: Prefs): Prefs {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v)));
  return {
    language: prefs.language,
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
}
