import { describe, it, expect } from 'vitest';
import type { SessionRecord, SRItem } from '../data/persistence/types';
import type { QuestionResult, GameMode } from './types';
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

function q(itemKey: string, correct: boolean): QuestionResult {
  const iso2 = itemKey.slice(itemKey.indexOf(':') + 1);
  return { itemKey, countryIso2: iso2, correct, answerMs: 1000 };
}

function record(questions: QuestionResult[], over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: 'id',
    startedAt: NOW,
    finishedAt: NOW,
    durationMs: 1000,
    mode: 'flag-to-country',
    type: 'fixed',
    total: questions.length,
    correct: questions.filter((r) => r.correct).length,
    ...over,
    questions,
  };
}

// Geo stub: BG/RO Eastern Europe, FR/DE Western Europe, JP Eastern Asia.
const REGIONS: Record<string, { region: string; subregion: string }> = {
  BG: { region: 'Europe', subregion: 'Eastern Europe' },
  RO: { region: 'Europe', subregion: 'Eastern Europe' },
  FR: { region: 'Europe', subregion: 'Western Europe' },
  DE: { region: 'Europe', subregion: 'Western Europe' },
  JP: { region: 'Asia', subregion: 'Eastern Asia' },
};
const regionOf: RegionResolver = (iso2) => REGIONS[iso2];

/** N answered questions for one sub-region's countries, `correct` of them right. */
function attempts(
  mode: GameMode,
  isoPool: string[],
  total: number,
  correct: number,
): QuestionResult[] {
  const out: QuestionResult[] = [];
  for (let i = 0; i < total; i++) {
    const iso = isoPool[i % isoPool.length];
    out.push(q(`${mode}:${iso}`, i < correct));
  }
  return out;
}

describe('recommend — always yields something (never empty)', () => {
  it('recommends fresh-start on a brand-new profile', () => {
    const recs = recommend([], [], { now: NOW, regionOf });
    expect(recs[0].kind).toBe('fresh-start');
    expect(recs[0].run).toBeUndefined();
  });
});

describe('recommend — due-for-review', () => {
  it('leads with due when items are due, drilling the dominant mode weakest-first', () => {
    const srItems = [
      sr({ itemKey: 'flag-to-country:BG', dueAt: NOW - MS_PER_DAY, lapses: 3 }),
      sr({ itemKey: 'flag-to-country:RO', dueAt: NOW - MS_PER_DAY, lapses: 1 }),
      sr({ itemKey: 'map-highlight:FR', dueAt: NOW - MS_PER_DAY, lapses: 1 }), // fewer → not dominant
    ];
    const top = recommend(srItems, [], { now: NOW, regionOf })[0];
    expect(top.kind).toBe('due');
    expect(top.mode).toBe('flag-to-country');
    expect(top.count).toBe(2);
    expect(top.run).toMatchObject({ type: 'training', mode: 'flag-to-country' });
    // Weakest first: BG (3 lapses) before RO (1 lapse).
    expect(top.run?.answerPoolIso).toEqual(['BG', 'RO']);
  });

  it('ignores items that are lapsed but not yet due (those belong to the train-all link)', () => {
    const srItems = [sr({ itemKey: 'flag-to-country:BG', dueAt: NOW + 5 * MS_PER_DAY, lapses: 4 })];
    const top = recommend(srItems, [], { now: NOW, regionOf })[0];
    expect(top.kind).not.toBe('due');
  });

  it('caps the drilled pool at dueLimit', () => {
    const srItems = Array.from({ length: 30 }, (_, i) =>
      sr({ itemKey: `flag-to-country:C${i}`, dueAt: NOW - MS_PER_DAY, lapses: 1 }),
    );
    const top = recommend(srItems, [], { now: NOW, regionOf, dueLimit: 20 })[0];
    expect(top.kind).toBe('due');
    expect(top.run?.answerPoolIso).toHaveLength(20);
  });
});

describe('recommend — weak-spot', () => {
  it('surfaces the weakest qualifying sub-region when nothing is due', () => {
    // Eastern Europe: 12 attempts, 4 correct (33%). Western Europe: 12 attempts, 11 correct (~92%).
    const records = [
      record(attempts('flag-to-country', ['BG', 'RO'], 12, 4)),
      record(attempts('flag-to-country', ['FR', 'DE'], 12, 11)),
    ];
    const top = recommend([], records, { now: NOW, regionOf })[0];
    expect(top.kind).toBe('weak-spot');
    expect(top.regionKey).toBe('Eastern Europe');
    expect(top.iconRegion).toBe('Europe');
    expect(top.count).toBe(12);
    expect(top.accuracy).toBeCloseTo(4 / 12);
    expect(top.run).toMatchObject({
      type: 'fixed',
      filter: { region: 'Europe', subregion: 'Eastern Europe' },
    });
  });

  it('respects the sample-size floor — a tiny bad region does not qualify', () => {
    const records = [record(attempts('flag-to-country', ['BG'], 3, 0))]; // 3 < 10 attempts
    const top = recommend([], records, { now: NOW, regionOf })[0];
    expect(top.kind).toBe('fresh-start');
  });

  it('respects the accuracy ceiling — a strong region does not qualify', () => {
    const records = [record(attempts('flag-to-country', ['BG', 'RO'], 12, 11))]; // ~92% ≥ 70%
    const top = recommend([], records, { now: NOW, regionOf })[0];
    expect(top.kind).toBe('fresh-start');
  });

  it('picks the mode most-attempted in the weak sub-region', () => {
    // Eastern Europe played mostly on map-highlight (8) vs flag-to-country (4); all weak.
    const records = [
      record(attempts('map-highlight', ['BG', 'RO'], 8, 1)),
      record(attempts('flag-to-country', ['BG', 'RO'], 4, 1)),
    ];
    const top = recommend([], records, { now: NOW, regionOf })[0];
    expect(top.kind).toBe('weak-spot');
    expect(top.mode).toBe('map-highlight');
    expect(top.run?.mode).toBe('map-highlight');
  });
});

describe('recommend — priority ordering', () => {
  it('orders due → weak-spot → fresh-start when all apply', () => {
    const srItems = [sr({ itemKey: 'flag-to-country:JP', dueAt: NOW - MS_PER_DAY, lapses: 1 })];
    const records = [record(attempts('flag-to-country', ['BG', 'RO'], 12, 3))]; // weak Eastern Europe
    const kinds = recommend(srItems, records, { now: NOW, regionOf }).map((r) => r.kind);
    expect(kinds).toEqual(['due', 'weak-spot', 'fresh-start']);
  });

  it('is deterministic given the same inputs and now', () => {
    const srItems = [sr({ itemKey: 'flag-to-country:BG', dueAt: NOW - MS_PER_DAY, lapses: 2 })];
    const records = [record(attempts('flag-to-country', ['BG', 'RO'], 12, 3))];
    const a = recommend(srItems, records, { now: NOW, regionOf });
    const b = recommend(srItems, records, { now: NOW, regionOf });
    expect(a).toEqual(b);
  });
});
