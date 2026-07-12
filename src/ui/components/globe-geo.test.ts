import { describe, it, expect } from 'vitest';
import type { Geometry } from 'geojson';
import {
  TEX_W,
  TEX_H,
  crossesAntimeridian,
  fitDistanceForAngularRadius,
  lonLatToTexPx,
  lonLatToVec3,
  regionAngularRadius,
  vec3ToLonLat,
} from './globe-geo';

describe('lonLatToVec3 / vec3ToLonLat', () => {
  it('round-trips lon/lat through the sphere (away from the poles)', () => {
    const samples: [number, number][] = [
      [0, 0],
      [100, 60],
      [-55, -12],
      [139, 35],
      [179, 10],
      [-179, -10],
    ];
    for (const [lon, lat] of samples) {
      const [x, y, z] = lonLatToVec3(lon, lat, 1);
      const [lon2, lat2] = vec3ToLonLat(x, y, z);
      expect(lon2).toBeCloseTo(lon, 4);
      expect(lat2).toBeCloseTo(lat, 4);
    }
  });

  it('places lon/lat=0,0 on the +X axis (matches SphereGeometry UVs)', () => {
    const [x, y, z] = lonLatToVec3(0, 0, 1);
    expect(x).toBeCloseTo(1, 6);
    expect(y).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(0, 6);
  });

  it('normalises the input vector before inverting', () => {
    const [x, y, z] = lonLatToVec3(40, 20, 5); // radius 5
    const [lon, lat] = vec3ToLonLat(x, y, z);
    expect(lon).toBeCloseTo(40, 4);
    expect(lat).toBeCloseTo(20, 4);
  });
});

describe('lonLatToTexPx', () => {
  it('maps the equirectangular corners and centre', () => {
    expect(lonLatToTexPx(-180, 90)).toEqual([0, 0]);
    expect(lonLatToTexPx(180, -90)).toEqual([TEX_W, TEX_H]);
    expect(lonLatToTexPx(0, 0)).toEqual([TEX_W / 2, TEX_H / 2]);
  });
});

describe('crossesAntimeridian', () => {
  const poly = (ring: [number, number][]): Geometry => ({ type: 'Polygon', coordinates: [ring] });

  it('is true for a ring spanning more than 180° of longitude', () => {
    expect(
      crossesAntimeridian(
        poly([
          [-170, 0],
          [170, 0],
          [170, 10],
          [-170, 10],
        ]),
      ),
    ).toBe(true);
  });

  it('is false for a compact ring', () => {
    expect(
      crossesAntimeridian(
        poly([
          [-10, 0],
          [10, 0],
          [10, 10],
          [-10, 10],
        ]),
      ),
    ).toBe(false);
  });

  it('is false for non-polygonal geometry', () => {
    expect(crossesAntimeridian({ type: 'Point', coordinates: [0, 0] })).toBe(false);
  });
});

describe('regionAngularRadius', () => {
  it('is 0 for a single point at the centroid', () => {
    expect(regionAngularRadius([10, 20], [[10, 20]])).toBeCloseTo(0, 6);
  });

  it('returns the farthest member distance (≈10° here)', () => {
    const r = regionAngularRadius(
      [0, 0],
      [
        [0, 0],
        [10, 0],
        [5, 0],
      ],
    );
    expect(r).toBeCloseTo((10 * Math.PI) / 180, 3);
  });

  it('is 0 for no members', () => {
    expect(regionAngularRadius([0, 0], [])).toBe(0);
  });
});

describe('fitDistanceForAngularRadius', () => {
  it('clamps a point-region up to the minimum framing distance', () => {
    expect(fitDistanceForAngularRadius(0)).toBe(1.85);
  });

  it('clamps a hemisphere-wide region to the world distance', () => {
    expect(fitDistanceForAngularRadius(1.5)).toBe(3.2);
  });

  it('increases monotonically with angular radius between the clamps', () => {
    const a = fitDistanceForAngularRadius(0.3);
    const b = fitDistanceForAngularRadius(0.6);
    expect(a).toBeGreaterThan(1.9);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThanOrEqual(3.2);
  });
});
