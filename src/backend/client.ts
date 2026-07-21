// The single seam between the app and the backend (Phase 50 — Foundation).
//
// This is the ONLY module in the app that imports the PocketBase SDK. Everything
// downstream depends on *this* module, never the SDK directly — mirroring how
// `stores/persistence.ts` is the sole owner of IndexedDB. Keeping the seam thin
// and swappable means a future backend change (a Bun WebSocket companion for the
// live-rooms slice, or a move off PocketBase entirely) stays contained here.
//
// Offline-first contract (non-negotiable — see the phase PRD):
//   • The SDK is lazy-loaded via a dynamic import, and only when a backend URL is
//     configured, so the offline core bundle carries ~zero backend weight.
//   • Nothing here ever throws into the UI or blocks startup. Every call resolves
//     to a value (or null); failures are swallowed and surface as "unreachable".
//
// Foundation exposes only what it needs: URL resolution, a lazily created client,
// a health probe, and a read of the seeded `ping` record. Real features (auth,
// friends, scores, duels) build on this seam in Phases 51+.

// Type-only import: erased at build time, so it does NOT pull the SDK into any
// chunk. The sole *runtime* import is the dynamic `import('pocketbase')` below.
import type PocketBase from 'pocketbase';

/** Localhost default used in dev so `./server/run.sh` "just works" with no config. */
const DEV_DEFAULT_URL = 'http://localhost:8090';

/**
 * Pure URL-resolution logic (exported for exhaustive, env-free testing).
 *
 * Precedence:
 *   1. `configured` (VITE_PB_URL) if a non-blank value — baked in at build time.
 *   2. In dev only, a localhost default.
 *   3. Otherwise `null` → the backend is disabled (the offline-optional default:
 *      a production build with VITE_PB_URL unset behaves exactly as today).
 */
export function resolveBackendUrl(configured: string | undefined, dev: boolean): string | null {
  const trimmed = configured?.trim();
  if (trimmed) return trimmed;
  if (dev) return DEV_DEFAULT_URL;
  return null;
}

/** Resolve the backend base URL from build-time config, or `null` when disabled. */
export function backendUrl(): string | null {
  return resolveBackendUrl(import.meta.env.VITE_PB_URL, import.meta.env.DEV);
}

/** True when a backend URL is configured (see {@link backendUrl}). */
export function isBackendConfigured(): boolean {
  return backendUrl() !== null;
}

// Cache the promise so the SDK is imported and the client constructed at most
// once for the app's lifetime.
let clientPromise: Promise<PocketBase | null> | null = null;

/**
 * Lazily import the SDK and construct a single PocketBase client, or resolve
 * `null` when no backend is configured (or the chunk can't load offline). The
 * dynamic import is what keeps the SDK out of the offline core chunk.
 */
export function getClient(): Promise<PocketBase | null> {
  if (clientPromise) return clientPromise;
  const url = backendUrl();
  if (!url) return Promise.resolve(null);
  clientPromise = import('pocketbase').then(({ default: PB }) => new PB(url)).catch(() => null); // e.g. chunk fetch fails offline — behave as "no client"
  return clientPromise;
}

/**
 * Probe the backend's health endpoint. Resolves `true` if reachable, `false`
 * otherwise (no URL, network error, non-OK response). NEVER throws.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const pb = await getClient();
    if (!pb) return false;
    await pb.health.check();
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the seeded `ping` record over the auto-REST API — the "real record
 * round-trip" proof (plain reachability is {@link checkHealth}). Returns the
 * message string, or `null` on any failure. NEVER throws.
 */
export async function readPing(): Promise<string | null> {
  try {
    const pb = await getClient();
    if (!pb) return null;
    const record = await pb.collection('ping').getFirstListItem('');
    return typeof record.message === 'string' ? record.message : null;
  } catch {
    return null;
  }
}

/** Reset the cached client. Test seam only — not used by the app. */
export function __resetClientForTests(): void {
  clientPromise = null;
}
