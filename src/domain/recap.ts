// Weekly recap (Phase 16) — pure, framework-agnostic, unit-testable.
//
// Summarises "this week" for the player: how many sessions and questions, accuracy, roughly
// how many countries they newly mastered, and their current/longest daily streak. The week
// is the player's *local* calendar week starting **Monday 00:00** — consistent with the
// streak's local-day handling (Phase 15), not History's UTC buckets.
//
// The clock is injected (`now`), so this is deterministic and needs no fake timer.
//
// ⚠️ "Newly mastered this week" is an approximation. We do not persist mastery *history*, so
// we can't know a country's state at the start of the week. Instead we count countries that
// are mastered *now* whose most-recently-reviewed mastered item was last touched within the
// window — a country freshly pushed over the bar this week. It can slightly over-count a
// country that was already mastered and merely reviewed again this week; that's an accepted
// trade-off for staying backend-free and stateless.

import type { SessionRecord, SRItem } from '../data/persistence/types';
import { isItemMastered } from './mastery';
import { MASTERY_MODES } from './modes';
import { computeStreak, localDayKey } from './streak';
import { parseItemKey } from './training';

/** The one-week summary rendered by the recap card. */
export interface WeeklyRecap {
  /** Local start-of-week timestamp (Monday 00:00) the window opened at. */
  weekStart: number;
  /** Sessions started within [weekStart, now]. */
  sessions: number;
  /** Questions answered this week. */
  questions: number;
  /** Correct answers this week. */
  correct: number;
  /** `correct / questions` in [0, 1]; `0` when nothing was played this week. */
  accuracy: number;
  /** Approx. countries newly mastered this week (see module note). */
  masteredThisWeek: number;
  /** Current daily-streak length (derived from all history, not just this week). */
  currentStreak: number;
  /** Longest daily-streak ever. */
  longestStreak: number;
}

export interface RecapOptions {
  /** Clock, injected for deterministic tests (default `Date.now`). */
  now?: number;
  /** SR state, needed for the "newly mastered this week" approximation. */
  srItems?: readonly SRItem[];
}

/**
 * Start of the player's local week (Monday 00:00) containing `ts`. Pure calendar math in
 * local time — so DST shifts and timezone are handled by the platform `Date`.
 */
export function localWeekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0); // local midnight of `ts`'s day
  const daysSinceMonday = (d.getDay() + 6) % 7; // getDay: 0=Sun..6=Sat → Mon=0 … Sun=6
  d.setDate(d.getDate() - daysSinceMonday);
  return d.getTime();
}

/** Countries mastered at `now` whose latest mastered-item review falls within [from, to]. */
function masteredWithin(srItems: readonly SRItem[], from: number, to: number, now: number): number {
  // Latest review time among a country's *mastered* items, keyed by iso2. Only the country-
  // identification modes count — capitals and languages are kept separate from country mastery
  // (their own rollups), so they must not inflate this "newly mastered countries" number.
  const latest = new Map<string, number>();
  for (const item of srItems) {
    if (!isItemMastered(item, now)) continue;
    const parsed = parseItemKey(item.itemKey);
    if (!parsed || !MASTERY_MODES.includes(parsed.mode)) continue;
    const ts = item.lastReviewedAt ?? 0;
    const prev = latest.get(parsed.iso2);
    if (prev === undefined || ts > prev) latest.set(parsed.iso2, ts);
  }

  let count = 0;
  for (const ts of latest.values()) if (ts >= from && ts <= to) count += 1;
  return count;
}

/**
 * Roll play history up into the current week's recap. Pure and order-independent given
 * `now`. Sessions are windowed by their local start time; the streak is computed over all
 * of history (a streak isn't a weekly notion).
 */
export function computeWeeklyRecap(
  sessions: readonly SessionRecord[],
  options: RecapOptions = {},
): WeeklyRecap {
  const now = options.now ?? Date.now();
  const srItems = options.srItems ?? [];
  const weekStart = localWeekStart(now);

  let sessionCount = 0;
  let questions = 0;
  let correct = 0;
  for (const rec of sessions) {
    if (rec.startedAt < weekStart || rec.startedAt > now) continue;
    sessionCount += 1;
    questions += rec.questions.length;
    correct += rec.correct;
  }

  const streak = computeStreak(
    sessions.map((s) => localDayKey(s.startedAt)),
    localDayKey(now),
  );

  return {
    weekStart,
    sessions: sessionCount,
    questions,
    correct,
    accuracy: questions === 0 ? 0 : correct / questions,
    masteredThisWeek: masteredWithin(srItems, weekStart, now, now),
    currentStreak: streak.current,
    longestStreak: streak.longest,
  };
}
