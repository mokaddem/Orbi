import { describe, it, expect } from 'vitest';
import {
  nearestCountryWithinCap,
  isEnclaveOf,
  lenientLocatePick,
  type CentroidTarget,
} from './map-hit';

// Three centroids on the logical surface; distances are easy to reason about.
const targets: CentroidTarget[] = [
  { iso2: 'AA', cx: 100, cy: 100 },
  { iso2: 'BB', cx: 200, cy: 100 },
  { iso2: 'CC', cx: 500, cy: 400 },
];

describe('nearestCountryWithinCap', () => {
  it('snaps a near-miss to the closest centroid within the cap', () => {
    // (110, 100) is 10 from AA and 90 from BB → AA.
    expect(nearestCountryWithinCap(110, 100, targets, 40)).toBe('AA');
  });

  it('returns null when the tap is beyond the cap (an obvious miss is a no-op)', () => {
    // Nearest centroid (AA) is ~141 away; a 40-unit cap rejects it.
    expect(nearestCountryWithinCap(200, 200, targets, 40)).toBeNull();
  });

  it('picks the closer of two candidates, not merely the first in range', () => {
    // (170, 100): 70 from AA, 30 from BB → BB even though AA comes first.
    expect(nearestCountryWithinCap(170, 100, targets, 100)).toBe('BB');
  });

  it('resolves a tap exactly on a centroid to that country', () => {
    expect(nearestCountryWithinCap(500, 400, targets, 5)).toBe('CC');
  });

  it('includes a centroid sitting exactly at the cap distance', () => {
    // Exactly 40 away from AA, cap 40 → still included (<=).
    expect(nearestCountryWithinCap(140, 100, targets, 40)).toBe('AA');
  });

  it('skips centroids with non-finite coordinates', () => {
    const withBad: CentroidTarget[] = [
      { iso2: 'BAD', cx: NaN, cy: 100 },
      { iso2: 'OK', cx: 105, cy: 100 },
    ];
    expect(nearestCountryWithinCap(100, 100, withBad, 40)).toBe('OK');
  });

  it('returns null for an empty target list', () => {
    expect(nearestCountryWithinCap(100, 100, [], 40)).toBeNull();
  });

  it('returns null for a degenerate tap or non-positive cap', () => {
    expect(nearestCountryWithinCap(NaN, 100, targets, 40)).toBeNull();
    expect(nearestCountryWithinCap(100, 100, targets, 0)).toBeNull();
    expect(nearestCountryWithinCap(100, 100, targets, -5)).toBeNull();
  });
});

describe('isEnclaveOf', () => {
  it('knows the curated enclave → host relationships (directional)', () => {
    expect(isEnclaveOf('VA', 'IT')).toBe(true); // Vatican is inside Italy
    expect(isEnclaveOf('IT', 'VA')).toBe(false); // …but not the reverse
    expect(isEnclaveOf('LI', 'CH')).toBe(true);
    expect(isEnclaveOf('LI', 'AT')).toBe(true); // two hosts
    expect(isEnclaveOf('FR', 'DE')).toBe(false); // ordinary neighbours are not enclaves
  });
});

describe('lenientLocatePick', () => {
  it('passes an exact hit (or no target) straight through', () => {
    expect(lenientLocatePick('IT', 'IT', false)).toBe('IT');
    expect(lenientLocatePick('FR', null, false)).toBe('FR');
    expect(lenientLocatePick(null, 'IT', false)).toBeNull();
  });

  it('accepts the asked micro-state when the tap was within its dot accept radius', () => {
    // Wanted Vatican, the tap resolved to Italy but landed within Vatican's dot radius → Vatican.
    expect(lenientLocatePick('IT', 'VA', true)).toBe('VA');
  });

  it('accepts the host when the tap hit its enclave (both enclave directions covered)', () => {
    // Wanted Italy, tapped Vatican (its enclave) → Italy. Not near Vatican's *own* asked dot here.
    expect(lenientLocatePick('VA', 'IT', false)).toBe('IT');
    // Wanted Vatican, tapped Italy's body far from Vatican → stays Italy (a genuine miss).
    expect(lenientLocatePick('IT', 'VA', false)).toBe('IT');
  });

  it('never turns a tap into an unrelated country', () => {
    // Wanted France, tapped Germany, not near France's dot, not an enclave pair → Germany stands.
    expect(lenientLocatePick('DE', 'FR', false)).toBe('DE');
  });
});
