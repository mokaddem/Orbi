import { describe, it, expect } from 'vitest';
import {
  BLITZ_BASE_POINTS,
  BLITZ_CAP_SECONDS,
  BLITZ_START_SECONDS,
  blitzCombo,
  blitzPointsForCorrect,
  blitzRemainingMs,
  blitzRunSeconds,
  blitzSlotMatches,
  computeBlitzBest,
  computeBlitzBests,
  computeBlitzPoints,
} from './blitz';
import type { GameMode, QuestionResult, RegionFilter } from './types';
import type { SessionRecord } from '../data/persistence/types';

const q = (correct: boolean): QuestionResult => ({
  itemKey: 'flag-to-country:FR',
  countryIso2: 'FR',
  correct,
  answerMs: 900,
});

/** `n` correct answers in a row, as a results list. */
const streakOf = (n: number): QuestionResult[] => Array.from({ length: n }, () => q(true));

describe('blitzCombo', () => {
  it('steps x1 → x4 by streak band, capping at 7+', () => {
    // streak 0–2 → x1, 3–4 → x2, 5–6 → x3, 7+ → x4
    expect([0, 1, 2].map(blitzCombo)).toEqual([1, 1, 1]);
    expect([3, 4].map(blitzCombo)).toEqual([2, 2]);
    expect([5, 6].map(blitzCombo)).toEqual([3, 3]);
    expect([7, 8, 20].map(blitzCombo)).toEqual([4, 4, 4]);
  });

  it('treats a negative streak as x1 (total function)', () => {
    expect(blitzCombo(-3)).toBe(1);
  });
});

describe('blitzPointsForCorrect', () => {
  it('is base × combo — e.g. the 5th correct scores 300', () => {
    expect(blitzPointsForCorrect(1)).toBe(BLITZ_BASE_POINTS); // 100
    expect(blitzPointsForCorrect(5)).toBe(300);
    expect(blitzPointsForCorrect(7)).toBe(400);
  });
});

describe('computeBlitzPoints', () => {
  it('is 0 for an empty run and for an all-wrong run', () => {
    expect(computeBlitzPoints([])).toBe(0);
    expect(computeBlitzPoints([q(false), q(false)])).toBe(0);
  });

  it('sums base × combo across a clean streak', () => {
    // 1..5 correct → 100+100+200+200+300 = 900
    expect(computeBlitzPoints(streakOf(5))).toBe(900);
  });

  it('resets the combo after a wrong answer', () => {
    // 3 correct (100+100+200=400), miss (reset), then 1 correct (100) → 500
    const results = [...streakOf(3), q(false), q(true)];
    expect(computeBlitzPoints(results)).toBe(500);
  });
});

describe('blitzRunSeconds', () => {
  it('starts at 60 s and adds 1 s per correct', () => {
    expect(blitzRunSeconds(0)).toBe(BLITZ_START_SECONDS);
    expect(blitzRunSeconds(10)).toBe(70);
  });

  it('caps at 90 s (maxing out at 30 correct)', () => {
    expect(blitzRunSeconds(30)).toBe(BLITZ_CAP_SECONDS);
    expect(blitzRunSeconds(100)).toBe(BLITZ_CAP_SECONDS);
  });
});

describe('blitzRemainingMs', () => {
  it('counts down from the earned run length and never goes negative', () => {
    expect(blitzRemainingMs(0, 0)).toBe(60_000);
    expect(blitzRemainingMs(10_000, 0)).toBe(50_000);
    expect(blitzRemainingMs(999_999, 0)).toBe(0);
  });

  it('each correct answer extends the clock by a second, up to the cap', () => {
    // 5 correct → 65 s run; 10 s in → 55 s left.
    expect(blitzRemainingMs(10_000, 5)).toBe(55_000);
    // Past the cap: 40 correct still only buys 90 s.
    expect(blitzRemainingMs(0, 40)).toBe(90_000);
  });
});

// ---- Personal best over history ----------------------------------------------------------

