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
  type CustomSet,
  type DailyResult,
  type GrandmasterRecord,
  type Prefs,
  type ProgressionState,
  type QuizStore,
  type SessionRecord,
} from '../../data';
import {
  ACHIEVEMENTS,
  CAPITAL_MODES,
  LANGUAGE_MODES,
  INDUSTRY_MODES,
  REVIEW_MODES,
  buildDailyChallenge,
  computeBlitzPoints,
  computeMastery,
  computeFamilyMastery,
  computeStats,
  computeStreak,
  computeWeeklyRecap,
  computeXp,
  rankForXp,
  dominantTrainingMode,
  evaluateAchievements,
  isIndustryQuizEligible,
  isLanguageQuizEligible,
  localDayKey,
  recommend,
  regionFamilyPracticePool,
  reviewByRegion,
  scheduleNext,
  selectTrainingItems,
  type DailyChallenge,
  type ExtraTopic,
  type FamilyMasteryResult,
  type FamilyMasteryRollup,
  type GameMode,
  type MasteryFamily,
  type MasteryResult,
  type RegionFamilyPractice,
  type MasteryRollup,
  type QuestionResult,
  type RankProgress,
  type Recommendation,
  type RegionResolver,
  type RegionReview,
  type SelectTrainingOptions,
  type SessionSummary,
  type StatsOverview,
  type StreakInfo,
  type TrainingItem,
  type WeeklyRecap,
  type XpResult,
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
    // Cache the Blitz score (base × streak-combo) so the personal best is a cheap max over
    // history; derivable from `questions`, so only blitz runs carry it (Phase 42).
    ...(summary.type === 'blitz' ? { points: computeBlitzPoints(summary.results) } : {}),
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
  // "Review everything" is a review proposal too, so restrict it to the review-eligible modes
  // (maps/flags/capitals) — never surface a languages/industries round here.
  const mode = dominantTrainingMode(srItems, { modes: REVIEW_MODES });
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
 * Group the player's trainable SR state by top-level region (Phase 26) so Home can offer a
 * "review this region" list, most-urgent first — without foreign-region items polluting the
 * session. Each region's pool is capped at {@link TRAINING_SESSION_MAX}. Empty before init or
 * when nothing is worth reviewing. The global {@link loadTrainingPlan} remains the
 * "review everything" escape hatch.
 */
export async function loadRegionReviews(now = Date.now()): Promise<RegionReview[]> {
  if (!store) return [];
  const srItems = await store.getAllSRItems();
  return reviewByRegion(srItems, regionOf, { now, limit: TRAINING_SESSION_MAX });
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

/**
 * Saved targeted-practice sets (Phase 27), newest-updated first. Empty before init or on the
 * in-memory fallback (which doesn't survive a reload). Read by the Practice route.
 */
export async function loadCustomSets(): Promise<CustomSet[]> {
  if (!store) return [];
  try {
    const sets = await store.getCustomSets();
    return sets.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

/**
 * Create (no `id`) or update (existing `id`) a saved set. Plain-copies the ISO array before
 * persisting — it may arrive as a Svelte `$state` proxy, which IndexedDB's structured clone
 * rejects (DataCloneError), silently dropping the write. Preserves the original `createdAt` on
 * update. Returns the persisted row, or `null` if storage is unavailable / the write failed.
 */
export async function saveCustomSet(
  input: { id?: string; name: string; iso2: readonly string[] },
  now = Date.now(),
): Promise<CustomSet | null> {
  if (!store) return null;
  const existing = input.id
    ? (await store.getCustomSets()).find((s) => s.id === input.id)
    : undefined;
  const set: CustomSet = {
    id: input.id ?? newId(),
    name: input.name,
    iso2: [...input.iso2],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  try {
    await store.putCustomSet(set);
    return set;
  } catch {
    return null;
  }
}

/** Delete a saved set by id. No-op if storage is unavailable. */
export async function deleteCustomSet(id: string): Promise<void> {
  if (!store) return;
  try {
    await store.deleteCustomSet(id);
  } catch {
    // Storage became unwritable — the set simply stays.
  }
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
function masteryCountries(): { iso2: string; region: string; hasGeometry: boolean }[] {
  // `hasGeometry` lets the per-family rollup skip the Map family for geometry-less countries
  // (only Tuvalu today), so full mastery stays reachable (Phase 41).
  return getCountries().map((c) => ({
    iso2: c.iso2,
    region: c.region,
    hasGeometry: c.hasGeometry,
  }));
}

/**
 * The denominator for **language** mastery: only the countries the languages mode can ask
 * about (few enough languages). Excluding the handful with unwieldy language lists keeps
 * "learn every country's languages" actually reachable (they're never askable, so they'd
 * otherwise sit permanently unseen and cap the meter below 100%).
 */
function languageMasteryCountries(): { iso2: string; region: string }[] {
  return getCountries()
    .filter(isLanguageQuizEligible)
    .map((c) => ({ iso2: c.iso2, region: c.region }));
}

/**
 * The denominator for **industry** mastery (Phase 25): only the countries the industries mode
 * can ask about (a curated industry, i.e. not on the `KNOWN_NO_INDUSTRY` list). Excluding the
 * uncovered micro-states keeps "learn every country's industries" reachable, exactly as for
 * languages above.
 */
function industryMasteryCountries(): { iso2: string; region: string }[] {
  return getCountries()
    .filter(isIndustryQuizEligible)
    .map((c) => ({ iso2: c.iso2, region: c.region }));
}

/**
 * Compute world + per-region mastery from persisted SR state (Phase 16). Denominator is all
 * countries in the dataset ("learn the world"). Returns an all-unseen rollup before init.
 */
export async function loadMastery(now = Date.now()): Promise<FamilyMasteryResult> {
  const srItems = store ? await store.getAllSRItems() : [];
  return computeFamilyMastery(srItems, masteryCountries(), { now });
}

/**
 * Build the launchable practice pool for one region × family — the not-yet-mastered countries of
 * that family's weaker direction (Phase 41 follow-on). Powers the per-family "practise" shortcut
 * on the Progress world-mastery breakdown. Same denominator as {@link loadMastery}, so the pool
 * always matches the mini-bar's count. `null` before init or when the family is fully mastered.
 */
export async function loadRegionFamilyPractice(
  region: string,
  family: MasteryFamily,
  now = Date.now(),
): Promise<RegionFamilyPractice | null> {
  if (!store) return null;
  const srItems = await store.getAllSRItems();
  return regionFamilyPracticePool(srItems, masteryCountries(), region, family, { now });
}

/** Grandmaster Challenge state (Phase 45): monotonic certification + today's cooldown. */
export interface GrandmasterState {
  /** Keys `${family}|${region}` certified by a clean-sweep run — monotonic, drives the gilded
   *  cells + the "Grandmaster X/15" prestige. */
  certified: Set<string>;
  /** Keys `${family}|${region}` already attempted (win or lose) on the current local day — the
   *  once-a-day-per-family×region cooldown. */
  spentToday: Set<string>;
}

/** The store key for a family × region Grandmaster capstone (`${family}|${region}`). */
export function grandmasterKey(family: MasteryFamily, region: string): string {
  return `${family}|${region}`;
}

/**
 * Load Grandmaster certification + today's cooldown from the dedicated `grandmaster` store (Phase 45),
 * fully decoupled from history/XP. Certification is monotonic; `spentToday` reflects attempts made on
 * the current local day. Empty before init or with no runs.
 */
export async function loadGrandmaster(now = Date.now()): Promise<GrandmasterState> {
  if (!store) return { certified: new Set(), spentToday: new Set() };
  const today = localDayKey(now);
  const records = await store.getGrandmasterRecords();
  const certified = new Set<string>();
  const spentToday = new Set<string>();
  for (const r of records) {
    if (r.certified) certified.add(r.key);
    if (r.lastAttemptDay === today) spentToday.add(r.key);
  }
  return { certified, spentToday };
}

/**
 * Record a finished Grandmaster Run (Phase 45). Stamps today's local day-key as the family × region's
 * last attempt — win *or* lose consumes its daily attempt — and, on a **clean sweep**, certifies it
 * (monotonic: once certified, a later attempt never revokes it, and the first certification time is
 * preserved). Writes **only** to the dedicated `grandmaster` store — never a `SessionRecord` — so a
 * run contributes zero XP / History stats / play-streak. Best-effort (a refused write is swallowed,
 * mirroring {@link saveSession}). No-op before {@link initPersistence}.
 */
export async function recordChallengeResult(
  family: MasteryFamily,
  region: string,
  passed: boolean,
  now = Date.now(),
): Promise<void> {
  if (!store) return;
  const key = grandmasterKey(family, region);
  try {
    const existing = (await store.getGrandmasterRecords()).find((r) => r.key === key);
    const certified = (existing?.certified ?? false) || passed;
    // Keep the first certification time; stamp it now only when this run is the one that certifies.
    let certifiedAt = existing?.certifiedAt;
    if (certified && certifiedAt === undefined) certifiedAt = now;
    const record: GrandmasterRecord = {
      key,
      certified,
      lastAttemptDay: localDayKey(now),
      ...(certifiedAt !== undefined ? { certifiedAt } : {}),
    };
    await store.putGrandmasterRecord(record);
  } catch {
    // Storage became unwritable — certification / cooldown just won't stick across reloads.
  }
}

/**
 * Adapt a per-family rollup to the legacy {@link MasteryResult} shape for the achievements engine,
 * so the region / continent / century / world badges track **fully-mastered** countries (all three
 * families) rather than the old lenient any-one-mode count (Phase 41 OQ2). Only `mastered` and
 * `total` drive any badge predicate; `learning`/`unseen` are filled consistently for shape.
 */
function familyMasteryToResult(fm: FamilyMasteryResult): MasteryResult {
  const roll = (r: FamilyMasteryRollup): MasteryRollup => ({
    mastered: r.fullyMastered,
    learning: Math.max(0, r.total - r.fullyMastered),
    unseen: 0,
    total: r.total,
  });
  return {
    overall: roll(fm.overall),
    byRegion: fm.byRegion.map((r) => ({ region: r.region, ...roll(r) })),
  };
}

/**
 * Compute the separate **language** mastery rollup (Phase 23) from the language-mode SR items
 * only, over the language-eligible country denominator. Kept distinct from country mastery
 * (like capitals) and surfaced in the combined "extra knowledge" view.
 */
export async function loadLanguageMastery(now = Date.now()): Promise<MasteryResult> {
  const srItems = store ? await store.getAllSRItems() : [];
  return computeMastery(srItems, languageMasteryCountries(), { now, modes: LANGUAGE_MODES });
}

/**
 * Compute the separate **industry** mastery rollup (Phase 25) from the industry-mode SR items
 * only, over the industry-eligible country denominator. Kept distinct from country mastery
 * (like capitals/languages) and surfaced in the combined "extra knowledge" view.
 */
export async function loadIndustryMastery(now = Date.now()): Promise<MasteryResult> {
  const srItems = store ? await store.getAllSRItems() : [];
  return computeMastery(srItems, industryMasteryCountries(), { now, modes: INDUSTRY_MODES });
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
  /** For extra-knowledge badges (capitals / languages), the topic; groups them out of the main grid. */
  topic?: ExtraTopic;
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
  // Country/continent/century/world badges now track *fully-mastered* countries (Phase 41 OQ2).
  const mastery = familyMasteryToResult(computeFamilyMastery(srItems, countries, { now }));
  const capitalMastery = computeMastery(srItems, countries, { now, modes: CAPITAL_MODES });
  const languageMastery = computeMastery(srItems, languageMasteryCountries(), {
    now,
    modes: LANGUAGE_MODES,
  });
  const industryMastery = computeMastery(srItems, industryMasteryCountries(), {
    now,
    modes: INDUSTRY_MODES,
  });
  const streak = computeStreak(
    sessions.map((s) => localDayKey(s.startedAt)),
    localDayKey(now),
  );
  const statuses = evaluateAchievements({
    stats: computeStats(sessions),
    mastery,
    capitalMastery,
    languageMastery,
    industryMastery,
    streak,
    sessions,
    now,
  });

  const unlockedAtById = new Map(persisted.map((p) => [p.id, p.unlockedAt]));
  const regionById = new Map(ACHIEVEMENTS.map((a) => [a.id, a.region]));
  const topicById = new Map(ACHIEVEMENTS.map((a) => [a.id, a.topic]));
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
      topic: topicById.get(st.id),
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

/** The Explorer rank / XP snapshot the UI renders, plus a one-time "rank up!" flag (Phase 43). */
export interface RankState {
  /** Total XP + per-source breakdown, from append-only history + sticky badges. */
  xp: XpResult;
  /** Current rank + progress toward the next. */
  progress: RankProgress;
  /** `true` only on the load that first crossed into a higher rank than last celebrated. */
  justRankedUp: boolean;
  /** The rank index celebrated before this load — for a "you reached X" message. */
  previousRankIndex: number;
}

/**
 * Compute the Explorer rank + XP from append-only history + sticky badges (Phase 43) and manage the
 * once-only "Rank up!" moment.
 *
 * XP is derived, never stored: `computeStats` over history (sessions/questions/correct), the
 * monotonic longest streak, and the count of *earned* badges (sticky). Only the **last-celebrated
 * rank** is persisted. On the first run (no persisted state) it's **seeded to the currently-computed
 * rank**, so a returning player's whole back-catalogue of XP never triggers a retroactive burst.
 *
 * `commit` (the celebrating surfaces — Summary and Home) advances the persisted rank when it has
 * risen, so exactly one surface fires the one-time celebration; display-only readers (Progress)
 * pass `commit: false` and never consume the flag. Returns rank 0 / zero XP before init.
 */
export async function loadRank(
  now = Date.now(),
  options: { commit?: boolean } = {},
): Promise<RankState> {
  const commit = options.commit ?? false;

  const [sessions, badges, stored] = store
    ? await Promise.all([store.getAllSessions(), store.getAchievements(), store.getProgression()])
    : [[] as SessionRecord[], [] as AchievementUnlock[], undefined];

  const stats = computeStats(sessions);
  const streak = computeStreak(
    sessions.map((s) => localDayKey(s.startedAt)),
    localDayKey(now),
  );
  const xp = computeXp({ stats, streak, achievementsUnlocked: badges.length });
  const progress = rankForXp(xp.total);
  const currentIndex = progress.rank.index;

  // First run: seed the celebrated rank to *now*, so pre-existing history isn't celebrated
  // retroactively. Otherwise the persisted value is the last rank we celebrated.
  const previousRankIndex = stored?.lastCelebratedRank ?? currentIndex;
  const justRankedUp = currentIndex > previousRankIndex;

  if (store) {
    // Persist the seed on first run always; on a committing read, advance the celebrated rank so
    // the "rank up!" fires exactly once and never re-fires for the same rank. Best-effort.
    const shouldWrite = !stored || (commit && currentIndex > previousRankIndex);
    if (shouldWrite) {
      const next: ProgressionState = { lastCelebratedRank: currentIndex };
      try {
        await store.saveProgression(next);
      } catch {
        // Storage became unwritable — the rank-up just isn't remembered across reloads.
      }
    }
  }

  return { xp, progress, justRankedUp, previousRankIndex };
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
  // XP is history-derived, so it drops to zero here; clear the celebrated-rank seed too so a
  // fresh climb re-celebrates rather than staying suppressed at the old high rank (Phase 43).
  await store?.clearProgression();
  // Grandmaster certification + cooldown are trophies too (Phase 45) — reset them alongside badges,
  // so a full progress wipe also clears the gilded cells / prestige and frees the daily attempts.
  await store?.clearGrandmaster();
}

/**
 * Erase all SR/training state (leaves prefs and play history intact). Earned badges are
 * cleared for the same reason as {@link clearHistory} — orphan trophies are confusing, and
 * still-qualifying badges (e.g. a streak backed by surviving history) re-unlock on next load.
 */
export async function clearTraining(): Promise<void> {
  await store?.clearSRItems();
  await store?.clearAchievements();
  // Badges (an XP source) are cleared above, so the celebrated-rank seed is reset too, matching
  // clearHistory: XP re-seeds to the recomputed rank and future climbs celebrate again (Phase 43).
  await store?.clearProgression();
  // Grandmaster certification + cooldown are cleared here too (Phase 45), matching how badges are
  // reset by a training wipe — the capstones are the mastery-track's trophies.
  await store?.clearGrandmaster();
}
