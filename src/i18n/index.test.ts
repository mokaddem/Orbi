import { describe, it, expect, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';

// `src/i18n/index.ts` reads localStorage at module load (detectInitialLocale) and writes
// on every locale change (the subscribe). A private-mode / policy-blocked browser exposes
// the `localStorage` global but *throws* on access — so these paths must be crash-proof,
// not merely guarded against the global being absent. Each case re-imports the module fresh
// with a different localStorage stub in place.

describe('i18n locale persistence resilience', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('loads and switches locale without throwing when localStorage throws on every access', async () => {
    const blocked = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    vi.resetModules();

    // Importing must not throw even though detectInitialLocale() touches the throwing store,
    // and the immediate subscribe fires persistLocale() (setItem) on the initial value.
    const mod = await import('./index');
    expect(['en', 'fr']).toContain(get(mod.locale));

    // Changing language persists best-effort: the throwing setItem must not surface.
    expect(() => mod.setLocale('fr')).not.toThrow();
    expect(get(mod.locale)).toBe('fr');
  });

  it('restores a previously saved locale when localStorage works', async () => {
    const store = new Map<string, string>([['geo-quiz:locale', 'fr']]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    vi.resetModules();

    const { locale } = await import('./index');
    expect(get(locale)).toBe('fr');
  });

  it('persists a locale change back to a working localStorage', async () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    vi.resetModules();

    const { locale, setLocale } = await import('./index');
    setLocale(get(locale) === 'en' ? 'fr' : 'en');
    expect(store.get('geo-quiz:locale')).toBe(get(locale));
  });
});
