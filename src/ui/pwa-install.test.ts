import { describe, it, expect } from 'vitest';
import { detectMobilePlatform, isStandalone, shouldShowInstallHint } from './pwa-install';

// A handful of real-world UA strings, trimmed to the parts detection keys off of.
const UA = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipadOld:
    'Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  desktopSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
};

describe('detectMobilePlatform', () => {
  it('detects Android', () => {
    expect(detectMobilePlatform(UA.androidChrome, 'Linux armv8l', 5)).toBe('android');
  });

  it('detects classic iOS (iPhone / old iPad)', () => {
    expect(detectMobilePlatform(UA.iphone, 'iPhone', 5)).toBe('ios');
    expect(detectMobilePlatform(UA.ipadOld, 'iPad', 5)).toBe('ios');
  });

  it('detects iPadOS 13+ masquerading as desktop Safari (MacIntel + touch)', () => {
    expect(detectMobilePlatform(UA.desktopSafari, 'MacIntel', 5)).toBe('ios');
  });

  it('treats a real Mac (MacIntel, no touch) as other', () => {
    expect(detectMobilePlatform(UA.desktopSafari, 'MacIntel', 0)).toBe('other');
  });

  it('treats desktop as other', () => {
    expect(detectMobilePlatform(UA.desktopChrome, 'Win32', 0)).toBe('other');
  });
});

describe('isStandalone', () => {
  const win = (matches: boolean): Window =>
    ({ matchMedia: (q: string) => ({ matches: q.includes('standalone') && matches }) }) as Window;

  it('is true when display-mode: standalone matches', () => {
    expect(isStandalone(win(true), {} as Navigator)).toBe(true);
  });

  it('is true for an iOS home-screen app (navigator.standalone)', () => {
    expect(isStandalone(win(false), { standalone: true } as unknown as Navigator)).toBe(true);
  });

  it('is false in a normal browser tab', () => {
    expect(isStandalone(win(false), { standalone: false } as unknown as Navigator)).toBe(false);
  });

  it('tolerates a missing matchMedia', () => {
    expect(isStandalone({} as Window, {} as Navigator)).toBe(false);
  });
});

describe('shouldShowInstallHint', () => {
  it('shows on a mobile OS that is not yet installed', () => {
    expect(shouldShowInstallHint('ios', false)).toBe(true);
    expect(shouldShowInstallHint('android', false)).toBe(true);
  });

  it('hides once installed / standalone', () => {
    expect(shouldShowInstallHint('ios', true)).toBe(false);
    expect(shouldShowInstallHint('android', true)).toBe(false);
  });

  it('hides on desktop / unknown platforms', () => {
    expect(shouldShowInstallHint('other', false)).toBe(false);
  });
});