function blitzRecord(
  over: Partial<SessionRecord> & { mode?: GameMode; regionFilter?: RegionFilter },
): SessionRecord {
  return {
    id: `b${Math.round(over.startedAt ?? 0)}-${over.points ?? 0}`,
    startedAt: 0,
    finishedAt: 0,
    durationMs: 0,
    mode: 'flag-to-country',
    type: 'blitz',
    total: 0,
    correct: 0,
    questions: [],
    ...over,
  };
}

describe('blitzSlotMatches', () => {
  it('matches World (no region) only against World records', () => {
    expect(blitzSlotMatches(undefined, { mode: 'flag-to-country' })).toBe(true);
    expect(blitzSlotMatches({ region: 'Europe' }, { mode: 'flag-to-country' })).toBe(false);
  });

  it('matches a region only against records with that region and no sub-region', () => {
    const query = { mode: 'flag-to-country' as GameMode, region: 'Europe' };
    expect(blitzSlotMatches({ region: 'Europe' }, query)).toBe(true);
    expect(blitzSlotMatches({ region: 'Europe', subregion: 'Northern Europe' }, query)).toBe(false);
    expect(blitzSlotMatches({ region: 'Asia' }, query)).toBe(false);
  });

  it('matches a sub-region slot only against that exact sub-region', () => {
    const query = {
      mode: 'flag-to-country' as GameMode,
      region: 'Europe',
      subregion: 'Northern Europe',
    };
    expect(blitzSlotMatches({ region: 'Europe', subregion: 'Northern Europe' }, query)).toBe(true);
    expect(blitzSlotMatches({ region: 'Europe' }, query)).toBe(false);
  });
});

describe('computeBlitzBest', () => {
  it('is 0 when no blitz record matches the slot', () => {
    expect(computeBlitzBest([], { mode: 'flag-to-country' })).toBe(0);
    const nonBlitz = blitzRecord({ type: 'fixed', points: 999 });
    expect(computeBlitzBest([nonBlitz], { mode: 'flag-to-country' })).toBe(0);
  });

  it('returns the max points among matching records only', () => {
    const sessions = [
      blitzRecord({ points: 400, regionFilter: { region: 'Europe' } }),
      blitzRecord({ points: 900, regionFilter: { region: 'Europe' } }),
      blitzRecord({ points: 5000, regionFilter: { region: 'Asia' } }), // different region
      blitzRecord({ points: 5000, mode: 'country-to-flag', regionFilter: { region: 'Europe' } }), // different mode
    ];
    expect(computeBlitzBest(sessions, { mode: 'flag-to-country', region: 'Europe' })).toBe(900);
  });

  it('falls back to replaying questions when a record has no cached points', () => {
    const record = blitzRecord({ questions: streakOf(5) }); // 900 points, no `points` field
    expect(record.points).toBeUndefined();
    expect(computeBlitzBest([record], { mode: 'flag-to-country' })).toBe(900);
  });
});

describe('computeBlitzBests', () => {
  it('is empty with no blitz history', () => {
    expect(computeBlitzBests([])).toEqual([]);
    expect(computeBlitzBests([blitzRecord({ type: 'fixed', points: 999 })])).toEqual([]);
  });

  it('returns one best per slot, sorted by points descending', () => {
    const bests = computeBlitzBests([
      blitzRecord({ points: 400, regionFilter: { region: 'Europe' } }),
      blitzRecord({ points: 1200, regionFilter: { region: 'Europe' } }), // higher, same slot → wins
      blitzRecord({ points: 800, mode: 'country-to-capital' }), // World slot, different mode
      blitzRecord({
        points: 300,
        regionFilter: { region: 'Europe', subregion: 'Northern Europe' },
      }),
    ]);
    expect(bests.map((b) => [b.mode, b.region ?? null, b.subregion ?? null, b.points])).toEqual([
      ['flag-to-country', 'Europe', null, 1200],
      ['country-to-capital', null, null, 800],
      ['flag-to-country', 'Europe', 'Northern Europe', 300],
    ]);
  });
});
