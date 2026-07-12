import { describe, it, expect } from 'vitest';
import { geoNaturalEarth1 } from 'd3-geo';
import { MAP_PROJECTIONS, type MapProjection } from '../../data';
import { projectionFor } from './projection';

// A point far from the origin projects differently under different projections, so
// comparing a projected coordinate is a cheap way to prove each name maps to a
// distinct projection.
const SAMPLE: [number, number] = [100, 60];

// The planar projections only — `'globe'` is a WebGL renderer, not a D3 projection, so
// `projectionFor('globe')` intentionally returns the Natural-Earth flat fallback.
const PLANAR = MAP_PROJECTIONS.filter((p) => p !== 'globe');

describe('projectionFor', () => {
  it('returns a working projection for every offered name', () => {
    for (const name of MAP_PROJECTIONS) {
      const projected = projectionFor(name)(SAMPLE);
      expect(projected).not.toBeNull();
      expect(Number.isFinite(projected![0])).toBe(true);
      expect(Number.isFinite(projected![1])).toBe(true);
    }
  });

  it('gives distinct results for distinct planar projections', () => {
    const seen = new Set<string>();
    for (const name of PLANAR) {
      const p = projectionFor(name)(SAMPLE)!;
      seen.add(`${p[0].toFixed(3)},${p[1].toFixed(3)}`);
    }
    // Each planar projection places the sample point differently.
    expect(seen.size).toBe(PLANAR.length);
  });

  it('falls back to Natural Earth for an unknown name and for the globe', () => {
    const natural = geoNaturalEarth1()(SAMPLE)!;
    for (const name of ['bogus', 'globe'] as MapProjection[]) {
      const fallback = projectionFor(name)(SAMPLE)!;
      expect(fallback[0]).toBeCloseTo(natural[0]);
      expect(fallback[1]).toBeCloseTo(natural[1]);
    }
  });
});
