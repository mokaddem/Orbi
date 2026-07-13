import { describe, it, expect } from 'vitest';
import {
  MASTERY_MIN_REPETITIONS,
  computeFamilyMastery,
  computeMastery,
  isItemMastered,
  masteryFraction,
  regionFamilyPracticePool,
  type FamilyMasteryResult,
  type FamilyTally,
  type MasteryCountry,
} from './mastery';
import { CAPITAL_MODES, type MasteryFamily } from './modes';
import type { SRItem } from '../data/persistence/types';

const NOW = 1_000_000;
const DAY = 86_400_000;

/** Build an SRItem with sensible defaults, overriding what a test cares about. */
function sr(itemKey: string, over: Partial<SRItem> = {}): SRItem {
  return {
    itemKey,
    repetitions: MASTERY_MIN_REPETITIONS,
    easeFactor: 2.5,
    intervalDays: 6,
    dueAt: NOW + 6 * DAY, // future by default → not overdue
    lapses: 0,
    lastReviewedAt: NOW - DAY,
    ...over,
  };
}

describe('isItemMastered', () => {
  it('is mastered at the repetition bar with a future due date', () => {
    expect(
      isItemMastered(sr('flag-to-country:FR', { repetitions: 2, dueAt: NOW + DAY }), NOW),
    ).toBe(true);
  });

  it('is not mastered below the repetition bar', () => {
    expect(
      isItemMastered(sr('flag-to-country:FR', { repetitions: 1, dueAt: NOW + DAY }), NOW),
    ).toBe(false);
  });

  it('is not mastered while overdue, however many repetitions', () => {
    expect(
      isItemMastered(sr('flag-to-country:FR', { repetitions: 9, dueAt: NOW - DAY }), NOW),
    ).toBe(false);
  });

  it('treats due-exactly-now as overdue (strictly in the future)', () => {
    expect(isItemMastered(sr('flag-to-country:FR', { repetitions: 5, dueAt: NOW }), NOW)).toBe(
      false,
    );
  });
});

describe('masteryFraction', () => {
  it('is 0 for an empty denominator', () => {
    expect(masteryFraction({ mastered: 0, learning: 0, unseen: 0, total: 0 })).toBe(0);
  });

  it('is mastered/total otherwise', () => {
    expect(masteryFraction({ mastered: 3, learning: 1, unseen: 6, total: 10 })).toBeCloseTo(0.3);
  });
});

