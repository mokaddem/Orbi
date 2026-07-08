// Persistence controller for the UI layer (Phase 6).
//
// Owns the singleton `QuizStore` (IndexedDB, or an in-memory fallback), and exposes
// reactive views the app renders from: the current `prefs`, and whether storage is
// `persistent`. It also bridges preferences with the i18n `locale` store so language
// stays a single runtime source of truth while still being persisted per the data
// model. Session records are written here at each session end, and the History route
// reads its stats through here — keeping IndexedDB out of the components.

import { get, writable } from 'svelte/store';
import {
  DEFAULT_PREFS,
  MemoryQuizStore,
  clampPrefs,
  getCountry,
  openStore,
  type Prefs,
  type QuizStore,
  type SessionRecord,
} from '../../data';
import {
  computeStats,
  dominantTrainingMode,
  recommend,
  scheduleNext,
  selectTrainingItems,
  type GameMode,
  type QuestionResult,
  type Recommendation,
  type RegionResolver,
  type SelectTrainingOptions,
  type SessionSummary,
  type StatsOverview,
  type TrainingItem,
} from '../../domain';
import { locale, setLocale } from '../../i18n';

/** Current preferences (defaults until {@link initPersistence} loads any stored ones). */
export const prefs = writable<Prefs>({ ...DEFAULT_PREFS });

/** `true` while backed by IndexedDB; `false` on the in-memory fallback (won't persist). */
export const persistent = writable<boolean>(true);

/** Flips to `true` once the store has been opened and prefs loaded. */
export const storageReady = writable<boolean>(false);

let store: QuizStore | null = null;
let localeSyncBound = false;

