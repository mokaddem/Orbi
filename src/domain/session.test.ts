import { describe, it, expect } from 'vitest';
import type { Country } from '../data/types';
import { mulberry32 } from './rng';
import { DEFAULT_FIXED_LENGTH, DEFAULT_LIVES, QuizSession, createSession } from './session';
import type { SessionConfig } from './session';

function mk(iso2: string, region: string, subregion: string): Country {
  return {
    iso2,
    iso3: (iso2 + 'Z').toUpperCase(),
    numericId: '000',
    name: { en: iso2, fr: iso2, de: iso2 },
    capital: { en: `${iso2}-cap`, fr: `${iso2}-cap`, de: `${iso2}-cap` },
    languages: [{ code: iso2.toLowerCase(), name: { en: iso2, fr: iso2, de: iso2 } }],
    industries: [{ key: `ind-${iso2.toLowerCase()}`, name: { en: iso2, fr: iso2, de: iso2 } }],
    region,
    subregion,
    flagAsset: `flags/${iso2.toLowerCase()}.svg`,
    hasGeometry: true,
  };
}

const UNIVERSE: Country[] = [
  mk('AA', 'R1', 'S1'),
  mk('AB', 'R1', 'S1'),
  mk('AC', 'R1', 'S1'),
  mk('AD', 'R1', 'S1'),
  mk('BA', 'R1', 'S2'),
  mk('BB', 'R1', 'S2'),
  mk('CA', 'R2', 'S3'),
  mk('CB', 'R2', 'S3'),
  mk('CC', 'R2', 'S3'),
];

