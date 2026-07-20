import { describe, it, expect } from 'vitest';
import {
  BLITZ_BASE_POINTS,
  BLITZ_CAP_SECONDS,
  BLITZ_START_SECONDS,
  blitzCombo,
  blitzComboState,
  blitzComboStreak,
  blitzComboWindowMs,
  blitzDecayedCombo,
  blitzPointsForCorrect,
  blitzEarnedSeconds,
  blitzRemainingMs,
  blitzRunSeconds,
  blitzSlotMatches,
  blitzTiersLost,
  computeBlitzBest,
  computeBlitzBests,
  computeBlitzSetBest,
  computeBlitzPoints,
  blitzAllows,
  BLITZ_MODES,
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
  it('steps x1 → x5 by streak band, capping at 9+', () => {
    // streak 0–2 → x1, 3–4 → x2, 5–6 → x3, 7–8 → x4, 9+ → x5
    expect([0, 1, 2].map(blitzCombo)).toEqual([1, 1, 1]);
    expect([3, 4].map(blitzCombo)).toEqual([2, 2]);
    expect([5, 6].map(blitzCombo)).toEqual([3, 3]);
    expect([7, 8].map(blitzCombo)).toEqual([4, 4]);
    expect([9, 10, 20].map(blitzCombo)).toEqual([5, 5, 5]);
  });

  it('treats a negative streak as x1 (total function)', () => {
    expect(blitzCombo(-3)).toBe(1);
  });
});

