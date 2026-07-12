import { describe, it, expect } from 'vitest';
import type { SRItem } from '../data/persistence/types';
import { MS_PER_DAY } from './sr';
import {
  GRADUATE_AFTER,
  dominantTrainingMode,
  parseItemKey,
  selectTrainingItems,
} from './training';

const NOW = 10 * MS_PER_DAY; // a round "today" well clear of the epoch

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

describe('parseItemKey', () => {
  it('splits a well-formed key', () => {
    expect(parseItemKey('flag-to-country:BG')).toEqual({ mode: 'flag-to-country', iso2: 'BG' });
    expect(parseItemKey('map-locate:FR')).toEqual({ mode: 'map-locate', iso2: 'FR' });
  });

  it('accepts the capital modes so they are trainable (Phase 24)', () => {
    expect(parseItemKey('capital-to-country:FR')).toEqual({
      mode: 'capital-to-country',
      iso2: 'FR',
    });
    expect(parseItemKey('country-to-capital:JP')).toEqual({
      mode: 'country-to-capital',
      iso2: 'JP',
    });
  });

  it('accepts the languages mode so it is trainable (Phase 23)', () => {
    expect(parseItemKey('country-to-languages:BE')).toEqual({
      mode: 'country-to-languages',
      iso2: 'BE',
    });
  });

  it('rejects malformed or unknown-mode keys', () => {
    expect(parseItemKey('BG')).toBeNull();
    expect(parseItemKey(':BG')).toBeNull();
    expect(parseItemKey('flag-to-country:')).toBeNull();
    expect(parseItemKey('bogus-mode:BG')).toBeNull();
  });
});

describe('selectTrainingItems — which items', () => {
  it('includes due items and previously-missed items, excludes fresh not-due ones', () => {
    const items = [
      sr({ itemKey: 'flag-to-country:AA', dueAt: NOW - MS_PER_DAY, lapses: 0 }), // due
      sr({ itemKey: 'flag-to-country:BB', dueAt: NOW + 5 * MS_PER_DAY, lapses: 2 }), // lapsed, not due
      sr({ itemKey: 'flag-to-country:CC', dueAt: NOW + 5 * MS_PER_DAY, lapses: 0 }), // known, not due
    ];
    const keys = selectTrainingItems(items, { now: NOW }).map((i) => i.iso2);
    expect(keys).toContain('AA');
    expect(keys).toContain('BB');
    expect(keys).not.toContain('CC');
  });

  it('retires a lapsed item once it is re-learned (GRADUATE_AFTER consecutive correct)', () => {
    const items = [
      // Missed once, then answered right GRADUATE_AFTER times in a row and pushed out of
      // due range: re-learned, so it should no longer be suggested purely on its old lapse.
      sr({
        itemKey: 'flag-to-country:RELEARNED',
        dueAt: NOW + 5 * MS_PER_DAY,
        lapses: 1,
        repetitions: GRADUATE_AFTER,
      }),
      // One short of the graduation streak: still worth training.
      sr({
        itemKey: 'flag-to-country:ALMOST',
        dueAt: NOW + 5 * MS_PER_DAY,
        lapses: 1,
        repetitions: GRADUATE_AFTER - 1,
      }),
    ];
    const keys = selectTrainingItems(items, { now: NOW }).map((i) => i.iso2);
    expect(keys).not.toContain('RELEARNED');
    expect(keys).toContain('ALMOST');
  });

  it('still surfaces a re-learned item once it falls due again (due beats graduation)', () => {
    const items = [
      sr({
        itemKey: 'flag-to-country:DUEAGAIN',
        dueAt: NOW - MS_PER_DAY,
        lapses: 2,
        repetitions: GRADUATE_AFTER + 1,
      }),
    ];
    const keys = selectTrainingItems(items, { now: NOW }).map((i) => i.iso2);
    expect(keys).toEqual(['DUEAGAIN']);
  });

  it('dueOnly excludes not-yet-due lapsed items', () => {
    const items = [
      sr({ itemKey: 'flag-to-country:AA', dueAt: NOW - MS_PER_DAY, lapses: 0 }),
      sr({ itemKey: 'flag-to-country:BB', dueAt: NOW + 5 * MS_PER_DAY, lapses: 3 }),
    ];
    const keys = selectTrainingItems(items, { now: NOW, dueOnly: true }).map((i) => i.iso2);
    expect(keys).toEqual(['AA']);
  });

  it('filters to a single mode', () => {
    const items = [
      sr({ itemKey: 'flag-to-country:AA', lapses: 1 }),
      sr({ itemKey: 'map-highlight:AA', lapses: 1 }),
    ];
    const result = selectTrainingItems(items, { now: NOW, mode: 'map-highlight' });
    expect(result).toHaveLength(1);
    expect(result[0].mode).toBe('map-highlight');
  });

  it('filters to a set of eligible modes', () => {
    const items = [
      sr({ itemKey: 'flag-to-country:AA', lapses: 1 }),
      sr({ itemKey: 'capital-to-country:AA', lapses: 1 }),
      sr({ itemKey: 'country-to-languages:AA', lapses: 1 }),
    ];
    const result = selectTrainingItems(items, {
      now: NOW,
      modes: ['flag-to-country', 'capital-to-country'],
    });
    expect(result.map((i) => i.mode).sort()).toEqual(['capital-to-country', 'flag-to-country']);
  });

  it('ignores malformed keys', () => {
    const items = [
      sr({ itemKey: 'garbage', lapses: 5 }),
      sr({ itemKey: 'flag-to-country:AA', lapses: 1 }),
    ];
    const result = selectTrainingItems(items, { now: NOW });
    expect(result.map((i) => i.iso2)).toEqual(['AA']);
  });
});

