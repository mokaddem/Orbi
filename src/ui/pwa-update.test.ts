import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkForAppUpdate, updateStatusKey, updateBadgeTone } from './pwa-update';

// Swap the real `navigator.serviceWorker` for a controllable fake for the duration of a test.
// Returns a restore fn so each case leaves the global untouched for the next.
function stubServiceWorker(value: unknown): () => void {
  const had = 'serviceWorker' in navigator;
  const original = (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
  Object.defineProperty(navigator, 'serviceWorker', { value, configurable: true });
  return () => {
    if (had) {
      Object.defineProperty(navigator, 'serviceWorker', { value: original, configurable: true });
    } else {
      delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
    }
  };
}

describe('checkForAppUpdate', () => {
  let restore: () => void = () => {};
  afterEach(() => restore());

  it('reports "uptodate" when update() finds no new worker', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    restore = stubServiceWorker({
      getRegistration: () => Promise.resolve({ update, installing: null, waiting: null }),
    });
    await expect(checkForAppUpdate()).resolves.toBe('uptodate');
    expect(update).toHaveBeenCalledOnce();
  });

  it('reports "updating" when a new worker is installing', async () => {
    restore = stubServiceWorker({
      getRegistration: () =>
        Promise.resolve({
          update: vi.fn().mockResolvedValue(undefined),
          installing: {},
          waiting: null,
        }),
    });
    await expect(checkForAppUpdate()).resolves.toBe('updating');
  });

  it('reports "updating" when a new worker is waiting', async () => {
    restore = stubServiceWorker({
      getRegistration: () =>
        Promise.resolve({
          update: vi.fn().mockResolvedValue(undefined),
          installing: null,
          waiting: {},
        }),
    });
    await expect(checkForAppUpdate()).resolves.toBe('updating');
  });

  it('reports "unavailable" when no registration controls the page (e.g. dev server)', async () => {
    restore = stubServiceWorker({ getRegistration: () => Promise.resolve(undefined) });
    await expect(checkForAppUpdate()).resolves.toBe('unavailable');
  });

  it('reports "unavailable" when service workers are unsupported', async () => {
    restore = stubServiceWorker(undefined);
    // `'serviceWorker' in navigator` is still true with an `undefined` value, so also cover the
    // truly-absent case by deleting the property.
    delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;
    await expect(checkForAppUpdate()).resolves.toBe('unavailable');
  });

  it('reports "error" when the update check throws (e.g. offline)', async () => {
    restore = stubServiceWorker({
      getRegistration: () =>
        Promise.resolve({ update: vi.fn().mockRejectedValue(new Error('offline')) }),
    });
    await expect(checkForAppUpdate()).resolves.toBe('error');
  });
});

describe('updateStatusKey', () => {
  it('shows no status while idle (before the user checks)', () => {
    expect(updateStatusKey('idle')).toBeNull();
  });

  it('maps the pending and terminal states to their message keys', () => {
    expect(updateStatusKey('checking')).toBe('settings.update.checking');
    expect(updateStatusKey('updating')).toBe('settings.update.updating');
    expect(updateStatusKey('error')).toBe('settings.update.error');
    expect(updateStatusKey('uptodate')).toBe('settings.update.upToDate');
  });

  it('treats "unavailable" as up to date, so a check always ends with visible feedback', () => {
    // Regression: on the dev server the SW is disabled → checkForAppUpdate() resolves
    // 'unavailable', which previously rendered a blank status ("Checking…→nothing").
    expect(updateStatusKey('unavailable')).toBe('settings.update.upToDate');
  });
});

describe('updateBadgeTone', () => {
  it('colours each outcome by its meaning', () => {
    expect(updateBadgeTone('checking')).toBe('pending');
    expect(updateBadgeTone('updating')).toBe('info');
    expect(updateBadgeTone('error')).toBe('error');
    expect(updateBadgeTone('uptodate')).toBe('success');
  });

  it('gives "unavailable" the same success tone as up to date', () => {
    expect(updateBadgeTone('unavailable')).toBe('success');
  });
});
