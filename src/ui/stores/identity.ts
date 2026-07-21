// Identity orchestration (Phase 51) — the reactive player-identity store the UI reads,
// and the actions Settings calls. It composes three lower layers:
//   • the backend identity ops (`src/backend/identity.ts`) — best-effort PocketBase I/O,
//   • local persistence (`persistence.ts`) — the durable `deviceId` + anon secret,
//   • the `playerName` pref — the display name (already user-editable since Phase 46).
//
// Progressive identity, three tiers over ONE local device identity:
//   Tier 1 anonymous  → a generated `deviceId` (+ a synthetic backend account when reachable)
//   Tier 2 named      → the player set a display name (cosmetic; still "anonymous" server-side)
//   Tier 3 account    → upgraded to a real email+password login (cross-device, verified spot)
//
// Contract (inherited from Foundation): identity works fully OFFLINE and with no backend —
// `deviceId` + `playerName` in IndexedDB are the source of truth and local always wins.
// Server mirroring is background, best-effort, and never blocks or throws into the UI.

import { get, writable, type Readable } from 'svelte/store';
import { PLAYER_NAME_MAX_LENGTH, type IdentityRecord } from '../../data';
import { isBackendConfigured } from '../../backend/client';
import {
  currentProfile,
  deleteSelf,
  ensureAnonymous,
  registerAccount,
  signIn as backendSignIn,
  signOut as backendSignOut,
  updateDisplayName,
  type ProfileRecord,
} from '../../backend/identity';
import { prefs, updatePrefs, getStoredIdentity, saveStoredIdentity } from './persistence';
import { syncBoard } from './board';

/** Server-side tier of the active identity (Tier 2 "named" is anonymous + a name). */
export type IdentityTier = 'anonymous' | 'account';
/** Best-effort server-mirror state (never gates the UI; purely informational). */
export type IdentitySync = 'local' | 'syncing' | 'synced' | 'error';

export interface IdentityState {
  /** Stable per-device id; `null` only before {@link initIdentity} runs. */
  deviceId: string | null;
  /** Display name (mirrors the `playerName` pref); may be empty until the player sets one. */
  displayName: string;
  tier: IdentityTier;
  /** Real email once upgraded/signed-in to an account; `null` otherwise. */
  email: string | null;
  sync: IdentitySync;
}

const initialState: IdentityState = {
  deviceId: null,
  displayName: '',
  tier: 'anonymous',
  email: null,
  sync: 'local',
};

const store = writable<IdentityState>({ ...initialState });
/** Read-only reactive identity for the UI. */
export const identity: Readable<IdentityState> = { subscribe: store.subscribe };

// The id of the currently signed-in server record, tracked for owner-scoped writes
// (rename/delete). Null when not authed (offline, no backend, or signed out).
let currentId: string | null = null;

function patch(next: Partial<IdentityState>): void {
  store.update((s) => ({ ...s, ...next }));
}

function newDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `dev_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/** A strong, throwaway password for the anonymous account — kept only on this device. */
function newSecret(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random()
    .toString(36)
    .slice(2)}`;
}

function currentDisplayName(): string {
  return get(prefs).playerName ?? '';
}

/** Adopt a signed-in/created server profile as the active identity (keeps local progress). */
function adopt(profile: ProfileRecord): void {
  currentId = profile.id;
  // Per OQ7: signing in replaces the *identity*, but local progress (IndexedDB) is untouched.
  // Reflect the server display name locally so the name follows the account across devices.
  if (profile.displayName && profile.displayName !== currentDisplayName()) {
    updatePrefs({ playerName: profile.displayName.slice(0, PLAYER_NAME_MAX_LENGTH) });
  }
  patch({
    tier: profile.isAnonymous ? 'anonymous' : 'account',
    displayName: profile.displayName || currentDisplayName(),
    email: profile.email || null,
    sync: 'synced',
  });
  // Now that we hold a signed-in record, mirror the local headline stats (Phase 52). This is
  // the startup/sign-in/upgrade/re-anon trigger — best-effort, non-blocking, never throws.
  void syncBoard();
}

/**
 * Initialise identity: ensure a durable local `deviceId` (generating + persisting one on
 * first run), seed the display name from the `playerName` pref, then kick off a background,
 * best-effort server mirror. Call once at startup AFTER `initPersistence`. Never throws.
 */