describe('selectTrainingItems — ordering (weakest first)', () => {
  it('orders due items ahead of not-yet-due lapsed items', () => {
    const items = [
      sr({ itemKey: 'flag-to-country:LAPSED', dueAt: NOW + MS_PER_DAY, lapses: 9 }),
      sr({ itemKey: 'flag-to-country:DUE', dueAt: NOW - MS_PER_DAY, lapses: 1 }),
    ];
    const order = selectTrainingItems(items, { now: NOW }).map((i) => i.iso2);
    expect(order).toEqual(['DUE', 'LAPSED']);
  });

  it('among due items, orders by lapses descending', () => {
    const items = [
      sr({ itemKey: 'flag-to-country:LOW', dueAt: NOW, lapses: 1 }),
      sr({ itemKey: 'flag-to-country:HIGH', dueAt: NOW, lapses: 5 }),
      sr({ itemKey: 'flag-to-country:MID', dueAt: NOW, lapses: 3 }),
    ];
    const order = selectTrainingItems(items, { now: NOW }).map((i) => i.iso2);
    expect(order).toEqual(['HIGH', 'MID', 'LOW']);
  });

  it('breaks lapse ties by how overdue the item is', () => {
    const items = [
      sr({ itemKey: 'flag-to-country:RECENT', dueAt: NOW - MS_PER_DAY, lapses: 2 }),
      sr({ itemKey: 'flag-to-country:STALE', dueAt: NOW - 10 * MS_PER_DAY, lapses: 2 }),
    ];
    const order = selectTrainingItems(items, { now: NOW }).map((i) => i.iso2);
    expect(order).toEqual(['STALE', 'RECENT']);
  });

  it('respects the limit after ordering', () => {
    const items = [
      sr({ itemKey: 'flag-to-country:A', dueAt: NOW, lapses: 1 }),
      sr({ itemKey: 'flag-to-country:B', dueAt: NOW, lapses: 5 }),
      sr({ itemKey: 'flag-to-country:C', dueAt: NOW, lapses: 3 }),
    ];
    const order = selectTrainingItems(items, { now: NOW, limit: 2 }).map((i) => i.iso2);
    expect(order).toEqual(['B', 'C']);
  });
});

describe('dominantTrainingMode', () => {
  it('returns null when nothing is trainable', () => {
    const items = [sr({ itemKey: 'flag-to-country:AA', dueAt: NOW + 5 * MS_PER_DAY, lapses: 0 })];
    expect(dominantTrainingMode(items, { now: NOW })).toBeNull();
  });

  it('picks the mode with the most trainable items', () => {
    const items = [
      sr({ itemKey: 'map-highlight:AA', lapses: 1 }),
      sr({ itemKey: 'map-highlight:BB', lapses: 1 }),
      sr({ itemKey: 'flag-to-country:AA', lapses: 1 }),
    ];
    expect(dominantTrainingMode(items, { now: NOW })).toBe('map-highlight');
  });
});