describe('computeMastery', () => {
  const countries: MasteryCountry[] = [
    { iso2: 'FR', region: 'Europe' },
    { iso2: 'DE', region: 'Europe' },
    { iso2: 'NG', region: 'Africa' },
    { iso2: 'KE', region: 'Africa' },
    { iso2: 'JP', region: 'Asia' },
  ];

  it('marks every country unseen when there is no SR state', () => {
    const { overall, byRegion } = computeMastery([], countries, { now: NOW });
    expect(overall).toEqual({ mastered: 0, learning: 0, unseen: 5, total: 5 });
    // Every region present, all unseen.
    expect(byRegion.map((r) => r.region).sort()).toEqual(['Africa', 'Asia', 'Europe']);
    expect(byRegion.every((r) => r.mastered === 0 && r.unseen === r.total)).toBe(true);
  });

  it('is lenient: any one mastered mode masters the country', () => {
    const items = [
      // FR mastered in one mode, still learning in another → country is mastered.
      sr('flag-to-country:FR', { repetitions: 3, dueAt: NOW + 10 * DAY }),
      sr('map-locate:FR', { repetitions: 0, dueAt: NOW, lapses: 2 }),
    ];
    const { overall } = computeMastery(items, countries, { now: NOW });
    expect(overall.mastered).toBe(1);
  });

  it('counts a seen-but-not-mastered country as learning', () => {
    const items = [sr('flag-to-country:NG', { repetitions: 1, dueAt: NOW + DAY })];
    const { overall } = computeMastery(items, countries, { now: NOW });
    expect(overall).toMatchObject({ mastered: 0, learning: 1, unseen: 4, total: 5 });
  });

  it('ignores capital-mode SR items entirely (Phase 24 stays out of mastery)', () => {
    // A country only ever played in the capital modes must NOT count as seen or mastered.
    const items = [
      sr('capital-to-country:FR', { repetitions: 5, dueAt: NOW + 30 * DAY }),
      sr('country-to-capital:FR', { repetitions: 5, dueAt: NOW + 30 * DAY }),
    ];
    const { overall } = computeMastery(items, countries, { now: NOW });
    expect(overall).toEqual({ mastered: 0, learning: 0, unseen: 5, total: 5 });
  });

  it('computes a separate capital rollup with modes: CAPITAL_MODES', () => {
    const items = [
      // FR mastered in a capital mode → counts here; DE only in an identity mode → does not.
      sr('capital-to-country:FR', { repetitions: 5, dueAt: NOW + 30 * DAY }),
      sr('flag-to-country:DE', { repetitions: 5, dueAt: NOW + 30 * DAY }),
      sr('country-to-capital:NG', { repetitions: 0, dueAt: NOW, lapses: 1 }), // seen, learning
    ];
    const { overall } = computeMastery(items, countries, { now: NOW, modes: CAPITAL_MODES });
    // FR mastered, NG learning, DE (identity-only) unseen, plus KE + JP unseen.
    expect(overall).toEqual({ mastered: 1, learning: 1, unseen: 3, total: 5 });
  });

  it('demotes a lapsed country from mastered back to learning', () => {
    const mastered = [sr('flag-to-country:JP', { repetitions: 4, dueAt: NOW + 30 * DAY })];
    expect(computeMastery(mastered, countries, { now: NOW }).overall.mastered).toBe(1);
    // After a lapse SM-2 resets repetitions to 0 and dueAt to now → learning, not mastered.
    const lapsed = [sr('flag-to-country:JP', { repetitions: 0, dueAt: NOW, lapses: 1 })];
    const roll = computeMastery(lapsed, countries, { now: NOW }).overall;
    expect(roll).toMatchObject({ mastered: 0, learning: 1 });
  });

  it('partitions per region and always sums to the total', () => {
    const items = [
      sr('flag-to-country:FR', { repetitions: 3, dueAt: NOW + 10 * DAY }), // Europe mastered
      sr('map-highlight:NG', { repetitions: 1, dueAt: NOW + DAY }), // Africa learning
    ];
    const { overall, byRegion } = computeMastery(items, countries, { now: NOW });
    for (const r of [...byRegion, overall]) {
      expect(r.mastered + r.learning + r.unseen).toBe(r.total);
    }
    const europe = byRegion.find((r) => r.region === 'Europe')!;
    expect(europe).toMatchObject({ mastered: 1, learning: 0, unseen: 1, total: 2 });
    const africa = byRegion.find((r) => r.region === 'Africa')!;
    expect(africa).toMatchObject({ mastered: 0, learning: 1, unseen: 1, total: 2 });
  });

  it('orders regions least-complete first', () => {
    const items = [
      // Europe: 2/2 mastered (100%). Africa: 0/2 (0%). Asia: untouched (0%, but fewer to learn).
      sr('flag-to-country:FR', { repetitions: 3, dueAt: NOW + 10 * DAY }),
      sr('flag-to-country:DE', { repetitions: 3, dueAt: NOW + 10 * DAY }),
    ];
    const order = computeMastery(items, countries, { now: NOW }).byRegion.map((r) => r.region);
    // Europe (100%) must come last; the two 0% regions lead, most-to-learn first (Africa: 2).
    expect(order[order.length - 1]).toBe('Europe');
    expect(order).toEqual(['Africa', 'Asia', 'Europe']);
  });

  it('ignores malformed item keys', () => {
    const items = [sr('not-a-mode:FR'), sr(':FR'), sr('flag-to-country:')];
    const { overall } = computeMastery(items, countries, { now: NOW });
    expect(overall.mastered + overall.learning).toBe(0);
    expect(overall.unseen).toBe(5);
  });
});

