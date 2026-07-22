// Backend friend-graph operations (Phase 53) — thin, never-throwing pb ops over the `friendships`
// collection + the widened `stats` read, built on the Foundation seam.
//
// Like `identity.ts`/`board.ts`, this talks to PocketBase but is NOT the SDK importer: it uses the
// shared client from `client.ts` and imports SDK *types* only. It carries no Svelte stores and no
// local persistence — the orchestration (gating on backend + account tier, the reactive list) lives
// one layer up in `ui/stores/friends.ts`.
//
// Every function is best-effort: it resolves to a value / `false` on any failure (no backend, offline,
// not signed in, validation) and NEVER throws.
//
// Model (see the migration): a friendship is ONE symmetric row per pair, stored in canonical order
// (`userA` < `userB`) with a unique index, so add is idempotent and the pair is unambiguous. The
// signed-in user's id is resolved INSIDE this seam from the cached auth record — callers pass only the
// friend's id (from an invite).

import type { RecordModel } from 'pocketbase';
import { getClient } from './client';
import { snapshotFromRecord, type StatsSnapshot } from './board';

/** A board row: a readable `stats` snapshot + whose it is + whether it's the signed-in user. */
export interface BoardEntry extends StatsSnapshot {
  /** The `users` record id that owns this snapshot. */
  userId: string;
  /** True for the signed-in user's own row. */
  isSelf: boolean;
}

/** The signed-in `users` record id, or `null` when not authed / no backend. Never throws. */
export async function currentUserId(): Promise<string | null> {
  const pb = await getClient();
  return pb?.authStore.record?.id ?? null;
}

/** Canonical (lexicographic) ordering of a pair, so a friendship is one unambiguous row. */
function canonicalPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** Escape a value for safe interpolation into a PocketBase filter string literal. */
function filterQuote(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

/**
 * Create (idempotent) an accepted friendship between the signed-in user and `friendId`. Instant mutual
 * (OQ3): a fresh invite opened is the consent. Returns `true` on success or if it already exists;
 * `false` with no backend, not signed in, a self-add, or on failure. Never throws.
 */
export async function addFriend(friendId: string): Promise<boolean> {
  const pb = await getClient();
  if (!pb) return false;
  const me = pb.authStore.record?.id;
  if (!me || !friendId || friendId === me) return false;
  const [userA, userB] = canonicalPair(me, friendId);
  const filter = `userA = "${filterQuote(userA)}" && userB = "${filterQuote(userB)}"`;
  try {
    await pb.collection('friendships').getFirstListItem(filter);
    return true; // already friends
  } catch {
    // No row yet (404) or a transient read error — try to create it.
    try {
      await pb.collection('friendships').create({ userA, userB, status: 'accepted' });
      return true;
    } catch {
      return false; // offline, unique-index race, validation, …
    }
  }
}

/**
 * Remove the friendship between the signed-in user and `friendId` (either endpoint may unfriend).
 * Returns `true` on success, `false` if there was nothing to remove / on failure. Never throws.
 */
export async function removeFriend(friendId: string): Promise<boolean> {
  const pb = await getClient();
  if (!pb) return false;
  const me = pb.authStore.record?.id;
  if (!me || !friendId) return false;
  const [userA, userB] = canonicalPair(me, friendId);
  const filter = `userA = "${filterQuote(userA)}" && userB = "${filterQuote(userB)}"`;
  try {
    const row = await pb.collection('friendships').getFirstListItem(filter);
    await pb.collection('friendships').delete(row.id);
    return true;
  } catch {
    return false;
  }
}

/** The `user` relation id off a raw record (single relation → string). */
function ownerId(record: RecordModel): string {
  return typeof record.user === 'string' ? record.user : '';
}

/**
 * List every `stats` row the signed-in user can read (their own + accepted friends', via the widened
 * read rule) as board entries. Sorted by XP desc; the self row is flagged. Returns `[]` with no
 * backend / not signed in / on failure. Never throws.
 */
export async function listBoardEntries(): Promise<BoardEntry[]> {
  const pb = await getClient();
  if (!pb) return [];
  const me = pb.authStore.record?.id;
  if (!me) return [];
  try {
    const rows = await pb.collection('stats').getFullList({ sort: '-xp' });
    return rows.map((r) => {
      const uid = ownerId(r);
      return { ...snapshotFromRecord(r), userId: uid, isSelf: uid === me };
    });
  } catch {
    return [];
  }
}
