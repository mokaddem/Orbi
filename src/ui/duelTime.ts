// Duel timing helpers (duels-hub redesign) — pure, framework-free, unit-tested. They power the Sent
// tab's "sent 2h ago" relative age and the 7-day expiry pill on pending outbox challenges.
//
// Expiry is DISPLAY-ONLY for now: the server still accepts a result on an "expired" duel. Enforcing it
// server-side (reject accepting an expired duel + a cleanup path) is a deliberately deferred follow-up.

/** A pending sent challenge is shown as expiring 7 days after it was created. Display-only window. */
export const DUEL_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Parse a PocketBase autodate string to epoch ms, or `null` if it won't parse. PocketBase 0.23+
 * serializes autodate fields with a space separator ("2024-07-21 12:00:00.123Z") which `Date.parse`
 * doesn't reliably accept, so normalize it to an ISO 'T' first.
 */
export function parseCreated(value: string): number | null {
  if (!value) return null;
  const iso = value.includes('T') ? value : value.replace(' ', 'T');
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/** Coarse "time since sent" bucket. Clock skew (a future timestamp) clamps to "now". */
export type DuelAge =
  | { unit: 'now' }
  | { unit: 'min'; n: number }
  | { unit: 'hour'; n: number }
  | { unit: 'day'; n: number };

export function duelAge(createdMs: number, nowMs: number): DuelAge {
  const elapsed = Math.max(0, nowMs - createdMs);
  if (elapsed < MINUTE) return { unit: 'now' };
  if (elapsed < HOUR) return { unit: 'min', n: Math.floor(elapsed / MINUTE) };
  if (elapsed < DAY) return { unit: 'hour', n: Math.floor(elapsed / HOUR) };
  return { unit: 'day', n: Math.floor(elapsed / DAY) };
}

/** Remaining life of a pending challenge against a fixed window (default 7 days). Display-only. */
export type DuelExpiry =
  | { state: 'expired' }
  | { state: 'soon'; hours: number } // < 24h left — the pill warms to amber
  | { state: 'ok'; days: number }; // >= 24h left

export function duelExpiry(
  createdMs: number,
  nowMs: number,
  windowMs: number = DUEL_EXPIRY_MS,
): DuelExpiry {
  const remaining = createdMs + windowMs - nowMs;
  if (remaining <= 0) return { state: 'expired' };
  if (remaining < DAY) return { state: 'soon', hours: Math.max(1, Math.ceil(remaining / HOUR)) };
  return { state: 'ok', days: Math.ceil(remaining / DAY) };
}
