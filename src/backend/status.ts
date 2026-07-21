// Backend connectivity store (Phase 50 — Foundation).
//
// A tiny Svelte store the UI can read to know whether the optional backend is
// reachable. It is driven by a lightweight, background health probe and obeys
// the offline-first contract: it NEVER blocks app startup and NEVER throws into
// the UI. When no backend URL is configured it simply reports `disabled-no-url`
// and makes no network calls at all.
//
// Foundation surfaces this as a single unobtrusive line in Settings → About
// (next to the app version) — proof the pipe works, not a user-facing feature.

import { writable, type Readable } from 'svelte/store';
import { checkHealth, isBackendConfigured } from './client';

export type BackendStatus =
  | 'disabled-no-url' // no VITE_PB_URL configured (and not dev) — backend is off
  | 'unknown' // configured, not yet probed
  | 'reachable' // last probe succeeded
  | 'unreachable'; // last probe failed (down, network error, CORS, …)

const initial: BackendStatus = isBackendConfigured() ? 'unknown' : 'disabled-no-url';
const store = writable<BackendStatus>(initial);

/** Read-only view of the current backend status, for the UI to subscribe to. */
export const backendStatus: Readable<BackendStatus> = { subscribe: store.subscribe };

// Dedupe concurrent probes: callers share the in-flight promise.
let inFlight: Promise<BackendStatus> | null = null;

/**
 * Run a single background health probe and update the store. Non-blocking and
 * never throws. A no-op network-wise when the backend is disabled. Returns the
 * resulting status (handy for callers/tests that await it).
 */
export function probeBackend(): Promise<BackendStatus> {
  if (!isBackendConfigured()) {
    store.set('disabled-no-url');
    return Promise.resolve('disabled-no-url');
  }
  if (inFlight) return inFlight;
  inFlight = checkHealth()
    .then((ok): BackendStatus => (ok ? 'reachable' : 'unreachable'))
    .catch((): BackendStatus => 'unreachable') // defensive — checkHealth already swallows
    .then((next) => {
      store.set(next);
      return next;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Kick off the initial background probe. Call once, fire-and-forget, from app
 * startup (App.svelte `onMount`). Deliberately returns nothing — the UI reacts
 * to the store; it never waits on this.
 */
export function startBackendProbe(): void {
  void probeBackend();
}

/** Reset store + in-flight state. Test seam only — not used by the app. */
export function __resetStatusForTests(): void {
  inFlight = null;
  store.set(isBackendConfigured() ? 'unknown' : 'disabled-no-url');
}