/** Best-effort unique id for a session record. */
function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `s_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/** Map an end-of-session {@link SessionSummary} onto the persisted {@link SessionRecord}. */
export function summaryToRecord(summary: SessionSummary, id: string = newId()): SessionRecord {
  return {
    id,
    startedAt: summary.startedAt,
    finishedAt: summary.finishedAt,
    durationMs: summary.durationMs,
    mode: summary.mode,
    type: summary.type,
    ...(summary.regionFilter ? { regionFilter: summary.regionFilter } : {}),
    total: summary.total,
    correct: summary.correct,
    questions: summary.results,
  };
}

/**
 * Open the store, load persisted prefs (applying the saved language), and start
 * syncing language changes back into prefs. Safe to call once at app startup; the app
 * renders with defaults until this resolves.
 */
export async function initPersistence(): Promise<void> {
  store = await openStore();

  try {
    const stored = await store.getPrefs();
    // First run has no stored prefs: seed language from the already-detected locale so
    // we don't clobber a French browser with the 'en' default.
    const merged = clampPrefs({ ...DEFAULT_PREFS, language: get(locale), ...stored });
    prefs.set(merged);

    // Apply a persisted language choice (locale then mirrors it to its own fast cache).
    if (stored?.language && stored.language !== get(locale)) setLocale(stored.language);

    // Persist the (possibly seeded/clamped) prefs so a prefs row always exists.
    await store.savePrefs(merged);
  } catch {
    // IndexedDB opened but then refused (quota, private mode): drop to memory so the
    // app keeps working with in-session prefs, and warn that nothing will persist.
    store = new MemoryQuizStore();
    prefs.set(clampPrefs({ ...DEFAULT_PREFS, language: get(locale) }));
  }
  persistent.set(store.persistent);

  // Keep prefs.language in lockstep with the locale store (the language source of
  // truth), persisting whenever it changes. Bound once.
  if (!localeSyncBound) {
    localeSyncBound = true;
    locale.subscribe((lang) => {
      const current = get(prefs);
      if (current.language === lang) return;
      const next = { ...current, language: lang };
      prefs.set(next);
      void store?.savePrefs(next).catch(() => {});
    });
  }

  storageReady.set(true);
}

/** Update the numeric gameplay prefs (language flows through the locale store). */
export function updatePrefs(patch: Partial<Omit<Prefs, 'language'>>): void {
  const next = clampPrefs({ ...get(prefs), ...patch });
  prefs.set(next);
  // Best-effort persist: keep the in-session change even if the write is refused.
  void store?.savePrefs(next).catch(() => {});
}

/**
 * Persist a finished session. Best-effort: a write that fails after the store opened
 * (e.g. quota exceeded mid-session) is swallowed so it can't surface as an unhandled
 * rejection or interrupt the run to the summary. No-op before {@link initPersistence}.
 */
export async function saveSession(summary: SessionSummary): Promise<void> {
  if (!store) return;
  try {
    await store.addSession(summaryToRecord(summary));
  } catch {
    // Storage became unwritable (quota/private mode) — history just won't include this run.
  }
}

// SR writes are serialized through this chain so two answers on the same item in quick
// succession (e.g. a tiny survival/training pool) can't race on read-modify-write.
let srQueue: Promise<void> = Promise.resolve();

/**
 * Update the SM-2 state for an answered question and persist it. Reads the item's
 * current state, applies {@link scheduleNext}, and writes it back. Fire-and-forget from
 * the UI; awaiting the returned promise also drains any earlier queued updates. No-op
 * before {@link initPersistence} resolves.
 */
export function recordAnswer(result: QuestionResult): Promise<void> {
  srQueue = srQueue.then(async () => {
    if (!store) return;
    const prev = await store.getSRItem(result.itemKey);
    await store.putSRItem(scheduleNext(prev, result));
  });
  // Isolate the shared chain from a single failing update so later writes still run.
  const settled = srQueue.catch(() => {});
  srQueue = settled;
  return settled;
}

/** Select the items worth training from persisted SR state. Empty before init. */
export async function loadTrainingItems(
  options: SelectTrainingOptions = {},
): Promise<TrainingItem[]> {
  if (!store) return [];
  return selectTrainingItems(await store.getAllSRItems(), options);
}

/** How many items a single "train my mistakes" session covers, at most. */
export const TRAINING_SESSION_MAX = 20;

/** A ready-to-run "train my mistakes" plan: one mode and the weak items to drill. */
export interface TrainingPlan {
  /** The mode with the most items needing review (a session runs one mode at a time). */
  mode: GameMode;
  /** ISO alpha-2 codes to drill, weakest first. */
  iso2s: string[];
}

/**
 * Build a "train my mistakes" plan from persisted SR state: the mode with the most
 * items needing review, and up to {@link TRAINING_SESSION_MAX} of its weakest items.
 * Returns `null` when there is nothing to train (or before init).
 */
export async function loadTrainingPlan(limit = TRAINING_SESSION_MAX): Promise<TrainingPlan | null> {
  if (!store) return null;
  const srItems = await store.getAllSRItems();
  const mode = dominantTrainingMode(srItems);
  if (!mode) return null;
  const items = selectTrainingItems(srItems, { mode, limit });
  if (items.length === 0) return null;
  return { mode, iso2s: items.map((i) => i.iso2) };
}

/** Resolve an ISO alpha-2 code to its region/sub-region from the bundled dataset. */
const regionOf: RegionResolver = (iso2) => {
  const c = getCountry(iso2);
  return c ? { region: c.region, subregion: c.subregion } : undefined;
};

/**
 * Compute the ordered "Next up" recommendations from persisted SR state + play history.
 * Always returns at least a fresh-start fallback (even before init or with no data), so
 * the card is never empty.
 */
export async function loadRecommendations(now = Date.now()): Promise<Recommendation[]> {
  if (!store) return recommend([], [], { now, regionOf });
  const [srItems, sessions] = await Promise.all([store.getAllSRItems(), store.getAllSessions()]);
  return recommend(srItems, sessions, { now, regionOf });
}

/** All persisted sessions (ascending by start time). Empty before init. */
export async function loadSessions(): Promise<SessionRecord[]> {
  return store ? store.getAllSessions() : [];
}

/** Whether any play history exists — drives the "Clear history" control's enabled state. */
export async function hasSessions(): Promise<boolean> {
  return store ? (await store.getAllSessions()).length > 0 : false;
}

/** Whether any SR/training state exists — drives the "Reset training" control's enabled state. */
export async function hasTrainingData(): Promise<boolean> {
  return store ? (await store.getAllSRItems()).length > 0 : false;
}

/** Compute the History overview from persisted sessions. */
export async function loadStats(): Promise<StatsOverview> {
  return computeStats(await loadSessions());
}

/** Erase all play history (leaves prefs and SR state intact). */
export async function clearHistory(): Promise<void> {
  await store?.clearSessions();
}

/** Erase all SR/training state (leaves prefs and play history intact). */
export async function clearTraining(): Promise<void> {
  await store?.clearSRItems();
}