describe('blitzPointsForCorrect', () => {
  it('is base × combo — e.g. the 5th correct scores 300, the 9th 500', () => {
    expect(blitzPointsForCorrect(1)).toBe(BLITZ_BASE_POINTS); // 100
    expect(blitzPointsForCorrect(5)).toBe(300);
    expect(blitzPointsForCorrect(7)).toBe(400);
    expect(blitzPointsForCorrect(9)).toBe(500);
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

describe('combo tier decay (slow answers)', () => {
  const fast = (): QuestionResult => ({ ...q(true), answerMs: 900 });
  // A correct answer dwelt long enough to drop exactly `tiers` tiers *from* multiplier `from`:
  // the sum of the windows for the tiers crossed (each tier-specific now) plus 200 ms into the
  // next — safely short of costing an extra tier (the smallest window is 1600 ms).
  const dwellTiers = (from: number, tiers: number): number => {
    let ms = 200;
    for (let i = 0; i < tiers; i++) ms += blitzComboWindowMs(from - i);
    return ms;
  };
  const slowBy = (from: number, tiers: number): QuestionResult => ({
    ...q(true),
    answerMs: dwellTiers(from, tiers),
  });

  it('drops one tier (not to x1) on a slow-but-correct answer', () => {
    // Build to x4 at streak 7 (100+100+200+200+300+300+400 = 1600), then a 1-tier-slow correct
    // (dwelling past x4's 2000 ms window) demotes x4 → x3 (streak 5) and scores x3 = 300 → 1900.
    const results = [...streakOf(7), slowBy(4, 1)];
    expect(computeBlitzPoints(results)).toBe(1900);
    expect(blitzComboStreak(results)).toBe(5);
    expect(blitzCombo(blitzComboStreak(results))).toBe(3);
  });

  it('drops multiple tiers when very slow', () => {
    // From x4 (streak 7), a 2-tier-slow correct (past x4's 2000 ms + x3's 2400 ms windows) demotes
    // x4 → x2 (streak 3), scoring x2 = 200.
    const results = [...streakOf(7), slowBy(4, 2)];
    expect(blitzComboStreak(results)).toBe(3);
    expect(blitzCombo(blitzComboStreak(results))).toBe(2);
    expect(computeBlitzPoints(results)).toBe(1600 + 200);
  });

  it('never falls below x1 from slowness, however long', () => {
    const results = [...streakOf(7), { ...q(true), answerMs: 999_999 }]; // way past x1
    expect(blitzComboStreak(results)).toBe(1);
    expect(blitzCombo(blitzComboStreak(results))).toBe(1);
  });

  it('a slow-but-correct answer beats a wrong one (keeps a tier vs. a full reset)', () => {
    const slowStreak = blitzComboStreak([...streakOf(7), slowBy(4, 1)]); // x3
    const wrongStreak = blitzComboStreak([...streakOf(7), q(false)]); // x1 / 0
    expect(blitzCombo(slowStreak)).toBeGreaterThan(blitzCombo(wrongStreak));
    expect(wrongStreak).toBe(0);
  });

  it('rebuilds by climbing after a decay', () => {
    // x4 (streak 7) → 1-tier-slow → x3 (streak 5) → two fast → streak 7 → back to x4.
    const results = [...streakOf(7), slowBy(4, 1), fast(), fast()];
    expect(blitzComboStreak(results)).toBe(7);
    expect(blitzCombo(blitzComboStreak(results))).toBe(4);
  });

  it('treats a missing answerMs as in-time (never punishes untimed records)', () => {
    const noTime = { itemKey: 'k', countryIso2: 'FR', correct: true } as QuestionResult;
    expect(blitzComboStreak([noTime, noTime])).toBe(2);
  });
});

describe('blitzComboWindowMs', () => {
  it('shortens with the tier, and is 0 at x1 / out of range', () => {
    expect(blitzComboWindowMs(5)).toBe(1600);
    expect(blitzComboWindowMs(4)).toBe(2000);
    expect(blitzComboWindowMs(3)).toBe(2400);
    expect(blitzComboWindowMs(2)).toBe(2800);
    expect(blitzComboWindowMs(1)).toBe(0);
    expect(blitzComboWindowMs(6)).toBe(0);
  });

  it('is strictly decreasing x2 → x5 (higher combos are slipperier)', () => {
    expect(blitzComboWindowMs(2)).toBeGreaterThan(blitzComboWindowMs(3));
    expect(blitzComboWindowMs(3)).toBeGreaterThan(blitzComboWindowMs(4));
    expect(blitzComboWindowMs(4)).toBeGreaterThan(blitzComboWindowMs(5));
  });
});

describe('blitzTiersLost', () => {
  it('loses one tier per tier-specific window, walking down from the held combo', () => {
    // From x5 the windows crossed are 1600 (x5), then 2000 (x4), then 2400 (x3)…
    expect(blitzTiersLost(0, 5)).toBe(0);
    expect(blitzTiersLost(1599, 5)).toBe(0);
    expect(blitzTiersLost(1600, 5)).toBe(1);
    expect(blitzTiersLost(1600 + 2000, 5)).toBe(2);
    expect(blitzTiersLost(1600 + 2000 + 2400, 5)).toBe(3);
    expect(blitzTiersLost(-100, 5)).toBe(0);
  });

  it('is tier-specific: the same dwell costs a tier at x5 but nothing at x3', () => {
    expect(blitzTiersLost(1600, 5)).toBe(1); // window(x5) = 1600
    expect(blitzTiersLost(1600, 3)).toBe(0); // window(x3) = 2400, still inside
  });
});

describe('blitzDecayedCombo', () => {
  it('decays the live multiplier one tier per (shortening) window, floored at x1', () => {
    // streak 9 → x5 with no wait; then one tier per successive window (1600 → 2000 → 2400 → 2800).
    expect(blitzDecayedCombo(9, 0)).toBe(5);
    expect(blitzDecayedCombo(9, 1600)).toBe(4);
    expect(blitzDecayedCombo(9, 1600 + 2000)).toBe(3);
    expect(blitzDecayedCombo(9, 1600 + 2000 + 2400)).toBe(2);
    expect(blitzDecayedCombo(9, 1600 + 2000 + 2400 + 2800)).toBe(1);
    expect(blitzDecayedCombo(9, 999_999)).toBe(1);
    expect(blitzDecayedCombo(1, 5000)).toBe(1); // already x1
  });
});

describe('blitzComboState', () => {
  it('reports the live combo, its window, and the time left in it', () => {
    expect(blitzComboState(5, 0)).toEqual({ combo: 5, windowMs: 1600, remainingMs: 1600 });
    expect(blitzComboState(5, 600)).toEqual({ combo: 5, windowMs: 1600, remainingMs: 1000 });
    // Just past x5's window: dropped to x4, meter refills to its longer 2000 ms window.
    expect(blitzComboState(5, 1600)).toEqual({ combo: 4, windowMs: 2000, remainingMs: 2000 });
    expect(blitzComboState(5, 1600 + 500)).toEqual({ combo: 4, windowMs: 2000, remainingMs: 1500 });
  });

  it('bottoms out at x1 with no window', () => {
    expect(blitzComboState(5, 999_999)).toEqual({ combo: 1, windowMs: 0, remainingMs: 0 });
    expect(blitzComboState(1, 0)).toEqual({ combo: 1, windowMs: 0, remainingMs: 0 });
  });
});

describe('blitzComboStreak', () => {
  it('is 0 when empty or ending on a wrong answer, else the fast-correct tail', () => {
    expect(blitzComboStreak([])).toBe(0);
    expect(blitzComboStreak([...streakOf(4), q(false)])).toBe(0);
    expect(blitzComboStreak(streakOf(4))).toBe(4);
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

describe('blitzEarnedSeconds', () => {
  it('is the bonus time added beyond the start (1 s per correct)', () => {
    expect(blitzEarnedSeconds(0)).toBe(0);
    expect(blitzEarnedSeconds(10)).toBe(10);
  });

  it('is bounded by the cap headroom (reveals cap-hitting runs)', () => {
    const headroom = BLITZ_CAP_SECONDS - BLITZ_START_SECONDS; // 30
    expect(blitzEarnedSeconds(30)).toBe(headroom);
    expect(blitzEarnedSeconds(100)).toBe(headroom);
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

  it('excludes targeted-practice (custom-set) runs from the World/region best', () => {
    const sessions = [
      blitzRecord({ points: 900 }), // World run → counts
      blitzRecord({ points: 5000, answerPool: ['FR', 'DE'] }), // custom set → excluded
      blitzRecord({ points: 6000, answerPool: ['FR', 'DE'], setId: 's1' }), // saved set → excluded
    ];
    expect(computeBlitzBest(sessions, { mode: 'flag-to-country' })).toBe(900);
  });
});

describe('blitzAllows / BLITZ_MODES', () => {
  it('allows the five quick-tap modes and rejects the rest', () => {
    expect(BLITZ_MODES).toHaveLength(5);
    for (const m of BLITZ_MODES) expect(blitzAllows(m)).toBe(true);
    expect(blitzAllows('map-locate')).toBe(false);
    expect(blitzAllows('country-to-languages')).toBe(false);
    expect(blitzAllows('country-to-industry')).toBe(false);
  });
});

describe('computeBlitzSetBest', () => {
  it('is 0 when no blitz run matches the set + mode', () => {
    expect(computeBlitzSetBest([], { mode: 'flag-to-country', setId: 's1' })).toBe(0);
    const other = blitzRecord({ points: 999, setId: 's2', answerPool: ['FR'] });
    expect(computeBlitzSetBest([other], { mode: 'flag-to-country', setId: 's1' })).toBe(0);
  });

  it('returns the max points among runs of that saved set in that mode', () => {
    const sessions = [
      blitzRecord({ points: 400, setId: 's1', answerPool: ['FR', 'DE'] }),
      blitzRecord({ points: 1200, setId: 's1', answerPool: ['FR', 'DE'] }), // same set → wins
      blitzRecord({ points: 9000, setId: 's1', mode: 'country-to-flag', answerPool: ['FR'] }), // other mode
      blitzRecord({ points: 9000, setId: 's2', answerPool: ['FR'] }), // other set
    ];
    expect(computeBlitzSetBest(sessions, { mode: 'flag-to-country', setId: 's1' })).toBe(1200);
  });

  it('ignores ad-hoc runs (no setId)', () => {
    const adHoc = blitzRecord({ points: 5000, answerPool: ['FR', 'DE'] }); // no setId
    expect(computeBlitzSetBest([adHoc], { mode: 'flag-to-country', setId: 's1' })).toBe(0);
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

  it('omits targeted-practice (custom-set) runs from the per-region panel', () => {
    const bests = computeBlitzBests([
      blitzRecord({ points: 700 }), // World slot → kept
      blitzRecord({ points: 9000, answerPool: ['FR', 'DE'], setId: 's1' }), // custom set → omitted
    ]);
    expect(bests.map((b) => [b.region ?? null, b.subregion ?? null, b.points])).toEqual([
      [null, null, 700],
    ]);
  });
});
