import { describe, it, expect } from 'vitest';
import { buildDailyChallenge, dailySeed, DAILY_LENGTH } from './daily';

describe('dailySeed', () => {
  it('is stable across calls for the same day', () => {
    expect(dailySeed('2026-07-08')).toBe(dailySeed('2026-07-08'));
  });

  it('produces a 32-bit unsigned integer', () => {
    const s = dailySeed('2026-07-08');
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
  });

  it('differs across consecutive days', () => {
    const days = ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10'];
    const seeds = new Set(days.map(dailySeed));
    expect(seeds.size).toBe(days.length);
  });
});

describe('buildDailyChallenge', () => {
  it('is reproducible for a given day (same mode, theme, seed, length)', () => {
    expect(buildDailyChallenge('2026-07-08')).toEqual(buildDailyChallenge('2026-07-08'));
  });

  it('carries the day-key and the fixed length', () => {
    const c = buildDailyChallenge('2026-07-08');
    expect(c.dateKey).toBe('2026-07-08');
    expect(c.length).toBe(DAILY_LENGTH);
    expect(c.seed).toBe(dailySeed('2026-07-08'));
  });

  it('always picks one of the four modes', () => {
    const modes = new Set(['flag-to-country', 'country-to-flag', 'map-highlight', 'map-locate']);
    for (let d = 1; d <= 28; d += 1) {
      const key = `2026-02-${String(d).padStart(2, '0')}`;
      expect(modes.has(buildDailyChallenge(key).mode)).toBe(true);
    }
  });

  it('only ever themes on a real M49 region (or the whole world)', () => {
    const regions = new Set(['Africa', 'Americas', 'Asia', 'Europe', 'Oceania']);
    for (let d = 1; d <= 28; d += 1) {
      const key = `2026-02-${String(d).padStart(2, '0')}`;
      const filter = buildDailyChallenge(key).filter;
      if (filter?.region) expect(regions.has(filter.region)).toBe(true);
      // A theme never narrows to a sub-region — daily is region-wide (or worldwide).
      expect(filter?.subregion).toBeUndefined();
    }
  });

  it('rotates the theme across days (not always the same)', () => {
    const themes = new Set(
      Array.from({ length: 30 }, (_, i) => {
        const key = `2026-03-${String(i + 1).padStart(2, '0')}`;
        return buildDailyChallenge(key).filter?.region ?? 'World';
      }),
    );
    expect(themes.size).toBeGreaterThan(1);
  });
});
