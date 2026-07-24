// Duel timing helpers (duels-hub redesign) — pure, framework-free, unit-tested. They power the Sent
// tab's "sent 2h ago" relative age and the expiry pill on pending outbox challenges.
//
// The invite lifetime is now server-owned: PocketBase stamps `expiresAt = created + 7d` on create
// (pb_hooks/duel_expiry.pb.js) and drops expired invites from the opponent's inbox. `duelExpiry` takes
// that absolute `expiresAt`; `DUEL_EXPIRY_MS` remains the client-side fallback for any pre-TTL row that
// has no stamp yet (compute `created + DUEL_EXPIRY_MS`).

/** The invite lifetime — kept in sync with the server hook. Used as the fallback for pre-TTL rows. */
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

/** Remaining life of a pending challenge, from its absolute expiry instant (`expiresAt`). */
export type DuelExpiry =
  | { state: 'expired' }
  | { state: 'soon'; hours: number } // < 24h left — the pill warms to amber
  | { state: 'ok'; days: number }; // >= 24h left

export function duelExpiry(expiresAtMs: number, nowMs: number): DuelExpiry {
  const remaining = expiresAtMs - nowMs;
  if (remaining <= 0) return { state: 'expired' };
  if (remaining < DAY) return { state: 'soon', hours: Math.max(1, Math.ceil(remaining / HOUR)) };
  return { state: 'ok', days: Math.ceil(remaining / DAY) };
}
