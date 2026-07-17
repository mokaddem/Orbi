import { describe, it, expect } from 'vitest';
import type { Country } from '../data/types';
import type { SRItem } from '../data/persistence/types';
import { mulberry32 } from './rng';
import { FAMILIES, type MasteryFamily } from './modes';
import {
  computeFamilyMastery,
  type FamilyMasteryResult,
  type FamilyTally,
  type MasteryCountry,
} from './mastery';
import {
  ChallengeSession,
  availableChallenges,
  buildChallengeQuestion,
  buildChallengeQueue,
  challengeSlotCount,
  createChallenge,
  familyModes,
  isChallengeUnlocked,
} from './challenge';
import type { Question } from './types';

/** A minimal synthetic country; override any field (e.g. `hasGeometry`) via `over`. */
function mk(iso2: string, region: string, subregion = 'S1', over: Partial<Country> = {}): Country {
  return {
    iso2,
    iso3: (iso2 + 'X').toUpperCase(),
    numericId: '000',
    name: { en: iso2, fr: iso2, de: iso2 },
    capital: { en: `${iso2}-cap`, fr: `${iso2}-cap`, de: `${iso2}-cap` },
    languages: [{ code: iso2.toLowerCase(), name: { en: iso2, fr: iso2, de: iso2 } }],
    industries: [{ key: `ind-${iso2.toLowerCase()}`, name: { en: iso2, fr: iso2, de: iso2 } }],
    region,
    subregion,
    flagAsset: `flags/${iso2.toLowerCase()}.svg`,
    hasGeometry: true,
    ...over,
  };
}

/** A 3-country continent (all with geometry). */
const AF = [mk('AA', 'AF'), mk('BB', 'AF'), mk('CC', 'AF', 'S2')];

const seeded = () => mulberry32(42);

// --- isChallengeUnlocked -----------------------------------------------------------------------

/** Hand-build a mastery result with a single region's per-family [mastered, total] tallies. */
function masteryFor(
  region: string,
  tallies: Partial<Record<MasteryFamily, [number, number]>>,
): FamilyMasteryResult {
  const families: FamilyTally[] = FAMILIES.map((f) => {
    const [mastered, total] = tallies[f.key] ?? [0, 0];
    return { family: f.key, mastered, learning: 0, unseen: Math.max(0, total - mastered), total };
  });
  const rollup = { families, fullyMastered: 0, inProgress: 0, unseen: 0, blended: 0, total: 0 };
  return { overall: rollup, byRegion: [{ region, ...rollup }] };
}

describe('isChallengeUnlocked', () => {
  it('unlocks when the family is fully mastered in the region (mastered === total)', () => {
    const m = masteryFor('AF', { flags: [3, 3] });
    expect(isChallengeUnlocked(m, 'flags', 'AF')).toBe(true);
  });

  it('stays locked when the family is only partly mastered', () => {
    const m = masteryFor('AF', { flags: [2, 3] });
    expect(isChallengeUnlocked(m, 'flags', 'AF')).toBe(false);
  });

  it('is locked for an empty (all-unseen) tally, not a false "0 === 0" pass', () => {
    const m = masteryFor('AF', { flags: [0, 0] });
    expect(isChallengeUnlocked(m, 'flags', 'AF')).toBe(false);
  });

  it('is locked for a region or family not present in the rollup', () => {
    const m = masteryFor('AF', { flags: [3, 3] });
    expect(isChallengeUnlocked(m, 'flags', 'EU')).toBe(false);
    expect(isChallengeUnlocked(m, 'map', 'AF')).toBe(false);
  });

  it('composes with computeFamilyMastery: both directions mastered ⇒ unlocked', () => {
    const NOW = 1_000_000;
    const DAY = 86_400_000;
    const sr = (itemKey: string): SRItem => ({
      itemKey,
      repetitions: 2,
      easeFactor: 2.5,
      intervalDays: 6,
      dueAt: NOW + 6 * DAY, // not overdue → mastered
      lapses: 0,
      lastReviewedAt: NOW - DAY,
    });
    const countries: MasteryCountry[] = [
      { iso2: 'AA', region: 'AF' },
      { iso2: 'BB', region: 'AF' },
    ];
    const bothDirs = [
      sr('flag-to-country:AA'),
      sr('country-to-flag:AA'),
      sr('flag-to-country:BB'),
      sr('country-to-flag:BB'),
    ];
    const unlocked = computeFamilyMastery(bothDirs, countries, { now: NOW });
    expect(isChallengeUnlocked(unlocked, 'flags', 'AF')).toBe(true);

    // Drop one direction of BB → BB flags falls to "learning" → not fully mastered → locked.
    const partial = computeFamilyMastery(bothDirs.slice(0, 3), countries, { now: NOW });
    expect(isChallengeUnlocked(partial, 'flags', 'AF')).toBe(false);
  });
});