/** A controllable clock so timing assertions are exact. */
function makeClock(start = 1000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

function base(overrides: Partial<SessionConfig> = {}): SessionConfig {
  return {
    mode: 'flag-to-country',
    type: 'fixed',
    countries: UNIVERSE,
    rng: mulberry32(1),
    ...overrides,
  };
}

describe('QuizSession — construction & defaults', () => {
  it('starts idle with no current question', () => {
    const s = new QuizSession(base());
    expect(s.state.status).toBe('idle');
    expect(s.state.current).toBeNull();
    expect(s.state.index).toBe(-1);
    expect(s.state.results).toEqual([]);
    expect(s.isFinished()).toBe(false);
  });

  it('exposes Infinity lives for non-survival sessions', () => {
    expect(new QuizSession(base({ type: 'fixed' })).state.livesRemaining).toBe(Infinity);
    expect(new QuizSession(base({ type: 'survival' })).state.livesRemaining).toBe(DEFAULT_LIVES);
  });

  it('throws when the pool is empty after filtering', () => {
    expect(() => new QuizSession(base({ filter: { region: 'nope' } }))).toThrow();
  });

  it('excludes geometry-less countries from map-mode answers but not flag-mode answers', () => {
    // XX has no map geometry (like Tuvalu); it can't be highlighted or clicked.
    const withGap: Country[] = [...UNIVERSE, { ...mk('XX', 'R1', 'S1'), hasGeometry: false }];
    const answersFor = (mode: SessionConfig['mode']): Set<string> => {
      const s = new QuizSession(base({ mode, countries: withGap, fixedLength: 200 }));
      const seen = new Set<string>();
      let q = s.next();
      while (q) {
        seen.add(q.answer.iso2);
        s.submit(q.answer);
        q = s.next();
      }
      return seen;
    };
    expect(answersFor('map-locate').has('XX')).toBe(false);
    expect(answersFor('map-highlight').has('XX')).toBe(false);
    expect(answersFor('flag-to-country').has('XX')).toBe(true);
  });

  it('createSession returns an equivalent instance', () => {
    expect(createSession(base())).toBeInstanceOf(QuizSession);
  });
});

describe('QuizSession — question flow', () => {
  it('presents a question on next() and advances the index', () => {
    const s = new QuizSession(base());
    const q = s.next();
    expect(q).not.toBeNull();
    expect(s.state.status).toBe('active');
    expect(s.state.index).toBe(0);
    expect(s.state.current).toBe(q);
  });

  it('returns the same pending question if next() is called again before submit()', () => {
    const s = new QuizSession(base());
    const q1 = s.next();
    const q2 = s.next();
    expect(q2).toBe(q1);
    expect(s.state.index).toBe(0); // did not advance
  });

  it('throws if submit() is called with no active question', () => {
    const s = new QuizSession(base());
    expect(() => s.submit(null)).toThrow();
  });

  it('emits a QuestionResult with the item key and country', () => {
    const s = new QuizSession(base({ mode: 'map-highlight' }));
    const q = s.next()!;
    const r = s.submit(q.answer);
    expect(r).toEqual({
      itemKey: `map-highlight:${q.answer.iso2}`,
      countryIso2: q.answer.iso2,
      correct: true,
      answerMs: expect.any(Number),
    });
  });
});

describe('QuizSession — fixed sessions', () => {
  it('ends after exactly N questions (default 10)', () => {
    const s = new QuizSession(base());
    let asked = 0;
    let q = s.next();
    while (q) {
      asked += 1;
      s.submit(q.answer);
      q = s.next();
    }
    expect(asked).toBe(DEFAULT_FIXED_LENGTH);
    expect(s.isFinished()).toBe(true);
    expect(s.next()).toBeNull();
    expect(s.state.results).toHaveLength(DEFAULT_FIXED_LENGTH);
  });

  it('respects a custom fixed length', () => {
    const s = new QuizSession(base({ fixedLength: 3 }));
    for (let i = 0; i < 3; i++) s.submit(s.next()!.answer);
    expect(s.isFinished()).toBe(true);
    expect(s.state.results).toHaveLength(3);
  });
});

describe('QuizSession — survival sessions', () => {
  it('ends after the configured number of mistakes', () => {
    const s = new QuizSession(base({ type: 'survival', lives: 2 }));
    s.next();
    s.submit(null); // wrong #1
    expect(s.isFinished()).toBe(false);
    expect(s.state.livesRemaining).toBe(1);

    s.next();
    s.submit(null); // wrong #2 → out of lives
    expect(s.isFinished()).toBe(true);
    expect(s.state.livesRemaining).toBe(0);
  });

  it('ends in a "region cleared" win once every country is answered correctly (Phase 40)', () => {
    const smallPool = [mk('AA', 'R1', 'S1'), mk('AB', 'R1', 'S1'), mk('AC', 'R1', 'S1')];
    const s = new QuizSession(base({ type: 'survival', lives: 3, countries: smallPool }));
    // The three distinct countries are drawn without replacement; clearing needs all three.
    s.submit(s.next()!.answer);
    expect(s.isFinished()).toBe(false); // 1/3 cleared
    s.submit(s.next()!.answer);
    expect(s.isFinished()).toBe(false); // 2/3 cleared — not before the whole pool
    s.submit(s.next()!.answer);
    expect(s.isFinished()).toBe(true); // 3/3 → region cleared
    expect(s.state.results).toHaveLength(3);
    expect(s.state.livesRemaining).toBe(3); // a flawless clear keeps every life
    expect(s.next()).toBeNull();
    const sum = s.summary();
    expect(sum.cleared).toBe(true);
    expect(sum.correct).toBe(sum.total); // flawless → the UI plays the `perfect` jingle
  });

  it('clears a region even when a country was missed then later gotten right (last life)', () => {
    const pool = [mk('AA', 'R1', 'S1'), mk('AB', 'R1', 'S1')];
    const s = new QuizSession(base({ type: 'survival', lives: 2, countries: pool }));
    // Miss the first question — costs a life, but the country can still be cleared later.
    const first = s.next()!;
    s.submit(null);
    expect(s.state.livesRemaining).toBe(1);
    expect(s.isFinished()).toBe(false);
    // Now answer every drawn question correctly until the region clears.
    let guard = 0;
    while (!s.isFinished() && guard++ < 50) {
      const q = s.next();
      if (!q) break;
      s.submit(q.answer);
    }
    expect(s.isFinished()).toBe(true);
    expect(s.state.livesRemaining).toBe(1); // cleared on the last life
    const sum = s.summary();
    expect(sum.cleared).toBe(true);
    // Distinct-correct is what clears, so an earlier miss still shows up as missed.
    expect(sum.missed.map((c) => c.iso2)).toContain(first.answer.iso2);
    expect(sum.correct).toBeLessThan(sum.total); // imperfect clear → the `finish` jingle
  });

  it('still ends in a loss at 0 lives even with one country left to clear', () => {
    const pool = [mk('AA', 'R1', 'S1'), mk('AB', 'R1', 'S1')];
    const s = new QuizSession(base({ type: 'survival', lives: 1, countries: pool }));
    s.submit(s.next()!.answer); // clear one (1/2), 1 life left
    expect(s.isFinished()).toBe(false);
    s.next();
    s.submit(null); // miss the last one → out of lives, region not cleared
    expect(s.isFinished()).toBe(true);
    expect(s.state.livesRemaining).toBe(0);
    expect(s.summary().cleared).toBe(false); // a loss, not a clear
  });

  it('leaves the clear-win off for non-survival types (cleared is false)', () => {
    const pool = [mk('AA', 'R1', 'S1'), mk('AB', 'R1', 'S1')];
    // fixed: bounded by fixedLength, never by pool coverage.
    const fixed = new QuizSession(base({ type: 'fixed', fixedLength: 2, countries: pool }));
    fixed.submit(fixed.next()!.answer);
    fixed.submit(fixed.next()!.answer);
    expect(fixed.summary().cleared).toBe(false);
    // full: already exhausts the pool; the clear flag stays off (only survival "wins").
    const full = new QuizSession(base({ type: 'full', countries: pool }));
    let q = full.next();
    while (q) {
      full.submit(q.answer);
      q = full.next();
    }
    expect(full.isFinished()).toBe(true);
    expect(full.summary().cleared).toBe(false);
  });
});

describe('QuizSession — full ("Grand Tour") sessions', () => {
  it('exposes answerCount as the eligible pool size (Infinity lives, like fixed)', () => {
    const s = new QuizSession(base({ type: 'full' }));
    expect(s.answerCount).toBe(UNIVERSE.length);
    expect(s.state.livesRemaining).toBe(Infinity);
  });

  it('asks about every country in scope exactly once, then finishes', () => {
    const s = new QuizSession(base({ type: 'full' }));
    const asked: string[] = [];
    let q = s.next();
    while (q) {
      asked.push(q.answer.iso2);
      s.submit(q.answer);
      q = s.next();
    }
    expect(s.isFinished()).toBe(true);
    expect(s.next()).toBeNull();
    // One question per country, no repeats, covering the whole universe.
    expect(asked).toHaveLength(UNIVERSE.length);
    expect(new Set(asked)).toEqual(new Set(UNIVERSE.map((c) => c.iso2)));
  });

  it('honours the region filter — a full run covers only the filtered pool', () => {
    const s = new QuizSession(base({ type: 'full', filter: { region: 'R2' } }));
    const r2 = UNIVERSE.filter((c) => c.region === 'R2');
    expect(s.answerCount).toBe(r2.length);
    let count = 0;
    let q = s.next();
    while (q) {
      expect(q.answer.region).toBe('R2');
      count += 1;
      s.submit(q.answer);
      q = s.next();
    }
    expect(count).toBe(r2.length);
  });

  it('sizes a map-mode full run to countries that have geometry', () => {
    const withGap: Country[] = [...UNIVERSE, { ...mk('XX', 'R1', 'S1'), hasGeometry: false }];
    const flag = new QuizSession(
      base({ type: 'full', mode: 'flag-to-country', countries: withGap }),
    );
    const map = new QuizSession(base({ type: 'full', mode: 'map-highlight', countries: withGap }));
    expect(flag.answerCount).toBe(withGap.length); // flags keep the geometry-less country
    expect(map.answerCount).toBe(UNIVERSE.length); // map drops it
  });
});

describe('QuizSession — scoring & streaks', () => {
  it('tracks correct count, accuracy, and best streak', () => {
    const s = new QuizSession(base({ fixedLength: 5 }));
    const outcomes = [true, true, false, true, true];
    for (const ok of outcomes) {
      const q = s.next()!;
      s.submit(ok ? q.answer : null);
    }
    const sum = s.summary();
    expect(sum.correct).toBe(4);
    expect(sum.total).toBe(5);
    expect(sum.accuracy).toBeCloseTo(0.8);
    expect(sum.bestStreak).toBe(2);
    expect(s.state.streak).toBe(2); // ended on a 2-run
  });

  it('resets the current streak on a wrong answer', () => {
    const s = new QuizSession(base({ fixedLength: 4 }));
    s.submit(s.next()!.answer); // correct
    expect(s.state.streak).toBe(1);
    s.next();
    s.submit(null); // wrong
    expect(s.state.streak).toBe(0);
    expect(s.state.bestStreak).toBe(1);
  });
});

describe('QuizSession — timing', () => {
  it('captures per-question answer time from the injected clock', () => {
    const clock = makeClock(1000);
    const s = new QuizSession(base({ fixedLength: 2, now: clock.now }));

    s.next();
    clock.advance(250);
    expect(s.submit(null).answerMs).toBe(250);

    s.next();
    clock.advance(90);
    expect(s.submit(null).answerMs).toBe(90);
  });

  it('records overall duration in the summary', () => {
    const clock = makeClock(5000);
    const s = new QuizSession(base({ fixedLength: 2, now: clock.now }));
    s.next(); // startedAt = 5000
    clock.advance(300);
    s.submit(null);
    s.next();
    clock.advance(200);
    s.submit(null); // finishedAt = 5500
    expect(s.summary().durationMs).toBe(500);
  });
});

describe('QuizSession — explicit answer pool (training)', () => {
  it('asks only about the answer pool while drawing distractors from the whole universe', () => {
    const pool = [mk('AA', 'R1', 'S1'), mk('BA', 'R1', 'S2')];
    const s = new QuizSession(
      base({ type: 'training', answerPool: pool, fixedLength: 12, choices: 4 }),
    );
    const askedAbout = new Set<string>();
    let q = s.next();
    while (q) {
      askedAbout.add(q.answer.iso2);
      // Options can include any country in the universe, but always 4 of them.
      expect(q.options).toHaveLength(4);
      expect(q.options!.some((o) => o.iso2 === q!.answer.iso2)).toBe(true);
      s.submit(q.answer);
      q = s.next();
    }
    // Every question was drawn from the two-country pool, and both appeared.
    expect([...askedAbout].sort()).toEqual(['AA', 'BA']);
  });

  it('overrides the region filter when an answer pool is given', () => {
    const pool = [mk('CA', 'R2', 'S3')];
    const s = new QuizSession(
      base({ type: 'training', filter: { region: 'R1' }, answerPool: pool, fixedLength: 1 }),
    );
    const q = s.next()!;
    expect(q.answer.iso2).toBe('CA'); // from the pool, not the R1 filter
  });

  it('throws when the answer pool is empty', () => {
    expect(() => new QuizSession(base({ type: 'training', answerPool: [] }))).toThrow();
  });
});

describe('QuizSession — summary', () => {
  it('lists distinct missed countries in order of first miss', () => {
    // A single-country survival run misses the same country repeatedly.
    const one = [mk('AA', 'R1', 'S1')];
    const s = new QuizSession(base({ type: 'survival', lives: 3, countries: one }));
    for (let i = 0; i < 3; i++) {
      s.next();
      s.submit(null);
    }
    const sum = s.summary();
    expect(sum.total).toBe(3);
    expect(sum.correct).toBe(0);
    expect(sum.missed.map((c) => c.iso2)).toEqual(['AA']); // de-duplicated
  });

  it('carries mode, type, and region filter through to the summary', () => {
    const s = new QuizSession(
      base({ mode: 'country-to-flag', type: 'fixed', filter: { region: 'R1' }, fixedLength: 1 }),
    );
    s.submit(s.next()!.answer);
    const sum = s.summary();
    expect(sum.mode).toBe('country-to-flag');
    expect(sum.type).toBe('fixed');
    expect(sum.regionFilter).toEqual({ region: 'R1' });
    expect(sum.missed).toEqual([]);
    expect(sum.accuracy).toBe(1);
  });
});
