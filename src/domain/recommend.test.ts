import { describe, it, expect } from 'vitest';
import type { SRItem } from '../data/persistence/types';
import type { RegionResolver } from './stats';
import { MS_PER_DAY } from './sr';
import { recommend } from './recommend';

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

// Geo stub: BG/RO Eastern Europe, FR/DE Western Europe (both top-level Europe), JP Eastern Asia.
const REGIONS: Record<string, { region: string; subregion: string }> = {
  BG: { region: 'Europe', subregion: 'Eastern Europe' },
  RO: { region: 'Europe', subregion: 'Eastern Europe' },
  FR: { region: 'Europe', subregion: 'Western Europe' },
  DE: { region: 'Europe', subregion: 'Western Europe' },
  JP: { region: 'Asia', subregion: 'Eastern Asia' },
};
const regionOf: RegionResolver = (iso2) => REGIONS[iso2];

describe('recommend — always yields something (never empty)', () => {
  it('recommends fresh-start on a brand-new profile', () => {
    const recs = recommend([], [], { now: NOW, regionOf });
    expect(recs[0].kind).toBe('fresh-start');
    expect(recs[0].run).toBeUndefined();
  });
});

describe('recommend — region-scoped review', () => {
  it('leads with a region-scoped due review, dominant mode weakest-first', () => {
    const srItems = [
      sr({ itemKey: 'flag-to-country:BG', dueAt: NOW - MS_PER_DAY, lapses: 3 }),
      sr({ itemKey: 'flag-to-country:RO', dueAt: NOW - MS_PER_DAY, lapses: 1 }),
      sr({ itemKey: 'map-highlight:FR', dueAt: NOW - MS_PER_DAY, lapses: 1 }), // fewer → not dominant
    ];
    const top = recommend(srItems, [], { now: NOW, regionOf })[0];
    expect(top.kind).toBe('due');
    expect(top.regionKey).toBe('Europe');
    expect(top.mode).toBe('flag-to-country');
    expect(top.count).toBe(2);
    expect(top.run).toMatchObject({ type: 'training', mode: 'flag-to-country' });
    // Weakest first: BG (3 lapses) before RO (1 lapse); the map-highlight item is excluded.
    expect(top.run?.answerPoolIso).toEqual(['BG', 'RO']);
  });

  it('includes missed-but-not-yet-due items (weak-spot folded into region review)', () => {
    const srItems = [sr({ itemKey: 'flag-to-country:BG', dueAt: NOW + 5 * MS_PER_DAY, lapses: 4 })];
    const top = recommend(srItems, [], { now: NOW, regionOf })[0];
    expect(top.kind).toBe('due');
    expect(top.regionKey).toBe('Europe');
    expect(top.run?.answerPoolIso).toEqual(['BG']);
  });

  it('caps the drilled pool at dueLimit', () => {
    // 30 distinct due items, all in one region → capped at 20 (a session's review length).
    const allEurope: RegionResolver = () => ({ region: 'Europe', subregion: 'Western Europe' });
    const srItems = Array.from({ length: 30 }, (_, i) =>
      sr({ itemKey: `flag-to-country:C${i}`, dueAt: NOW - MS_PER_DAY, lapses: 1 }),
    );
    const top = recommend(srItems, [], { now: NOW, regionOf: allEurope, dueLimit: 20 })[0];
    expect(top.kind).toBe('due');
    expect(top.run?.answerPoolIso).toHaveLength(20);
  });

  it('picks the most-urgent region when several have trainable items', () => {
    const srItems = [
      // Europe: 2 due
      sr({ itemKey: 'flag-to-country:BG', dueAt: NOW - MS_PER_DAY, lapses: 1 }),
      sr({ itemKey: 'flag-to-country:RO', dueAt: NOW - MS_PER_DAY, lapses: 1 }),
      // Asia: 1 due
      sr({ itemKey: 'flag-to-country:JP', dueAt: NOW - MS_PER_DAY, lapses: 5 }),
    ];
    const top = recommend(srItems, [], { now: NOW, regionOf })[0];
    expect(top.kind).toBe('due');
    expect(top.regionKey).toBe('Europe'); // more due than Asia, despite Asia's higher lapses
  });
});

describe('recommend — priority ordering', () => {
  it('orders region-review → fresh-start when review applies', () => {
    const srItems = [sr({ itemKey: 'flag-to-country:JP', dueAt: NOW - MS_PER_DAY, lapses: 1 })];
    const kinds = recommend(srItems, [], { now: NOW, regionOf }).map((r) => r.kind);
    expect(kinds).toEqual(['due', 'fresh-start']);
  });

  it('is just fresh-start when nothing is trainable', () => {
    const srItems = [sr({ itemKey: 'flag-to-country:BG', dueAt: NOW + MS_PER_DAY, lapses: 0 })];
    const kinds = recommend(srItems, [], { now: NOW, regionOf }).map((r) => r.kind);
    expect(kinds).toEqual(['fresh-start']);
  });

  it('is deterministic given the same inputs and now', () => {
    const srItems = [sr({ itemKey: 'flag-to-country:BG', dueAt: NOW - MS_PER_DAY, lapses: 2 })];
    const a = recommend(srItems, [], { now: NOW, regionOf });
    const b = recommend(srItems, [], { now: NOW, regionOf });
    expect(a).toEqual(b);
  });
});
