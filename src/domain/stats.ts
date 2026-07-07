// Stats aggregation (Phase 6) — pure, framework-agnostic, unit-testable.
//
// Rolls a list of persisted `SessionRecord`s up into the numbers the History view
// shows: totals and accuracy, average answer time, a per-day timeline, and the
// most-missed countries. No storage or DOM here — the UI passes in records loaded
// from the `QuizStore` and renders the result.

import type { SessionRecord } from '../data/persistence/types';

/** A country the player gets wrong, with how often it has been seen and missed. */
export interface MissedCountry {
  iso2: string;
  /** Times this country was answered incorrectly (across all modes). */
  misses: number;
  /** Times this country was asked at all. */
  attempts: number;
}

/** Play activity bucketed by calendar day (UTC), for the "sessions over time" view. */
export interface DailyStat {
  /** `YYYY-MM-DD` (UTC). */
  date: string;
  sessions: number;
  questions: number;
  correct: number;
}

/** The full rollup rendered by the History route. */
export interface StatsOverview {
  sessionCount: number;
  totalQuestions: number;
  totalCorrect: number;
  /** `totalCorrect / totalQuestions`, in [0, 1]; `0` when nothing has been played. */
  accuracy: number;
  /** Mean answer time per question, in ms; `0` when nothing has been played. */
  avgAnswerMs: number;
  /** Total time spent in sessions, in ms. */
  totalPlayMs: number;
  /** One entry per day that has activity, ascending by date. */
  byDay: DailyStat[];
  /** Countries missed at least once, most-missed first. */
  mostMissed: MissedCountry[];
}

const EMPTY: StatsOverview = {
  sessionCount: 0,
  totalQuestions: 0,
  totalCorrect: 0,
  accuracy: 0,
  avgAnswerMs: 0,
  totalPlayMs: 0,
  byDay: [],
  mostMissed: [],
};

/** UTC calendar day (`YYYY-MM-DD`) of a timestamp — stable and timezone-independent. */
export function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Aggregate persisted sessions into the History overview. Pure and order-independent. */
export function computeStats(records: readonly SessionRecord[]): StatsOverview {
  if (records.length === 0) return { ...EMPTY };

  let totalQuestions = 0;
  let totalCorrect = 0;
  let totalAnswerMs = 0;
  let totalPlayMs = 0;

  const days = new Map<string, DailyStat>();
  const missed = new Map<string, MissedCountry>();

  for (const rec of records) {
    totalPlayMs += rec.durationMs;

    const key = dayKey(rec.startedAt);
    const day = days.get(key) ?? { date: key, sessions: 0, questions: 0, correct: 0 };
    day.sessions += 1;
    day.questions += rec.questions.length;
    day.correct += rec.correct;
    days.set(key, day);

    for (const q of rec.questions) {
      totalQuestions += 1;
      totalAnswerMs += q.answerMs;
      if (q.correct) totalCorrect += 1;

      const m = missed.get(q.countryIso2) ?? { iso2: q.countryIso2, misses: 0, attempts: 0 };
      m.attempts += 1;
      if (!q.correct) m.misses += 1;
      missed.set(q.countryIso2, m);
    }
  }

  const byDay = [...days.values()].sort((a, b) => a.date.localeCompare(b.date));

  // Most-missed first; break ties by attempts (more-tested), then iso2 for stability.
  const mostMissed = [...missed.values()]
    .filter((m) => m.misses > 0)
    .sort((a, b) => b.misses - a.misses || b.attempts - a.attempts || a.iso2.localeCompare(b.iso2));

  return {
    sessionCount: records.length,
    totalQuestions,
    totalCorrect,
    accuracy: totalQuestions === 0 ? 0 : totalCorrect / totalQuestions,
    avgAnswerMs: totalQuestions === 0 ? 0 : totalAnswerMs / totalQuestions,
    totalPlayMs,
    byDay,
    mostMissed,
  };
}
