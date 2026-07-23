// Manual "Check for updates" support for Settings → About.
//
// The app ships with `registerType: 'autoUpdate'` (see vite.config.ts): a new deploy's
// service worker installs, activates (skipWaiting) and reloads the page on its own. The
// only thing users can't do is *trigger* that check on demand — an installed PWA otherwise
// waits for a cold navigation or the browser's lazy ~daily poll (which is exactly why some
// users had to force-quit and reopen to pick up a release). This module exposes a one-shot
// check they can tap, using the standard SW API only (no `virtual:pwa-register` import) so
// the jsdom test suite stays free of service-worker mocking machinery.

export type UpdateStatus =
  /** A newer service worker was found and is installing; autoUpdate will reload shortly. */
  | 'updating'
  /** Checked successfully; the installed version is already the latest. */
  | 'uptodate'
  /** No service worker controls this page (dev server, unsupported browser). */
  | 'unavailable'
  /** The update check threw — typically offline or a network error reaching the server. */
  | 'error';

/**
 * Ask the browser to check for a new service worker right now.
 *
 * Uses `getRegistration()` rather than `navigator.serviceWorker.ready` on purpose: `ready`
 * never resolves when no worker is registered (e.g. the dev server, where the SW is
 * disabled), which would hang the UI in a "checking…" state forever. `getRegistration()`
 * resolves to `undefined` there instead, so we can report `'unavailable'` cleanly.
 */
export async function checkForAppUpdate(): Promise<UpdateStatus> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return 'unavailable';
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) return 'unavailable';
    await registration.update();
    // A byte-different worker shows up as `installing` (or, briefly, `waiting`). With
    // autoUpdate's skipWaiting it will activate and reload the page on its own, so all we
    // do here is surface that a refresh is on the way.
    return registration.installing || registration.waiting ? 'updating' : 'uptodate';
  } catch {
    return 'error';
  }
}

/** UI state for the "Check for updates" control: the idle/checking pending states plus the
 *  terminal {@link UpdateStatus} the check resolves to. */
export type UpdateUiState = 'idle' | 'checking' | UpdateStatus;

/**
 * The i18n key for the status line under the update button, or `null` when nothing should be
 * shown (idle, before the user has checked).
 *
 * `'unavailable'` maps to the same "up to date" message as `'uptodate'`: to the user there is
 * nothing pending either way, and a bare "Checking…→(blank)" reads as broken. (`'unavailable'`
 * is essentially a dev-server artefact — the service worker is disabled there, so there is no
 * registration to check.)
 */
export function updateStatusKey(state: UpdateUiState): string | null {
  switch (state) {
    case 'checking':
      return 'settings.update.checking';
    case 'updating':
      return 'settings.update.updating';
    case 'error':
      return 'settings.update.error';
    case 'uptodate':
    case 'unavailable':
      return 'settings.update.upToDate';
    case 'idle':
      return null;
  }
}

/** Visual tone for the outcome badge that briefly replaces the check button. */
export type UpdateBadgeTone = 'pending' | 'success' | 'info' | 'error';

/**
 * Maps an update state to the badge tone used for its colour (see the `[data-tone]` rules in
 * Settings.svelte). `'unavailable'` shares the `'success'` tone with `'uptodate'` for the same
 * reason it shares their message: to the user there is nothing pending.
 */
export function updateBadgeTone(state: UpdateUiState): UpdateBadgeTone {
  switch (state) {
    case 'updating':
      return 'info';
    case 'error':
      return 'error';
    case 'uptodate':
    case 'unavailable':
      return 'success';
    case 'checking':
    case 'idle':
      return 'pending';
  }
}