// --- availableChallenges (the Home invitation surface) ----------------------------------------

/** Build a multi-region mastery result from per-region per-family [mastered, total] tallies. */
function masteryOf(
  regions: Record<string, Partial<Record<MasteryFamily, [number, number]>>>,
): FamilyMasteryResult {
  const rollup = { fullyMastered: 0, inProgress: 0, unseen: 0, blended: 0, total: 0 };
  const byRegion = Object.entries(regions).map(([region, tallies]) => {
    const families: FamilyTally[] = FAMILIES.map((f) => {
      const [mastered, total] = tallies[f.key] ?? [0, 0];
      return { family: f.key, mastered, learning: 0, unseen: Math.max(0, total - mastered), total };
    });
    return { region, families, ...rollup };
  });
  return { overall: { families: [], ...rollup }, byRegion };
}

const NONE: ReadonlySet<string> = new Set();

describe('availableChallenges', () => {
  it('lists every fully-mastered family × region as attemptable when none are certified/spent', () => {
    // Oceania: map + flags fully mastered, capitals partial. Africa: flags + capitals full, map at 0.
    const m = masteryOf({
      Oceania: { map: [5, 5], flags: [5, 5], capitals: [3, 5] },
      Africa: { map: [0, 10], flags: [10, 10], capitals: [10, 10] },
    });
    const avail = availableChallenges(m, NONE, NONE);
    expect(avail).toEqual([
      { family: 'map', region: 'Oceania' },
      { family: 'flags', region: 'Oceania' },
      { family: 'flags', region: 'Africa' },
      { family: 'capitals', region: 'Africa' },
    ]);
  });

  it('is empty when nothing is fully mastered', () => {
    const m = masteryOf({ Oceania: { map: [4, 5], flags: [2, 5], capitals: [0, 5] } });
    expect(availableChallenges(m, NONE, NONE)).toEqual([]);
  });

  it('excludes already-certified and already-spent-today runs', () => {
    const m = masteryOf({
      Oceania: { flags: [5, 5], capitals: [5, 5] },
      Africa: { flags: [10, 10] },
    });
    const certified = new Set(['flags|Oceania']); // already earned → no longer offered
    const spentToday = new Set(['capitals|Oceania']); // today's attempt used → on cooldown
    expect(availableChallenges(m, certified, spentToday)).toEqual([
      { family: 'flags', region: 'Africa' },
    ]);
  });

  it('never offers a run whose family has an empty (0/0) tally', () => {
    const m = masteryOf({ Oceania: { flags: [0, 0] } });
    expect(availableChallenges(m, NONE, NONE)).toEqual([]);
  });
});

// --- buildChallengeQueue -----------------------------------------------------------------------