describe('computeFamilyMastery (Phase 41)', () => {
  // FR & DE have geometry; TV (Tuvalu) has none, so the Map family is N/A for it.
  const countries: MasteryCountry[] = [
    { iso2: 'FR', region: 'Europe' },
    { iso2: 'DE', region: 'Europe' },
    { iso2: 'TV', region: 'Oceania', hasGeometry: false },
  ];
  const fam = (r: FamilyMasteryResult, key: MasteryFamily): FamilyTally =>
    r.overall.families.find((f) => f.family === key)!;

  it('starts everything unseen; Map excludes the geometry-less country from its denominator', () => {
    const r = computeFamilyMastery([], countries, { now: NOW });
    expect(r.overall.total).toBe(3);
    expect(r.overall.fullyMastered).toBe(0);
    expect(r.overall.inProgress).toBe(0);
    expect(r.overall.unseen).toBe(3);
    expect(r.overall.blended).toBe(0);
    expect(fam(r, 'map').total).toBe(2); // FR, DE — TV excluded (no geometry)
    expect(fam(r, 'flags').total).toBe(3);
    expect(fam(r, 'capitals').total).toBe(3);
    expect(fam(r, 'flags').unseen).toBe(3);
  });

  it('masters a family only when BOTH directions clear the bar; one direction is "learning"', () => {
    const items = [
      sr('map-highlight:FR'),
      sr('map-locate:FR'), // FR Map: both directions → mastered
      sr('flag-to-country:FR'), // FR Flags: one direction only → learning
    ];
    const r = computeFamilyMastery(items, countries, { now: NOW });
    expect(fam(r, 'map').mastered).toBe(1);
    expect(fam(r, 'map').unseen).toBe(1); // DE
    expect(fam(r, 'flags').learning).toBe(1); // FR half-done
    expect(fam(r, 'flags').mastered).toBe(0);
    expect(r.overall.fullyMastered).toBe(0);
    expect(r.overall.inProgress).toBe(1); // FR has activity but isn't fully mastered
    expect(r.overall.unseen).toBe(2); // DE, TV untouched
    // Blended = mastered cells (FR Map = 1) / applicable cells (FR 3 + DE 3 + TV 2 = 8).
    expect(r.overall.blended).toBeCloseTo(1 / 8);
  });

  it('counts a country fully mastered only when all three families are mastered', () => {
    const all = [
      'map-highlight',
      'map-locate',
      'flag-to-country',
      'country-to-flag',
      'capital-to-country',
      'country-to-capital',
    ];
    const items = all.map((m) => sr(`${m}:FR`));
    const r = computeFamilyMastery(items, countries, { now: NOW });
    expect(r.overall.fullyMastered).toBe(1);
    expect(r.overall.blended).toBeCloseTo(3 / 8); // FR's 3 cells of 8 applicable
  });

  it('lets a geometry-less country be fully mastered via Flags + Capitals (Map N/A)', () => {
    const items = [
      'flag-to-country',
      'country-to-flag',
      'capital-to-country',
      'country-to-capital',
    ].map((m) => sr(`${m}:TV`));
    const r = computeFamilyMastery(items, countries, { now: NOW });
    expect(r.overall.fullyMastered).toBe(1); // TV counts — Map doesn't apply to it
    // TV contributes 2 mastered of its 2 applicable cells.
    expect(r.overall.blended).toBeCloseTo(2 / 8);
  });

  it('demotes a family from mastered to learning when one direction lapses (overdue)', () => {
    const items = [
      sr('map-highlight:FR'),
      sr('map-locate:FR', { dueAt: NOW - DAY }), // lapsed → not mastered
    ];
    const r = computeFamilyMastery(items, countries, { now: NOW });
    expect(fam(r, 'map').mastered).toBe(0);
    expect(fam(r, 'map').learning).toBe(1);
  });

  it('partitions by region and orders least-complete (lowest blended) first', () => {
    // Fully master both Europe countries; leave Oceania (TV) untouched.
    const euro = ['FR', 'DE'].flatMap((iso) =>
      [
        'map-highlight',
        'map-locate',
        'flag-to-country',
        'country-to-flag',
        'capital-to-country',
        'country-to-capital',
      ].map((m) => sr(`${m}:${iso}`)),
    );
    const r = computeFamilyMastery(euro, countries, { now: NOW });
    const europe = r.byRegion.find((x) => x.region === 'Europe')!;
    const oceania = r.byRegion.find((x) => x.region === 'Oceania')!;
    expect(europe.fullyMastered).toBe(2);
    expect(europe.blended).toBe(1);
    expect(oceania.blended).toBe(0);
    expect(r.byRegion[0].region).toBe('Oceania'); // least-complete first
  });
});