export async function initIdentity(): Promise<void> {
  let record = await getStoredIdentity();
  if (!record?.deviceId) {
    record = { deviceId: newDeviceId() };
    await saveStoredIdentity(record);
  }
  patch({ deviceId: record.deviceId, displayName: currentDisplayName(), tier: 'anonymous' });

  // Fire-and-forget: the UI reacts to the store; it never waits on the network.
  void ensureServerIdentity();
}

/**
 * Best-effort background sync: if a valid token is already cached, adopt it; otherwise
 * ensure (create+sign-in) the anonymous account. No-op (stays `local`) with no backend.
 * Never throws.
 */
export async function ensureServerIdentity(): Promise<void> {
  if (!isBackendConfigured()) {
    patch({ sync: 'local' });
    return;
  }
  patch({ sync: 'syncing' });

  // Already authed from a previous session (real account or anon)? Adopt it.
  const existing = await currentProfile();
  if (existing) {
    adopt(existing);
    return;
  }

  // Otherwise ensure the anonymous account, minting + persisting a secret on first use.
  const stored = (await getStoredIdentity()) ?? { deviceId: get(store).deviceId ?? newDeviceId() };
  let secret = stored.anonSecret;
  if (!secret) {
    secret = newSecret();
    await saveStoredIdentity({ ...stored, anonSecret: secret });
  }
  const profile = await ensureAnonymous(stored.deviceId, secret, currentDisplayName());
  if (profile) adopt(profile);
  else patch({ sync: 'error' });
}

/**
 * Rename the player. Updates the local `playerName` pref immediately (offline-safe) and,
 * if signed in, best-effort syncs it to the server. Never throws.
 */
export async function renameTo(name: string): Promise<void> {
  const clean = name.trim().slice(0, PLAYER_NAME_MAX_LENGTH);
  updatePrefs({ playerName: clean });
  patch({ displayName: clean });
  if (currentId) void updateDisplayName(currentId, clean);
  // Keep the board's denormalized display name in step (Phase 52). Best-effort; no-op offline.
  void syncBoard();
}

export interface AccountActionResult {
  ok: boolean;
  /** A stable reason code for the UI to localise (not a user-facing string). */
  error?: 'no-backend' | 'failed';
}

/**
 * Upgrade the anonymous identity to a real account (Tier 3) by REGISTERING a new
 * email+password record (see the note in `backend/identity.ts` on why upgrade creates
 * rather than mutates). Local progress is untouched. Returns a result for UI feedback.
 */
export async function upgrade(email: string, password: string): Promise<AccountActionResult> {
  if (!isBackendConfigured()) return { ok: false, error: 'no-backend' };
  const deviceId = get(store).deviceId ?? newDeviceId();
  const profile = await registerAccount(email.trim(), password, currentDisplayName(), deviceId);
  if (!profile) return { ok: false, error: 'failed' };
  adopt(profile);
  return { ok: true };
}

/**
 * Sign in to an existing account (e.g. reclaiming an identity on another device). On
 * success, replaces the active identity but keeps local progress (OQ7). Returns a result.
 */
export async function signIn(email: string, password: string): Promise<AccountActionResult> {
  if (!isBackendConfigured()) return { ok: false, error: 'no-backend' };
  const profile = await backendSignIn(email.trim(), password);
  if (!profile) return { ok: false, error: 'failed' };
  adopt(profile);
  return { ok: true };
}

/** Sign out of the account and revert to the device's anonymous identity. Never throws. */
export async function signOut(): Promise<void> {
  await backendSignOut();
  currentId = null;
  patch({ tier: 'anonymous', email: null });
  void ensureServerIdentity();
}

/**
 * Delete the signed-in server account (owner-only) and revert to a fresh anonymous
 * identity. Local gameplay progress is NOT touched — only the server record + the account
 * tier are removed. Returns a result. Never throws.
 */
export async function deleteAccount(): Promise<AccountActionResult> {
  if (!isBackendConfigured()) return { ok: false, error: 'no-backend' };
  if (!currentId) return { ok: false, error: 'failed' };
  const ok = await deleteSelf(currentId);
  if (!ok) return { ok: false, error: 'failed' };
  currentId = null;
  patch({ tier: 'anonymous', email: null });
  void ensureServerIdentity();
  return { ok: true };
}

/** Reset store + module state. Test seam only — not used by the app. */
export function __resetIdentityForTests(): void {
  currentId = null;
  store.set({ ...initialState });
}

export type { IdentityRecord };
