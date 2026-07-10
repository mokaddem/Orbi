import { describe, it, expect } from 'vitest';
import { geoNaturalEarth1 } from 'd3-geo';
import { MAP_PROJECTIONS, type MapProjection } from '../../data';
import { projectionFor } from './projection';

// A point far from the origin projects differently under different projections, so
// comparing a projected coordinate is a cheap way to prove each name maps to a
// distinct projection.
const SAMPLE: [number, number] = [100, 60];

describe('projectionFor', () => {
  it('returns a working projection for every offered name', () => {
    for (const name of MAP_PROJECTIONS) {
      const projected = projectionFor(name)(SAMPLE);
      expect(projected).not.toBeNull();
      expect(Number.isFinite(projected![0])).toBe(true);
      expect(Number.isFinite(projected![1])).toBe(true);
    }
  });

  it('gives distinct results for distinct projections', () => {
    const seen = new Set<string>();
    for (const name of MAP_PROJECTIONS) {
      const p = projectionFor(name)(SAMPLE)!;
      seen.add(`${p[0].toFixed(3)},${p[1].toFixed(3)}`);
    }
    // All four projections place the sample point differently.
    expect(seen.size).toBe(MAP_PROJECTIONS.length);
  });

  it('falls back to Natural Earth for an unknown name', () => {
    const fallback = projectionFor('bogus' as MapProjection)(SAMPLE)!;
    const natural = geoNaturalEarth1()(SAMPLE)!;
    expect(fallback[0]).toBeCloseTo(natural[0]);
    expect(fallback[1]).toBeCloseTo(natural[1]);
  });
});
