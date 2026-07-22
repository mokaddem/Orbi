// Backend board operations (Phase 52) — the compact stats snapshot the friend board
// is built from, plus thin, never-throwing PocketBase ops to mirror it.
//
// Like `identity.ts`, this talks to PocketBase but is NOT the SDK importer: it uses the
// shared client from `client.ts` and imports SDK *types* only (erased at build time). It
// carries no Svelte stores and no local persistence — the orchestration that gathers the
// local numbers and triggers a sync lives one layer up in `ui/stores/board.ts`.
//
// Two halves:
//   • `buildStatsSnapshot` — a PURE projection of the app's already-derived local stats
//     (XP/rank/tallies) into the flat field bag the server stores. Unit-tested in isolation.
//   • `upsertSnapshot` / `readOwnSnapshot` — best-effort I/O over the owner's single `stats`
//     row. They resolve `null`/`false` on any failure (no backend, offline, not signed in,
//     validation error, …) and NEVER throw — the same contract as the rest of the seam.
//
// The row is owned by the current `users` record (Phase 51). The owner id never leaves this
// module: the upsert binds the `user` relation from the cached auth record itself, so callers
// only ever hand over the client-computed numbers.
//
// Anti-cheat is a non-goal (see the phase PRD): the client reports whatever it computes and
// the server stores it verbatim. On any divergence, LOCAL always wins — the server copy is
// just what friends read.

import type { RecordModel } from 'pocketbase';
import { getClient } from './client';

/** The flat, client-reported snapshot stored server-side (one row per player). */
export interface StatsSnapshot {
  /** Denormalized display name so the friend board renders in one query. */
  displayName: string;
  /** Stable per-device id — disambiguation / dedup. */
  deviceId: string;
  /** Total XP — the board's primary sort key. */
  xp: number;
  /** Rank ladder index — render the medal without re-deriving server-side. */
  rankIndex: number;
  sessionCount: number;
  totalCorrect: number;
  totalQuestions: number;
  /** Longest-ever daily streak. */
  longestStreak: number;
  /** Countries whose every applicable family is mastered. */
  fullyMastered: number;
}

/** Everything {@link buildStatsSnapshot} projects from — all locally derived. */
export interface StatsSnapshotInput {
  displayName: string;
  deviceId: string;
  /** From `computeStats(sessions)`. */
  sessionCount: number;
  totalCorrect: number;
  totalQuestions: number;
  /** From `computeXp(...).total`. */
  xp: number;
  /** From `rankForXp(xp).rank.index`. */
  rankIndex: number;
  /** From the monotonic `computeStreak(...).longest`. */
  longestStreak: number;
  /** From the mastery rollup's `overall.fullyMastered`. */
  fullyMastered: number;
}

/** Clamp to a non-negative integer — the server number fields are `min: 0, onlyInt`. */
function nat(n: number): number {
  return Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
}

/**
 * Project the app's already-derived local stats into the flat snapshot the server stores.
 * Pure — no I/O, no clock. The counts are clamped to non-negative integers so a malformed
 * local value can never violate the collection's field constraints.
 */
export function buildStatsSnapshot(input: StatsSnapshotInput): StatsSnapshot {
  return {
    displayName: input.displayName,
    deviceId: input.deviceId,
    xp: nat(input.xp),
    rankIndex: nat(input.rankIndex),
    sessionCount: nat(input.sessionCount),
    totalCorrect: nat(input.totalCorrect),
    totalQuestions: nat(input.totalQuestions),
    longestStreak: nat(input.longestStreak),
    fullyMastered: nat(input.fullyMastered),
  };
}

/** Map a raw `stats` record back to the app's snapshot view (defensive type guards). Exported so
 *  the friends seam can map friends' rows from the widened read (Phase 53). */
export function snapshotFromRecord(record: RecordModel): StatsSnapshot {
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    displayName: typeof record.displayName === 'string' ? record.displayName : '',
    deviceId: typeof record.deviceId === 'string' ? record.deviceId : '',
    xp: num(record.xp),
    rankIndex: num(record.rankIndex),
    sessionCount: num(record.sessionCount),
    totalCorrect: num(record.totalCorrect),
    totalQuestions: num(record.totalQuestions),
    longestStreak: num(record.longestStreak),
    fullyMastered: num(record.fullyMastered),
  };
}

/**
 * Upsert the signed-in player's single `stats` row (create if missing, else update). The
 * `user` relation is bound from the cached auth record — the owner id never comes from the
 * caller. Idempotent and best-effort: returns `false` when there's no backend, no signed-in
 * record, or the write fails. NEVER throws.
 */
export async function upsertSnapshot(snapshot: StatsSnapshot): Promise<boolean> {
  const pb = await getClient();
  if (!pb) return false;
  const ownerId = pb.authStore.record?.id;
  if (!ownerId) return false; // not signed in (anon-ensure may still be in flight) — skip
  const payload = { ...snapshot, user: ownerId };
  try {
    const existing = await pb.collection('stats').getFirstListItem(`user = "${ownerId}"`);
    await pb.collection('stats').update(existing.id, payload);
    return true;
  } catch {
    // No row yet (404) or a transient read error — try to create it.
    try {
      await pb.collection('stats').create(payload);
      return true;
    } catch {
      return false; // offline, unique-index race, validation, … — best-effort, so give up quietly
    }
  }
}

/**
 * Read the signed-in player's own `stats` row (the "real record round-trip" proof for the
 * manual smoke, and a future read path). Returns the mapped snapshot, or `null` on any
 * failure. NEVER throws.
 */
export async function readOwnSnapshot(): Promise<StatsSnapshot | null> {
  const pb = await getClient();
  if (!pb) return null;
  const ownerId = pb.authStore.record?.id;
  if (!ownerId) return null;
  try {
    const record = await pb.collection('stats').getFirstListItem(`user = "${ownerId}"`);
    return snapshotFromRecord(record);
  } catch {
    return null;
  }
}