describe('regionFamilyPracticePool', () => {
  const c = (iso2: string, region: string, hasGeometry?: boolean): MasteryCountry => ({
    iso2,
    region,
    ...(hasGeometry === undefined ? {} : { hasGeometry }),
  });

  it('returns null when the family is fully mastered in the region', () => {
    const countries = [c('FR', 'Europe'), c('DE', 'Europe')];
    const items = ['FR', 'DE'].flatMap((iso) => [
      sr(`flag-to-country:${iso}`),
      sr(`country-to-flag:${iso}`),
    ]);
    expect(regionFamilyPracticePool(items, countries, 'Europe', 'flags', { now: NOW })).toBeNull();
  });

  it('drills the weaker direction over learning + unseen, weakest-first', () => {
    const countries = [c('FR', 'Europe'), c('DE', 'Europe'), c('IT', 'Europe')];
    const items = [
      // FR: both directions mastered → excluded from the pool entirely.
      sr('flag-to-country:FR'),
      sr('country-to-flag:FR'),
      // DE: recognises the flag but can't produce it — country-to-flag lapsed & overdue.
      sr('flag-to-country:DE'),
      sr('country-to-flag:DE', { repetitions: 0, dueAt: NOW - DAY, lapses: 3 }),
      // IT: never seen in either direction.
    ];
    const pool = regionFamilyPracticePool(items, countries, 'Europe', 'flags', { now: NOW })!;
    // country-to-flag has 2 not-mastered (DE, IT) vs flag-to-country's 1 (IT) → weaker direction.
    expect(pool.mode).toBe('country-to-flag');
    // Seen-but-weak (DE, overdue) before never-seen (IT); FR omitted (already mastered).
    expect(pool.iso2s).toEqual(['DE', 'IT']);
  });

  it('breaks a direction tie toward the family’s first mode', () => {
    const countries = [c('FR', 'Europe'), c('DE', 'Europe')]; // both unseen in flags
    const pool = regionFamilyPracticePool([], countries, 'Europe', 'flags', { now: NOW })!;
    expect(pool.mode).toBe('flag-to-country'); // FAMILIES[flags].modes[0]
    expect([...pool.iso2s].sort()).toEqual(['DE', 'FR']);
  });

  it('excludes geometry-less countries from the Map family', () => {
    const countries = [c('FJ', 'Oceania', true), c('TV', 'Oceania', false)]; // both unseen
    const pool = regionFamilyPracticePool([], countries, 'Oceania', 'map', { now: NOW })!;
    expect(pool.mode).toBe('map-highlight'); // FAMILIES[map].modes[0], tie
    expect(pool.iso2s).toEqual(['FJ']); // TV has no map geometry → never drilled
  });

  it('scopes to the requested region only', () => {
    const countries = [c('FR', 'Europe'), c('BR', 'Americas')]; // both unseen in flags
    const pool = regionFamilyPracticePool([], countries, 'Europe', 'flags', { now: NOW })!;
    expect(pool.iso2s).toEqual(['FR']); // Americas ignored
  });
});
