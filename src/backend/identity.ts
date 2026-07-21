// Backend identity operations (Phase 51) — thin, never-throwing wrappers over the
// PocketBase `users` auth collection, built on the Foundation seam.
//
// This module talks to PocketBase but is NOT the SDK importer: it uses the shared
// client from `client.ts` (the sole place the SDK is constructed) and only imports
// SDK *types* (erased at build time). It is pure backend I/O — no Svelte stores, no
// local persistence. The orchestration that ties this to the device id, the display
// name, and the reactive UI lives one layer up in `ui/stores/identity.ts`.
//
// Every function is best-effort: it resolves to a result or `null`/`false` on any
// failure (no backend configured, offline, validation error, …) and NEVER throws.
// This is what lets identity stay entirely local when the backend is absent.
//
// Design facts (verified against a real PocketBase during Phase 51):
//   • Anonymous tier = a normal auth record with a generated `⟨deviceId⟩@anon.invalid`
//     email + a random password kept only on the device. The default `users` collection
//     permits public `create`, so the client self-registers.
//   • Upgrade = REGISTER A NEW real (email+password) record — NOT an email change on the
//     anon record, because PocketBase blocks direct email changes without the
//     confirm-email-change flow (which needs SMTP; unconfigured this phase).
//   • All owner-scoped reads/writes rely on the collection's default owner-only API rules.

import type { RecordModel } from 'pocketbase';

/** The app's view of a `users` profile record (only the fields we set/read). */
export interface ProfileRecord {
  id: string;
  displayName: string;
  deviceId: string;
  isAnonymous: boolean;
  /** The owner sees their own email in the auth response; hidden ('') for anon/synthetic. */
  email: string;
}

/** Email verification/reset needs SMTP (unconfigured this phase), so anon accounts use this domain. */
const ANON_EMAIL_DOMAIN = 'anon.invalid';

/** Derive the synthetic, non-deliverable email for a device's anonymous account. */
export function anonEmail(deviceId: string): string {
  return `${deviceId}@${ANON_EMAIL_DOMAIN}`;
}

function toProfile(record: RecordModel): ProfileRecord {
  const email = typeof record.email === 'string' ? record.email : '';
  return {
    id: record.id,
    displayName: typeof record.displayName === 'string' ? record.displayName : '',
    deviceId: typeof record.deviceId === 'string' ? record.deviceId : '',
    isAnonymous: record.isAnonymous === true,
    // Hide the synthetic anon address from the UI (it's not a real, user-facing email).
    email: email.endsWith(`@${ANON_EMAIL_DOMAIN}`) ? '' : email,
  };
}

// Lazily reach the shared client without importing the SDK at runtime here. Kept as a
// function so tests can mock `./client`.
import { getClient } from './client';

/**
 * Create the anonymous account for a device (Tier 1) and sign in as it. Idempotent-ish:
 * if the account already exists, creation fails and we fall back to signing in with the
 * stored secret. Returns the profile, or `null` if unreachable/failed.
 */
export async function ensureAnonymous(
  deviceId: string,
  secret: string,
  displayName: string,
): Promise<ProfileRecord | null> {
  const pb = await getClient();
  if (!pb) return null;
  const email = anonEmail(deviceId);
  try {
    await pb.collection('users').create({
      email,
      password: secret,
      passwordConfirm: secret,
      displayName,
      deviceId,
      isAnonymous: true,
    });
  } catch {
    // Already exists (or a transient error) — fall through to sign-in with the secret.
  }
  return signIn(email, secret);
}

/** Sign in with an identity (email) + password. Returns the profile, or `null` on failure. */
export async function signIn(email: string, password: string): Promise<ProfileRecord | null> {
  const pb = await getClient();
  if (!pb) return null;
  try {
    const res = await pb.collection('users').authWithPassword(email, password);
    return toProfile(res.record);
  } catch {
    return null;
  }
}

/**
 * Register a NEW real account (the upgrade path) and sign in as it. Carries the current
 * display name + device id onto the new record. Returns the profile, or `null` on failure
 * (e.g. the email is already taken). Does not touch the anonymous account.
 */
export async function registerAccount(
  email: string,
  password: string,
  displayName: string,
  deviceId: string,
): Promise<ProfileRecord | null> {
  const pb = await getClient();
  if (!pb) return null;
  try {
    await pb.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      displayName,
      deviceId,
      isAnonymous: false,
    });
  } catch {
    return null; // email taken, weak password, offline, …
  }
  return signIn(email, password);
}

/** Update the signed-in record's display name (owner-only). Returns success. Never throws. */
export async function updateDisplayName(id: string, displayName: string): Promise<boolean> {
  const pb = await getClient();
  if (!pb) return false;
  try {
    await pb.collection('users').update(id, { displayName });
    return true;
  } catch {
    return false;
  }
}

/** Delete the signed-in record (owner-only) and clear the auth token. Returns success. */
export async function deleteSelf(id: string): Promise<boolean> {
  const pb = await getClient();
  if (!pb) return false;
  try {
    await pb.collection('users').delete(id);
    pb.authStore.clear();
    return true;
  } catch {
    return false;
  }
}

/** Clear the cached auth token (sign out). Never throws. */
export async function signOut(): Promise<void> {
  const pb = await getClient();
  pb?.authStore.clear();
}

/** The currently signed-in profile from the cached auth token, or `null`. Never throws. */
export async function currentProfile(): Promise<ProfileRecord | null> {
  const pb = await getClient();
  if (!pb || !pb.authStore.isValid || !pb.authStore.record) return null;
  try {
    return toProfile(pb.authStore.record);
  } catch {
    return null;
  }
}
