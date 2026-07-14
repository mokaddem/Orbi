// "Add to Home Screen" install hint (mobile only).
//
// Orbi is an installable, offline-first PWA, but on a phone the install affordance is buried
// in the browser chrome and differs per platform (iOS Safari hides it behind the Share sheet;
// Android/Chromium exposes a menu item *and* fires `beforeinstallprompt`). This module holds
// the small, framework-agnostic pieces the mobile install prompt needs: pure platform
// detection (unit-tested), a "already installed?" check, and a store that captures Chromium's
// deferred install event so the prompt can offer a genuine one-tap install where the browser
// supports it. All of it is a no-op / harmless on desktop and under jsdom.

import { writable, type Writable } from 'svelte/store';

/** The mobile OS we tailor install instructions to. `other` = desktop / unknown → no hint. */
export type MobilePlatform = 'ios' | 'android' | 'other';

/**
 * Chromium's non-standard install event (not in the DOM lib types). We `preventDefault()` it
 * to stop the browser's own mini-infobar and stash it, so our button can call `prompt()` on a
 * user gesture instead.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

/**
 * Classify the mobile platform from userAgent-ish inputs (pure, so it's unit-testable). Returns
 * `other` for desktop and anything we don't tailor steps for — the prompt then stays hidden,
 * honouring the "mobile only" requirement.
 */
export function detectMobilePlatform(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
): MobilePlatform {
  const ua = userAgent.toLowerCase();
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  // iPadOS 13+ reports a desktop-Safari UA on "MacIntel"; the touch points give it away.
  if (platform === 'MacIntel' && maxTouchPoints > 1) return 'ios';
  return 'other';
}

/**
 * True when the app is already running as an installed / standalone PWA — in which case there is
 * nothing to install and the prompt must stay hidden. Covers the standard `display-mode`
 * media query and iOS Safari's legacy `navigator.standalone` flag.
 */
export function isStandalone(win: Window, nav: Navigator): boolean {
  const mql =
    typeof win.matchMedia === 'function' ? win.matchMedia('(display-mode: standalone)') : null;
  if (mql?.matches) return true;
  // iOS home-screen apps: non-standard boolean on navigator.
  return (nav as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Whether to show the install hint at all: a real mobile OS, and not already installed. The
 * per-platform copy is chosen separately from `detectMobilePlatform`.
 */
export function shouldShowInstallHint(platform: MobilePlatform, standalone: boolean): boolean {
  return !standalone && (platform === 'ios' || platform === 'android');
}

/**
 * The deferred Chromium install event, or `null` until one fires. Populated by
 * `initInstallPrompt()` (called once from `main.ts`, early enough to catch the event before the
 * UI mounts). `null` on iOS/Firefox/desktop-Safari, where the prompt falls back to manual steps.
 */
export const installPromptEvent: Writable<BeforeInstallPromptEvent | null> = writable(null);

/** Set once the app has been installed, so any open prompt can dismiss itself. */
export const appInstalled: Writable<boolean> = writable(false);

let initialized = false;

/**
 * Start listening for the browser's install signals. Idempotent and SSR/jsdom-safe. Listeners
 * live for the page's lifetime (no teardown needed — like the SW-update hook in `main.ts`).
 */
export function initInstallPrompt(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    // Keep the browser's default mini-infobar from showing; we surface our own prompt instead.
    e.preventDefault();
    installPromptEvent.set(e as BeforeInstallPromptEvent);
  });

  window.addEventListener('appinstalled', () => {
    installPromptEvent.set(null);
    appInstalled.set(true);
  });
}
