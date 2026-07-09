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
  getCountries,
  getCountry,
  openStore,
  type AchievementUnlock,
  type DailyResult,
  type Prefs,
  type QuizStore,
  type SessionRecord,
} from '../../data';
import {
  ACHIEVEMENTS,
  CAPITAL_MODES,
  buildDailyChallenge,
  computeMastery,
  computeStats,
  computeStreak,
  computeWeeklyRecap,
  dominantTrainingMode,
  evaluateAchievements,
  localDayKey,
  recommend,
  scheduleNext,
  selectTrainingItems,
  type DailyChallenge,
  type GameMode,
  type MasteryResult,
  type QuestionResult,
  type Recommendation,
  type RegionResolver,
  type SelectTrainingOptions,
  type SessionSummary,
  type StatsOverview,
  type StreakInfo,
  type TrainingItem,
  type WeeklyRecap,
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
    // Plain-copy the filter: recommendation- and daily-challenge-driven runs carry a filter
    // sourced from a Svelte `$state` proxy, and IndexedDB's structured clone rejects proxies
    // with a DataCloneError (silently dropping the session, and with it the streak).
    ...(summary.regionFilter ? { regionFilter: { ...summary.regionFilter } } : {}),
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

/**
 * Compute the daily streak from play history (Phase 15). Session start times are bucketed
 * into the player's **local** calendar days (a habit streak is about their own day, unlike
 * History's UTC buckets), then reduced by the pure {@link computeStreak}. Returns zeros
 * before init or with no history.
 */
export async function loadStreak(now = Date.now()): Promise<StreakInfo> {
  const empty: StreakInfo = { current: 0, longest: 0, playedToday: false };
  if (!store) return empty;
  const sessions = await store.getAllSessions();
  return computeStreak(
    sessions.map((s) => localDayKey(s.startedAt)),
    localDayKey(now),
  );
}

/** Today's Daily Challenge plus whether it's already been completed today. */
export interface DailyState {
  /** Local day-key the challenge belongs to. */
  dateKey: string;
  /** The date-seeded challenge to play (mode, region theme, length, seed). */
  challenge: DailyChallenge;
  /** `true` once today's challenge has been completed (persisted result matches today). */
  done: boolean;
  /** Today's result, present only when `done` — the score to show on the card. */
  result?: DailyResult;
}

/**
 * Resolve today's Daily Challenge and its completion state (Phase 15). The challenge is
 * derived purely from today's local day-key, so it's the same all day; "done" comes from
 * the persisted singleton and only counts when its date is today's.
 */
export async function loadDailyState(now = Date.now()): Promise<DailyState> {
  const dateKey = localDayKey(now);
  const challenge = buildDailyChallenge(dateKey);
  const stored = store ? await store.getDailyResult() : undefined;
  const done = !!stored && stored.completed && stored.date === dateKey;
  return { dateKey, challenge, done, ...(done ? { result: stored } : {}) };
}

/**
 * Persist the Daily Challenge result on completion. Best-effort (a refused write is
 * swallowed, mirroring {@link saveSession}); a replay simply overwrites the single row.
 */
export async function saveDailyResult(result: DailyResult): Promise<void> {
  if (!store) return;
  try {
    await store.saveDailyResult(result);
  } catch {
    // Storage became unwritable — the "done today" state just won't stick.
  }
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

/** The full country denominator for mastery, reduced to what the pure rollup needs. */
function masteryCountries(): { iso2: string; region: string }[] {
  return getCountries().map((c) => ({ iso2: c.iso2, region: c.region }));
}

/**
 * Compute world + per-region mastery from persisted SR state (Phase 16). Denominator is all
 * countries in the dataset ("learn the world"). Returns an all-unseen rollup before init.
 */
export async function loadMastery(now = Date.now()): Promise<MasteryResult> {
  const srItems = store ? await store.getAllSRItems() : [];
  return computeMastery(srItems, masteryCountries(), { now });
}

/**
 * Compute the separate **capital** mastery rollup (Phase 24) over the same country
 * denominator, from the capital-mode SR items only. Kept distinct from {@link loadMastery}
 * so learning capitals never moves the country-identification mastery tally.
 */
export async function loadCapitalMastery(now = Date.now()): Promise<MasteryResult> {
  const srItems = store ? await store.getAllSRItems() : [];
  return computeMastery(srItems, masteryCountries(), { now, modes: CAPITAL_MODES });
}

/** Compute this week's recap (Phase 16) from persisted sessions + SR state. */
export async function loadWeeklyRecap(now = Date.now()): Promise<WeeklyRecap> {
  if (!store) return computeWeeklyRecap([], { now });
  const [sessions, srItems] = await Promise.all([store.getAllSessions(), store.getAllSRItems()]);
  return computeWeeklyRecap(sessions, { now, srItems });
}

/** A badge's state for the UI: whether it's earned, when, and if it unlocked on this load. */
export interface AchievementView {
  id: string;
  /** `true` once earned; earned badges stay earned even if their live backing later lapses. */
  unlocked: boolean;
  /** When it first unlocked (present for earned badges). */
  unlockedAt?: number;
  /** `true` only on the load where it first crossed the line — drives the one-time toast. */
  justUnlocked: boolean;
  /** For the per-continent badges, the M49 region key (for icon/label); else undefined. */
  region?: string;
}

/**
 * Evaluate the achievements catalog against current progress (Phase 16), persisting the
 * unlock date of any badge earned for the first time and flagging it `justUnlocked` so the
 * UI can celebrate it exactly once. Earned badges are sticky: a badge that once unlocked
 * stays unlocked even if the live rollup later dips below its bar (it's a trophy, not a
 * status). Returns all badges (locked + unlocked) in catalog order.
 */
export async function loadAchievements(now = Date.now()): Promise<AchievementView[]> {
  const [sessions, srItems, persisted] = store
    ? await Promise.all([store.getAllSessions(), store.getAllSRItems(), store.getAchievements()])
    : [[] as SessionRecord[], [], [] as AchievementUnlock[]];

  const countries = masteryCountries();
  const mastery = computeMastery(srItems, countries, { now });
  const capitalMastery = computeMastery(srItems, countries, { now, modes: CAPITAL_MODES });
  const streak = computeStreak(
    sessions.map((s) => localDayKey(s.startedAt)),
    localDayKey(now),
  );
  const statuses = evaluateAchievements({
    stats: computeStats(sessions),
    mastery,
    capitalMastery,
    streak,
    sessions,
    now,
  });

  const unlockedAtById = new Map(persisted.map((p) => [p.id, p.unlockedAt]));
  const regionById = new Map(ACHIEVEMENTS.map((a) => [a.id, a.region]));
  const newlyUnlocked: AchievementUnlock[] = [];

  const views = statuses.map((st): AchievementView => {
    const wasPersisted = unlockedAtById.has(st.id);
    let unlockedAt = unlockedAtById.get(st.id);
    let justUnlocked = false;
    if (st.unlocked && !wasPersisted) {
      unlockedAt = now;
      justUnlocked = true;
      newlyUnlocked.push({ id: st.id, unlockedAt: now });
    }
    return {
      id: st.id,
      unlocked: st.unlocked || wasPersisted,
      unlockedAt,
      justUnlocked,
      region: regionById.get(st.id),
    };
  });

  // Best-effort persist of first-time unlocks (mirrors saveSession's swallow-on-failure).
  for (const u of newlyUnlocked) {
    try {
      await store?.putAchievement(u);
    } catch {
      // Storage became unwritable — the badge just won't be remembered across reloads.
    }
  }

  return views;
}

/**
 * Erase all play history (leaves prefs and SR state intact). The Daily Challenge result is
 * cleared alongside it — the streak derives from history, so wiping history should reset the
 * daily "done today" state too, keeping the two coherent. Earned badges are also cleared:
 * they'd otherwise be orphaned trophies, and any that still qualify from the surviving SR
 * state simply re-unlock on the next {@link loadAchievements}.
 */
export async function clearHistory(): Promise<void> {
  await store?.clearSessions();
  await store?.clearDailyResult();
  await store?.clearAchievements();
}

/**
 * Erase all SR/training state (leaves prefs and play history intact). Earned badges are
 * cleared for the same reason as {@link clearHistory} — orphan trophies are confusing, and
 * still-qualifying badges (e.g. a streak backed by surviving history) re-unlock on next load.
 */
export async function clearTraining(): Promise<void> {
  await store?.clearSRItems();
  await store?.clearAchievements();
}
