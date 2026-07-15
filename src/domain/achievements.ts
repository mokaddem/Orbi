// Achievements (Phase 16) — pure, framework-agnostic, unit-testable.
//
// A declarative catalog of collectible local milestones. Each badge is an `id` plus a pure
// predicate over already-computed rollups (`stats`, `mastery`, `streak`) and the raw
// `sessions` (for per-session feats like a flawless run). Evaluating the catalog yields a
// locked/unlocked verdict per badge; the persistence layer is what stamps *when* a badge
// first unlocked (for the one-time "unlocked!" moment) — this module stays clockless and
// storage-free so every predicate is trivially testable at its boundary.
//
// i18n lives in the UI: a badge's title and "how to earn" text are keyed by its `id`
// (`achievements.<id>.title` / `.desc`), so adding a badge here + two message keys is all
// it takes. Catalog order is display order.

import type { SessionRecord } from '../data/persistence/types';
import type { MasteryResult } from './mastery';
import { FAMILIES, type MasteryFamily, masteryFamilyOf } from './modes';
import type { StatsOverview } from './stats';
import type { StreakInfo } from './streak';

/** The five M49 continents that get their own "mastered <continent>" badge. */
export const CONTINENTS = ['Europe', 'Africa', 'Asia', 'Americas', 'Oceania'] as const;

/** A "speedy round" needs at least this many questions (so a 1-question fluke can't earn it). */
export const SPEEDY_MIN_QUESTIONS = 5;
/** …answered in under this mean time each. */
export const SPEEDY_MAX_AVG_MS = 3_000;
/** The "century" badge target — countries mastered. */
export const CENTURY_TARGET = 100;
/** The "collector" badge target for an extra topic (capitals / languages) — items mastered. */
export const EXTRA_COLLECTOR_TARGET = 25;
/** The "scholar/century" badge target for an extra topic — items mastered. */
export const EXTRA_CENTURY_TARGET = 100;
/** @deprecated kept as aliases; extra topics now share {@link EXTRA_COLLECTOR_TARGET}. */
export const CAPITALS_COLLECTOR_TARGET = EXTRA_COLLECTOR_TARGET;
/** @deprecated kept as aliases; extra topics now share {@link EXTRA_CENTURY_TARGET}. */
export const CAPITALS_CENTURY_TARGET = EXTRA_CENTURY_TARGET;
/** Day thresholds for the streak badges. */
export const STREAK_BADGE_DAYS = { week: 7, month: 30 } as const;

/** The non-country "extra knowledge" topics that each get a parallel badge ladder. */
export type ExtraTopic = 'capitals' | 'languages' | 'industries';

/** Everything a badge predicate may read. Rollups are precomputed; `sessions` is raw. */
export interface AchievementContext {
  stats: StatsOverview;
  mastery: MasteryResult;
  /** Separate capital-mastery rollup (Phase 24) — its own ladder, not folded into `mastery`. */
  capitalMastery: MasteryResult;
  /** Separate language-mastery rollup (Phase 23) — its own ladder, folded into the same
   *  combined "extra knowledge" surface as capitals, not into `mastery`. */
  languageMastery: MasteryResult;
  /** Separate industry-mastery rollup (Phase 25) — its own ladder in the combined
   *  "extra knowledge" surface, not folded into `mastery`. */
  industryMastery: MasteryResult;
  streak: StreakInfo;
  sessions: readonly SessionRecord[];
  /** Evaluation time — carried for extensibility (time-of-day badges etc.); pure given it. */
  now: number;
}

/** One badge definition. `region` is set only for the per-continent badges; `topic` only for
 *  the extra-knowledge badges (capitals / languages), which the UI groups out of the main grid;
 *  `capstone` + `family` mark the Phase-44 Grandmaster Run badges, which the UI surfaces inside
 *  the World Mastery panel (as gilded cells) rather than in the achievements grid. */
export interface AchievementDef {
  id: string;
  region?: (typeof CONTINENTS)[number];
  topic?: ExtraTopic;
  /** A Grandmaster Run capstone (Phase 44) — shown in the mastery panel, not the badges grid. */
  capstone?: boolean;
  /** The core family a capstone certifies (Grandmaster badges only). */
  family?: MasteryFamily;
  predicate: (ctx: AchievementContext) => boolean;
}

/** A badge's evaluated state (unlock *dates* are added by the persistence layer). */
export interface AchievementStatus {
  id: string;
  unlocked: boolean;
}

/** Mean answer time over a session's questions; `Infinity` for an empty session. */
function sessionAvgMs(rec: SessionRecord): number {
  if (rec.questions.length === 0) return Infinity;
  return rec.questions.reduce((sum, q) => sum + q.answerMs, 0) / rec.questions.length;
}

/** Whether a region is fully mastered (and non-empty). */
function regionComplete(mastery: MasteryResult, region: string): boolean {
  const r = mastery.byRegion.find((x) => x.region === region);
  return !!r && r.total > 0 && r.mastered === r.total;
}

/** The stable badge id for a family × continent Grandmaster Run capstone (Phase 44). */
export function grandmasterId(family: MasteryFamily, region: string): string {
  return `grandmaster-${family}-${region.toLowerCase()}`;
}

/** How many Grandmaster Run capstones exist — one per core family × continent (3 × 5 = 15). */
export const GRANDMASTER_TOTAL = FAMILIES.length * CONTINENTS.length;

