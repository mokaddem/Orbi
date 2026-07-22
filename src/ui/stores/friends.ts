// Friends orchestration (Phase 53) — the reactive friend list the board reads, and the actions the
// invite route + board call. It composes the backend friend seam (`backend/friends.ts`), the backend
// config (`backend/client.ts`), and the identity store (for the account gate). It holds the friend
// rows (self excluded — Progress renders the self row from LOCAL stats, Phase 52), sorted by XP.
//
// Contract (inherited): everything is best-effort and never throws. With no backend configured the
// list is empty and actions no-op; friending requires a real account (OQ1) — anonymous callers get a
// `no-account` result so the UI can show the "create an account to add friends" gate. It does NOT
// import the board store, and the identity store does not import it, so there is no import cycle.

import { get, writable, type Readable } from 'svelte/store';
import { isBackendConfigured } from '../../backend/client';
import {
  addFriend as backendAddFriend,
  removeFriend as backendRemoveFriend,
  currentUserId,
  listBoardEntries,
  type BoardEntry,
} from '../../backend/friends';
import { identity } from './identity';

/** A friend's board row (the render fields; self is excluded from this list). */
export interface FriendRow {
  userId: string;
  displayName: string;
  xp: number;
  rankIndex: number;
  fullyMastered: number;
  sessionCount: number;
}

const friendsStore = writable<FriendRow[]>([]);
/** Read-only reactive friend list for the board (self excluded, XP desc). */
export const friends: Readable<FriendRow[]> = { subscribe: friendsStore.subscribe };

/** Result of an add attempt — a stable code the UI localises. */
export type FriendActionResult = 'ok' | 'no-backend' | 'no-account' | 'self' | 'failed';

function toRow(e: BoardEntry): FriendRow {
  return {
    userId: e.userId,
    displayName: e.displayName,
    xp: e.xp,
    rankIndex: e.rankIndex,
    fullyMastered: e.fullyMastered,
    sessionCount: e.sessionCount,
  };
}

/**
 * Refresh the friend list from the server (self excluded, sorted XP desc). No-op (clears the list)
 * with no backend. Best-effort; never throws.
 */
export async function refreshFriends(): Promise<void> {
  if (!isBackendConfigured()) {
    friendsStore.set([]);
    return;
  }
  const entries = await listBoardEntries();
  friendsStore.set(
    entries
      .filter((e) => !e.isSelf)
      .map(toRow)
      .sort((a, b) => b.xp - a.xp),
  );
}

/**
 * Add a friend from an opened invite's uid. Requires a real account (OQ1): an anonymous caller gets
 * `no-account` so the UI can route to the Phase-51 upgrade. Instant + mutual (OQ3). Never throws.
 */
export async function addFriendFromInvite(uid: string): Promise<FriendActionResult> {
  if (!isBackendConfigured()) return 'no-backend';
  if (get(identity).tier !== 'account') return 'no-account';
  const me = await currentUserId();
  if (me && uid === me) return 'self';
  const ok = await backendAddFriend(uid);
  if (!ok) return 'failed';
  await refreshFriends();
  return 'ok';
}

/** Remove a friend (either endpoint). Refreshes the list on success. Never throws. */
export async function unfriend(userId: string): Promise<boolean> {
  const ok = await backendRemoveFriend(userId);
  if (ok) await refreshFriends();
  return ok;
}

/** The signed-in user's id for building their own invite link, or `null`. */
export async function myUserId(): Promise<string | null> {
  return currentUserId();
}

/** Reset store state. Test seam only — not used by the app. */
export function __resetFriendsForTests(): void {
  friendsStore.set([]);
}
