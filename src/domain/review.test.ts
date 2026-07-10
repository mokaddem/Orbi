import { describe, it, expect } from 'vitest';
import type { SRItem } from '../data/persistence/types';
import type { RegionResolver } from './stats';
import { MS_PER_DAY } from './sr';
import { reviewByRegion } from './review';

const NOW = 100 * MS_PER_DAY; // a round "today" well clear of the epoch

function sr(over: Partial<SRItem> & Pick<SRItem, 'itemKey'>): SRItem {
  return {
    repetitions: 1,
    easeFactor: 2.5,
    intervalDays: 1,
    dueAt: NOW,
    lapses: 0,
    ...over,
  };
}

// Geo stub: FR/DE/BG in Europe, JP/CN in Asia, US in Americas; XX unknown.
const REGIONS: Record<string, { region: string; subregion: string }> = {
  FR: { region: 'Europe', subregion: 'Western Europe' },
  DE: { region: 'Europe', subregion: 'Western Europe' },
  BG: { region: 'Europe', subregion: 'Eastern Europe' },
  JP: { region: 'Asia', subregion: 'Eastern Asia' },
  CN: { region: 'Asia', subregion: 'Eastern Asia' },
  US: { region: 'Americas', subregion: 'North & Central America' },
};
const regionOf: RegionResolver = (iso2) => REGIONS[iso2];

/** Convenience: a due item (dueAt in the past) with `lapses` misses. */
const due = (itemKey: string, lapses = 1): SRItem =>
  sr({ itemKey, dueAt: NOW - MS_PER_DAY, lapses });
/** Convenience: a not-yet-due item that has been missed before (trainable, not due). */
const missed = (itemKey: string, lapses = 1): SRItem =>
  sr({ itemKey, dueAt: NOW + 5 * MS_PER_DAY, lapses });

describe('reviewByRegion — grouping & selection', () => {
  it('returns nothing when there is no trainable state', () => {
    expect(reviewByRegion([], regionOf, { now: NOW })).toEqual([]);
    // A fresh (never-missed, not-due) item is not trainable.
    const fresh = sr({ itemKey: 'flag-to-country:FR', dueAt: NOW + MS_PER_DAY, lapses: 0 });
    expect(reviewByRegion([fresh], regionOf, { now: NOW })).toEqual([]);
  });

  it('groups trainable items by top-level region, skipping unknown codes', () => {
    const items = [
      due('flag-to-country:FR'),
      due('flag-to-country:JP'),
      due('flag-to-country:XX'), // unknown region → skipped
    ];
    const regions = reviewByRegion(items, regionOf, { now: NOW }).map((r) => r.region);
    expect(regions).toEqual(expect.arrayContaining(['Europe', 'Asia']));
    expect(regions).toHaveLength(2);
  });

  it('commits each region to its dominant mode and drills only that mode, weakest first', () => {
    const items = [
      due('flag-to-country:FR', 2),
      due('flag-to-country:DE', 1),
      due('map-highlight:BG', 5), // different mode, fewer → not dominant, excluded from pool
    ];
    const europe = reviewByRegion(items, regionOf, { now: NOW })[0];
    expect(europe.region).toBe('Europe');
    expect(europe.mode).toBe('flag-to-country');
    // Weakest first within the dominant mode: FR (2 lapses) before DE (1). BG is excluded.
    expect(europe.iso2s).toEqual(['FR', 'DE']);
    expect(europe.total).toBe(2);
  });

  it('caps each region pool at `limit`', () => {
    const items = [due('flag-to-country:FR', 3), due('flag-to-country:DE', 2)];
    const europe = reviewByRegion(items, regionOf, { now: NOW, limit: 1 })[0];
    expect(europe.iso2s).toEqual(['FR']);
    expect(europe.total).toBe(1);
  });

  it('a region-scoped pool contains only that region’s countries', () => {
    const items = [due('flag-to-country:FR'), due('flag-to-country:JP'), due('flag-to-country:US')];
    for (const review of reviewByRegion(items, regionOf, { now: NOW })) {
      for (const iso of review.iso2s) {
        expect(regionOf(iso)?.region).toBe(review.region);
      }
    }
  });
});

describe('reviewByRegion — due counts & ordering', () => {
  it('counts due vs total and orders regions most-due-first', () => {
    const items = [
      // Europe: 2 due
      due('flag-to-country:FR'),
      due('flag-to-country:DE'),
      // Asia: 1 due + 1 missed-not-due (both trainable)
      due('flag-to-country:JP'),
      missed('flag-to-country:CN', 3),
    ];
    const reviews = reviewByRegion(items, regionOf, { now: NOW });
    expect(reviews.map((r) => r.region)).toEqual(['Europe', 'Asia']);

    const [europe, asia] = reviews;
    expect(europe).toMatchObject({ due: 2, total: 2 });
    expect(asia).toMatchObject({ due: 1, total: 2 });
    // Europe first: it has more due items, even though both regions have 2 trainable.
  });

  it('breaks a due tie by pool size, then region name', () => {
    const items = [
      // Asia: 1 due, total 1
      due('flag-to-country:JP'),
      // Americas: 1 due, total 1 — same due & total as Asia → tie broken by name ("Americas" < "Asia")
      due('flag-to-country:US'),
      // Europe: 1 due, total 2 → larger pool ranks above the two 1-item ties
      due('flag-to-country:FR'),
      missed('flag-to-country:DE'),
    ];
    const regions = reviewByRegion(items, regionOf, { now: NOW }).map((r) => r.region);
    expect(regions).toEqual(['Europe', 'Americas', 'Asia']);
  });

  it('is deterministic given the same inputs and now', () => {
    const items = [due('flag-to-country:FR', 2), due('flag-to-country:JP')];
    const a = reviewByRegion(items, regionOf, { now: NOW });
    const b = reviewByRegion(items, regionOf, { now: NOW });
    expect(a).toEqual(b);
  });
});