/**
 * Whether a **clean-sweep** Grandmaster Run for `family × region` is present in history — the
 * capstone-unlock signal (Phase 44). A run persists as an ordinary `SessionRecord` tagged
 * `type: 'challenge'` with a representative `mode` (the family's first direction) and the
 * continent as its `regionFilter.region`; a pass is the one-life clean sweep (`correct === total`).
 * A failed run (a single miss ⇒ `correct < total`) or a quit never certifies.
 */
function grandmasterCertified(
  sessions: readonly SessionRecord[],
  family: MasteryFamily,
  region: string,
): boolean {
  return sessions.some(
    (s) =>
      s.type === 'challenge' &&
      s.total > 0 &&
      s.correct === s.total &&
      s.regionFilter?.region === region &&
      masteryFamilyOf(s.mode) === family,
  );
}

/**
 * The parallel badge ladder for an extra-knowledge topic (capitals, languages, later
 * industries), over that topic's own mastery rollup: a collector tier, one per continent, a
 * scholar/century tier, and a master-all tier. Capitals keep their historical `capitals-*`
 * ids (so earned badges stay earned); languages mirror them as `languages-*`.
 */
function extraTopicBadges(
  topic: ExtraTopic,
  get: (ctx: AchievementContext) => MasteryResult,
): AchievementDef[] {
  return [
    {
      id: `${topic}-collector`,
      topic,
      predicate: (ctx) => get(ctx).overall.mastered >= EXTRA_COLLECTOR_TARGET,
    },
    ...CONTINENTS.map((region): AchievementDef => ({
      id: `${topic}-${region.toLowerCase()}`,
      topic,
      region,
      predicate: (ctx) => regionComplete(get(ctx), region),
    })),
    {
      id: `${topic}-century`,
      topic,
      predicate: (ctx) => get(ctx).overall.mastered >= EXTRA_CENTURY_TARGET,
    },
    {
      id: `${topic}-world`,
      topic,
      predicate: (ctx) => {
        const o = get(ctx).overall;
        return o.total > 0 && o.mastered === o.total;
      },
    },
  ];
}

/**
 * The badge catalog, in display order. Grouped getting-started → skill → habit → mastery →
 * extra-knowledge topics. Every predicate is pure over its context, so a fixture that makes
 * it true unlocks the badge and nothing else does.
 */
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  // Getting started
  { id: 'first-round', predicate: ({ stats }) => stats.sessionCount >= 1 },
  // Skill feats (per-session)
  {
    id: 'perfect-fixed',
    predicate: ({ sessions }) =>
      sessions.some((s) => s.type === 'fixed' && s.total > 0 && s.correct === s.total),
  },
  {
    id: 'flawless-survival',
    predicate: ({ sessions }) =>
      sessions.some((s) => s.type === 'survival' && s.total > 0 && s.correct === s.total),
  },
  {
    id: 'speedy',
    predicate: ({ sessions }) =>
      sessions.some((s) => s.total >= SPEEDY_MIN_QUESTIONS && sessionAvgMs(s) < SPEEDY_MAX_AVG_MS),
  },
  // Habit
  { id: 'streak-7', predicate: ({ streak }) => streak.longest >= STREAK_BADGE_DAYS.week },
  { id: 'streak-30', predicate: ({ streak }) => streak.longest >= STREAK_BADGE_DAYS.month },
  // Mastery
  {
    id: 'region-mastered',
    predicate: ({ mastery }) => mastery.byRegion.some((r) => r.total > 0 && r.mastered === r.total),
  },
  ...CONTINENTS.map((region): AchievementDef => ({
    id: `mastered-${region.toLowerCase()}`,
    region,
    predicate: ({ mastery }) => regionComplete(mastery, region),
  })),
  { id: 'century', predicate: ({ mastery }) => mastery.overall.mastered >= CENTURY_TARGET },
  {
    id: 'world-mastered',
    predicate: ({ mastery }) =>
      mastery.overall.total > 0 && mastery.overall.mastered === mastery.overall.total,
  },
  // Extra-knowledge topics (Phase 24 capitals, Phase 23 languages) — separate ladders over
  // their own rollups, so learning them earns their own badges without touching country
  // mastery. The UI groups these (via `topic`) into the combined "extra knowledge" surface.
  ...extraTopicBadges('capitals', (ctx) => ctx.capitalMastery),
  ...extraTopicBadges('languages', (ctx) => ctx.languageMastery),
  ...extraTopicBadges('industries', (ctx) => ctx.industryMastery),
  // Grandmaster Run capstones (Phase 44) — one per core family × continent (3 × 5 = 15). Monotonic
  // like the mastery badges (never revoked), but surfaced in the World Mastery panel as gilded
  // cells rather than in the badges grid (hence `capstone`). Unlocked by a clean-sweep one-life run.
  ...FAMILIES.flatMap((f) =>
    CONTINENTS.map((region): AchievementDef => ({
      id: grandmasterId(f.key, region),
      region,
      family: f.key,
      capstone: true,
      predicate: ({ sessions }) => grandmasterCertified(sessions, f.key, region),
    })),
  ),
];

/** All badge ids, in display order — handy for i18n parity checks and iteration. */
export const ACHIEVEMENT_IDS: readonly string[] = ACHIEVEMENTS.map((a) => a.id);

/** Evaluate every badge against the context, in catalog order. Pure. */
export function evaluateAchievements(ctx: AchievementContext): AchievementStatus[] {
  return ACHIEVEMENTS.map((a) => ({ id: a.id, unlocked: a.predicate(ctx) }));
}
