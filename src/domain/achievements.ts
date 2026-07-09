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
/** Day thresholds for the streak badges. */
export const STREAK_BADGE_DAYS = { week: 7, month: 30 } as const;

/** Everything a badge predicate may read. Rollups are precomputed; `sessions` is raw. */
export interface AchievementContext {
  stats: StatsOverview;
  mastery: MasteryResult;
  streak: StreakInfo;
  sessions: readonly SessionRecord[];
  /** Evaluation time — carried for extensibility (time-of-day badges etc.); pure given it. */
  now: number;
}

/** One badge definition. `region` is set only for the per-continent badges. */
export interface AchievementDef {
  id: string;
  region?: (typeof CONTINENTS)[number];
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

/**
 * The badge catalog, in display order. Grouped getting-started → skill → habit → mastery.
 * Every predicate is pure over its context, so a fixture that makes it true unlocks the
 * badge and nothing else does.
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
];

/** All badge ids, in display order — handy for i18n parity checks and iteration. */
export const ACHIEVEMENT_IDS: readonly string[] = ACHIEVEMENTS.map((a) => a.id);

/** Evaluate every badge against the context, in catalog order. Pure. */
export function evaluateAchievements(ctx: AchievementContext): AchievementStatus[] {
  return ACHIEVEMENTS.map((a) => ({ id: a.id, unlocked: a.predicate(ctx) }));
}
