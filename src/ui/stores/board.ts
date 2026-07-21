// Board sync orchestration (Phase 52) — mirror the player's headline progress to the server
// so Phase 53's friend board has something to read. It composes three lower layers:
//   • local persistence (`persistence.ts`) — the append-only history the stats derive from,
//   • the pure domain projections (`computeStats`/`computeXp`/`rankForXp`/mastery),
//   • the backend seam (`backend/board.ts`) — best-effort, never-throwing PocketBase I/O.
//
// Contract (inherited from Foundation + identity): the board's SELF row is computed from
// LOCAL stats and rendered with or without a backend (see Progress). This module is the
// additive, write-only mirror: it derives the same numbers the UI already shows and upserts
// them, best-effort, on the right triggers. It NEVER blocks the UI and NEVER throws — with no
// backend configured (or the player not yet signed in) it simply no-ops. Local always wins.
//
// It holds no reactive state (the self row is derived by Progress from its already-loaded
// stats); it is pure orchestration, like `identity.ts`. Keeping it out of the identity store's
// import graph (it reads the device id straight from persistence) lets identity trigger a sync
// on sign-in without a circular import.

import { get } from 'svelte/store';
import { computeStats, computeStreak, localDayKey } from '../../domain';
import { isBackendConfigured } from '../../backend/client';
import { buildStatsSnapshot, upsertSnapshot } from '../../backend/board';
import { loadSessions, loadRank, loadMastery, prefs, getStoredIdentity } from './persistence';

// Coalesce bursts (session-end + rename + reset can fire together) without timers: while a
// sync is in flight, remember that another was requested and run exactly one more afterwards.
let inFlight: Promise<void> | null = null;
let pending = false;

/** Gather the same headline numbers the UI derives, then project them into the snapshot. */
async function buildLocalSnapshot() {
  const stored = await getStoredIdentity();
  const sessions = await loadSessions();
  const stats = computeStats(sessions);
  const now = Date.now();
  const [rank, mastery] = await Promise.all([loadRank(now, { commit: false }), loadMastery(now)]);
  const longestStreak = computeStreak(
    sessions.map((s) => localDayKey(s.startedAt)),
    localDayKey(now),
  ).longest;
  return buildStatsSnapshot({
    displayName: get(prefs).playerName ?? '',
    deviceId: stored?.deviceId ?? '',
    sessionCount: stats.sessionCount,
    totalCorrect: stats.totalCorrect,
    totalQuestions: stats.totalQuestions,
    xp: rank.xp.total,
    rankIndex: rank.progress.rank.index,
    longestStreak,
    fullyMastered: mastery.overall.fullyMastered,
  });
}

async function runSync(): Promise<void> {
  try {
    // No backend configured → the app behaves exactly as today; the mirror is a silent no-op.
    if (!isBackendConfigured()) return;
    const snapshot = await buildLocalSnapshot();
    // Best-effort: swallows "not signed in yet" (returns false) — a later trigger catches up.
    await upsertSnapshot(snapshot);
  } catch {
    // Never throw into the UI: a mirror failure leaves the local (source-of-truth) values shown.
  }
}

/**
 * Best-effort, coalesced push of the local headline snapshot to the server. Safe to call from
 * any trigger (startup / sign-in / session-end / rename / reset); rapid calls collapse into at
 * most one follow-up run. No-op with no backend or before the player is signed in. Never throws.
 */
export function syncBoard(): Promise<void> {
  if (inFlight) {
    pending = true;
    return inFlight;
  }
  inFlight = runSync().finally(() => {
    inFlight = null;
    if (pending) {
      pending = false;
      void syncBoard();
    }
  });
  return inFlight;
}

/** Reset module state. Test seam only — not used by the app. */
export function __resetBoardForTests(): void {
  inFlight = null;
  pending = false;
}