describe('buildChallengeQueue', () => {
  it('has one slot per country per direction — 2 × N for flags', () => {
    const q = buildChallengeQueue('flags', AF, seeded());
    expect(q).toHaveLength(6); // 3 countries × 2 directions
    const keys = q.map((s) => `${s.mode}:${s.iso2}`).sort();
    expect(new Set(keys).size).toBe(6); // every (mode, iso2) exactly once
    expect(new Set(q.map((s) => s.mode))).toEqual(new Set(['flag-to-country', 'country-to-flag']));
  });

  it('drops geometry-less countries from BOTH map directions (like mastery does)', () => {
    const withNoGeo = [
      mk('AA', 'AF'),
      mk('BB', 'AF'),
      mk('TV', 'AF', 'S2', { hasGeometry: false }),
    ];
    const mapQ = buildChallengeQueue('map', withNoGeo, seeded());
    expect(mapQ).toHaveLength(4); // 2 eligible countries × 2 map directions
    expect(mapQ.some((s) => s.iso2 === 'TV')).toBe(false);
    // …but flags keeps every country (no geometry needed).
    expect(buildChallengeQueue('flags', withNoGeo, seeded())).toHaveLength(6);
  });

  it('is deterministic given the same seeded RNG', () => {
    expect(buildChallengeQueue('flags', AF, mulberry32(7))).toEqual(
      buildChallengeQueue('flags', AF, mulberry32(7)),
    );
  });
});

describe('familyModes', () => {
  it('returns the two direction modes of a family', () => {
    expect(familyModes('flags')).toEqual(['flag-to-country', 'country-to-flag']);
    expect(familyModes('capitals')).toEqual(['capital-to-country', 'country-to-capital']);
  });
});

// --- challengeSlotCount (the offer modal's "N Questions" stake) --------------------------------

describe('challengeSlotCount', () => {
  it('equals the built queue length (2 × N) without shuffling', () => {
    expect(challengeSlotCount('flags', AF)).toBe(6); // 3 countries × 2 directions
    expect(challengeSlotCount('flags', AF)).toBe(buildChallengeQueue('flags', AF, seeded()).length);
  });

  it('excludes geometry-less countries from BOTH map directions, like the queue', () => {
    const withNoGeo = [
      mk('AA', 'AF'),
      mk('BB', 'AF'),
      mk('TV', 'AF', 'S2', { hasGeometry: false }),
    ];
    expect(challengeSlotCount('map', withNoGeo)).toBe(4); // 2 eligible × 2 map directions
    expect(challengeSlotCount('flags', withNoGeo)).toBe(6); // flags need no geometry
  });
});

// --- buildChallengeQuestion (fixed full-region options) ----------------------------------------

describe('buildChallengeQuestion', () => {
  it('gives country-pick modes the WHOLE region as fixed options', () => {
    for (const mode of [
      'flag-to-country',
      'country-to-flag',
      'capital-to-country',
      'map-highlight',
    ] as const) {
      const q = buildChallengeQuestion(mode, AF[0], AF);
      expect(q.options?.map((c) => c.iso2)).toEqual(['AA', 'BB', 'CC']);
      expect(q.options).toHaveLength(AF.length);
      expect(q.attributeOptions).toBeUndefined();
    }
  });

  it('gives country-to-capital an attribute option per continent capital', () => {
    const q = buildChallengeQuestion('country-to-capital', AF[1], AF);
    expect(q.options).toBeUndefined();
    expect(q.attributeOptions).toHaveLength(AF.length);
    expect(q.attributeOptions?.map((o) => o.id)).toEqual(['AA', 'BB', 'CC']);
    expect(q.correctOptionId).toBe('BB');
    expect(q.attributeOptions?.find((o) => o.id === 'BB')?.label.en).toBe('BB-cap');
  });

  it('gives map-locate no options (the map is the input surface)', () => {
    const q = buildChallengeQuestion('map-locate', AF[0], AF);
    expect(q.options).toBeUndefined();
    expect(q.attributeOptions).toBeUndefined();
    expect(q.itemKey).toBe('map-locate:AA');
  });
});

// --- ChallengeSession --------------------------------------------------------------------------

