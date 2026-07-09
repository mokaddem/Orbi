// Daily-streak computation (Phase 15) — pure, framework-agnostic, unit-testable.
//
// A "streak" is the run of consecutive calendar days the player has played, up to today.
// It is *derived* from play history — no new persisted counter — so it can never drift
// out of sync with the sessions that back it.
//
// Clocks stay out of this module: `computeStreak` takes the set of active day-keys plus
// "today" as `YYYY-MM-DD` strings, so it is deterministic and needs no fake timer. The UI
// converts session timestamps to *local* day-keys (see `localDayKey`) — a habit streak is
// about the player's own calendar day, unlike History's UTC `dayKey` in stats.ts.

/** Consecutive-days summary shown on Home. */
export interface StreakInfo {
  /** Current run length ending today (or yesterday, until today is played), in days. */
  current: number;
  /** Longest run ever recorded across all active days. */
  longest: number;
  /** Whether the player has already played on `today`. */
  playedToday: boolean;
}

const MS_PER_DAY = 86_400_000;

/** Parse a `YYYY-MM-DD` key to a UTC-midnight timestamp — plain calendar-date arithmetic,
 * independent of the ambient timezone and DST (we only ever diff/step whole days). */
function parseKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatUTC(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Shift a day-key by `n` whole days (may be negative). */
function addDays(key: string, n: number): string {
  return formatUTC(parseKey(key) + n * MS_PER_DAY);
}

/** Whole-day difference `b - a` between two day-keys. */
function dayDiff(a: string, b: string): number {
  return Math.round((parseKey(b) - parseKey(a)) / MS_PER_DAY);
}

/** Local calendar day (`YYYY-MM-DD`) of a timestamp — the player's own day, for streaks. */
export function localDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Compute the streak from the set of day-keys with any activity and "today".
 *
 * Strict grace (owner-agreed): a missed day breaks the streak — there is no freeze. The
 * current run is anchored at today when it's already been played, otherwise at yesterday,
 * so the streak is not shown as broken during the current day until it actually lapses
 * (i.e. a whole day passes with no play). If neither today nor yesterday has activity, the
 * current streak is 0. `longest` is the longest consecutive run over all recorded days.
 */
export function computeStreak(dayKeys: Iterable<string>, todayKey: string): StreakInfo {
  const days = new Set(dayKeys);
  const playedToday = days.has(todayKey);

  // Walk backwards from the anchor while each preceding day was active.
  let current = 0;
  let cursor = playedToday ? todayKey : addDays(todayKey, -1);
  while (days.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  // Longest run: sort the distinct days and count the longest 1-day-step sequence.
  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const key of sorted) {
    run = prev !== null && dayDiff(prev, key) === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = key;
  }

  return { current, longest, playedToday };
}