/** Drive a run to the end, answering correctly except (optionally) a miss at slot `wrongAt`. */
function drive(
  session: ChallengeSession,
  wrongAt = -1,
): { asked: Question[]; optionSizes: number[] } {
  const asked: Question[] = [];
  const optionSizes: number[] = [];
  let q: Question | null;
  let i = 0;
  while ((q = session.next())) {
    asked.push(q);
    if (q.options) optionSizes.push(q.options.length);
    session.submit(i === wrongAt ? null : q.answer);
    i++;
  }
  return { asked, optionSizes };
}

describe('ChallengeSession — clear-the-board', () => {
  it('passes on a clean sweep of the whole board (both directions)', () => {
    const s = createChallenge({ family: 'flags', region: 'AF', countries: AF, rng: seeded() });
    expect(s.total).toBe(6);
    const { asked } = drive(s);

    expect(asked).toHaveLength(6);
    expect(s.isFinished()).toBe(true);
    expect(s.passed).toBe(true);
    expect(s.state.status).toBe('finished');
    expect(s.state.failed).toBe(false);
    expect(s.state.cleared).toBe(6);

    const summary = s.summary();
    expect(summary).toMatchObject({
      type: 'challenge',
      family: 'flags',
      region: 'AF',
      passed: true,
    });
    expect(summary.cleared).toBe(6);
    expect(summary.missed).toBeNull();

    // Every country was asked in BOTH directions.
    const keys = summary.results.map((r) => r.itemKey).sort();
    expect(keys).toEqual(
      [
        'country-to-flag:AA',
        'country-to-flag:BB',
        'country-to-flag:CC',
        'flag-to-country:AA',
        'flag-to-country:BB',
        'flag-to-country:CC',
      ].sort(),
    );
  });

  it('is one life: a single miss ends the run immediately (no recycle, no pass)', () => {
    const s = createChallenge({ family: 'flags', region: 'AF', countries: AF, rng: seeded() });
    const { asked } = drive(s, 2); // miss the 3rd question

    expect(asked).toHaveLength(3); // stopped right after the miss — remaining slots never asked
    expect(s.isFinished()).toBe(true);
    expect(s.passed).toBe(false);
    expect(s.state.failed).toBe(true);
    expect(s.state.cleared).toBe(2);
    expect(s.next()).toBeNull();

    const summary = s.summary();
    expect(summary.passed).toBe(false);
    expect(summary.cleared).toBe(2);
    expect(summary.missed?.iso2).toBe(asked[2].answer.iso2);
  });

  it('keeps the option pool at full-region size for every question (never shrinks)', () => {
    const s = createChallenge({ family: 'flags', region: 'AF', countries: AF, rng: seeded() });
    const { optionSizes } = drive(s);
    expect(optionSizes).toHaveLength(6);
    expect(optionSizes.every((n) => n === AF.length)).toBe(true);
  });

  it('computes answerMs from the injected clock', () => {
    let t = 1000;
    const now = () => t;
    const s = createChallenge({ family: 'flags', region: 'AF', countries: AF, rng: seeded(), now });
    const q = s.next()!;
    t = 1350; // 350ms to answer
    const result = s.submit(q.answer);
    expect(result.answerMs).toBe(350);
  });

  it('throws when the family × region has no eligible countries', () => {
    const noGeo = [mk('TV', 'AF', 'S1', { hasGeometry: false })];
    expect(() => createChallenge({ family: 'map', region: 'AF', countries: noGeo })).toThrow(
      /no eligible countries/,
    );
  });

  it('throws when submitting with no active question', () => {
    const s = createChallenge({ family: 'flags', region: 'AF', countries: AF, rng: seeded() });
    expect(() => s.submit('AA')).toThrow(/no active question/);
  });

  it('drives the capitals family (both a country-pick and an attribute direction) to a pass', () => {
    const s = createChallenge({ family: 'capitals', region: 'AF', countries: AF, rng: seeded() });
    expect(s.total).toBe(6);
    drive(s);
    expect(s.passed).toBe(true);
    const modes = new Set(s.summary().results.map((r) => r.itemKey.split(':')[0]));
    expect(modes).toEqual(new Set(['capital-to-country', 'country-to-capital']));
  });
});
