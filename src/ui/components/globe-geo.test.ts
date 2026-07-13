import { describe, it, expect } from 'vitest';
import { geoCentroid } from 'd3-geo';
import type { Geometry } from 'geojson';
import {
  TEX_W,
  TEX_H,
  appendBorderSegments,
  crossesAntimeridian,
  fitDistanceForAngularRadius,
  largestPolygon,
  largestPolygonCentroid,
  lonLatToTexPx,
  lonLatToVec3,
  regionAngularRadius,
  robustRegionFrame,
  splitRingAtAntimeridian,
  vec3ToLonLat,
} from './globe-geo';
import type { Position } from 'geojson';

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

describe('largestPolygonCentroid', () => {
  // A square polygon (one ring) centred on [lon, lat]; winding matches the dataset's
  // interior convention (clockwise in lon/lat → the enclosed small area).
  const squarePoly = (lon: number, lat: number, h: number): Position[][] => [
    [
      [lon - h, lat - h],
      [lon - h, lat + h],
      [lon + h, lat + h],
      [lon + h, lat - h],
      [lon - h, lat - h],
    ],
  ];

  it('returns the sole polygon centroid for a single-polygon country', () => {
    const [lon, lat] = largestPolygonCentroid({
      type: 'Polygon',
      coordinates: squarePoly(10, 50, 4),
    });
    expect(lon).toBeCloseTo(10, 1);
    expect(lat).toBeCloseTo(50, 1);
  });

  it('anchors to the mainland, ignoring a far small territory (France + Guiana)', () => {
    const geom: Geometry = {
      type: 'MultiPolygon',
      coordinates: [
        squarePoly(2, 47, 5), // metropolitan France (big)
        squarePoly(-53, 4, 1), // French Guiana (small, far off in South America)
      ],
    };
    const [lon, lat] = largestPolygonCentroid(geom);
    // Should land on the mainland, not be dragged south-west toward Guiana.
    expect(lon).toBeGreaterThan(-5);
    expect(lon).toBeLessThan(10);
    expect(lat).toBeGreaterThan(40);
    expect(lat).toBeLessThan(52);
  });

  it('falls back to geoCentroid for non-polygonal geometry', () => {
    const [lon, lat] = largestPolygonCentroid({ type: 'Point', coordinates: [12, 34] });
    expect(lon).toBeCloseTo(12, 3);
    expect(lat).toBeCloseTo(34, 3);
  });
});

describe('largestPolygon', () => {
  const squarePoly = (lon: number, lat: number, h: number): Position[][] => [
    [
      [lon - h, lat - h],
      [lon - h, lat + h],
      [lon + h, lat + h],
      [lon + h, lat - h],
      [lon - h, lat - h],
    ],
  ];

  it('returns the sole polygon for a single-polygon country', () => {
    const poly = largestPolygon({ type: 'Polygon', coordinates: squarePoly(10, 50, 4) });
    expect(poly).not.toBeNull();
    expect(poly!.type).toBe('Polygon');
    expect(poly!.coordinates).toEqual(squarePoly(10, 50, 4));
  });

  it('picks the biggest polygon of a multipolygon (mainland over a far small territory)', () => {
    const geom: Geometry = {
      type: 'MultiPolygon',
      coordinates: [
        squarePoly(2, 47, 5), // metropolitan France (big)
        squarePoly(-53, 4, 1), // French Guiana (small, far off in South America)
      ],
    };
    const poly = largestPolygon(geom);
    expect(poly).not.toBeNull();
    // The returned polygon is the big mainland square, not the tiny far one.
    expect(poly!.coordinates).toEqual(squarePoly(2, 47, 5));
  });

  it('returns null for non-polygonal geometry', () => {
    expect(largestPolygon({ type: 'Point', coordinates: [12, 34] })).toBeNull();
  });

  it('keeps largestPolygonCentroid output identical after the refactor', () => {
    const geom: Geometry = {
      type: 'MultiPolygon',
      coordinates: [squarePoly(2, 47, 5), squarePoly(-53, 4, 1)],
    };
    // The centroid helper is now a thin wrapper: the largest polygon's centroid.
    expect(largestPolygonCentroid(geom)).toEqual(geoCentroid(largestPolygon(geom)!));
  });
});

describe('splitRingAtAntimeridian', () => {
  /** Max |Δlon| between consecutive vertices of a ring — a full-width smear is > 180. */
  const maxJump = (ring: Position[]): number => {
    let m = 0;
    for (let i = 1; i < ring.length; i++) m = Math.max(m, Math.abs(ring[i][0] - ring[i - 1][0]));
    return m;
  };

  it('leaves a non-crossing ring unchanged', () => {
    const ring: Position[] = [
      [-10, 0],
      [10, 0],
      [10, 10],
      [-10, 10],
      [-10, 0],
    ];
    const pieces = splitRingAtAntimeridian(ring);
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toEqual(ring);
  });

  it('splits a box straddling the antimeridian into seam-hugging pieces (no smear)', () => {
    // A box from +170 to −170 (crossing the seam), like Fiji.
    const ring: Position[] = [
      [170, -10],
      [-170, -10],
      [-170, 10],
      [170, 10],
      [170, -10],
    ];
    const pieces = splitRingAtAntimeridian(ring);
    expect(pieces.length).toBeGreaterThanOrEqual(2);
    // No piece may contain a full-width horizontal edge.
    for (const p of pieces) expect(maxJump(p)).toBeLessThanOrEqual(180);
    // Every vertex stays within [−180, 180], and each side is represented.
    const lons = pieces.flat().map((c) => c[0]);
    expect(Math.min(...lons)).toBeGreaterThanOrEqual(-180);
    expect(Math.max(...lons)).toBeLessThanOrEqual(180);
    expect(lons.some((l) => l >= 170 || l === 180)).toBe(true);
    expect(lons.some((l) => l <= -170 || l === -180)).toBe(true);
  });

  it('interpolates the crossing latitude at the boundary', () => {
    // Edge from (170, 0) to (−170, 20): crosses at lon ±180, halfway → lat 10.
    const ring: Position[] = [
      [170, 0],
      [-170, 20],
      [-170, -20],
      [170, 0],
    ];
    const pieces = splitRingAtAntimeridian(ring);
    const boundaryPts = pieces.flat().filter((c) => Math.abs(c[0]) === 180);
    expect(boundaryPts.length).toBeGreaterThan(0);
    // One of the boundary crossings interpolates to lat 10.
    expect(boundaryPts.some((c) => Math.abs(c[1] - 10) < 1e-6)).toBe(true);
  });
});

describe('appendBorderSegments', () => {
  it('emits one xyz-pair per edge, all on the requested radius sphere', () => {
    const ring: Position[] = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 0],
    ];
    const out: number[] = [];
    appendBorderSegments({ type: 'Polygon', coordinates: [ring] }, 1.002, out);
    // 3 edges → 3 segments → 6 vertices → 18 floats.
    expect(out.length).toBe(18);
    for (let i = 0; i < out.length; i += 3) {
      const r = Math.hypot(out[i], out[i + 1], out[i + 2]);
      expect(r).toBeCloseTo(1.002, 6);
    }
  });

  it('appends nothing for non-polygonal geometry', () => {
    const out: number[] = [];
    appendBorderSegments({ type: 'Point', coordinates: [0, 0] }, 1, out);
    expect(out).toHaveLength(0);
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

/** Spherical centroid of a set of lon/lat points (the naive, untrimmed centre). */
function geoCentroidOf(points: [number, number][]): [number, number] {
  return geoCentroid({ type: 'MultiPoint', coordinates: points }) as [number, number];
}

describe('robustRegionFrame', () => {
  // European member centroids (approx), plus Russia's — the M49 "Europe" far outlier.
  const EUROPE: [number, number][] = [
    [-19, 65], // Iceland
    [-8, 53], // Ireland
    [-8, 39], // Portugal
    [-3, 40], // Spain
    [2, 47], // France
    [10, 51], // Germany
    [12, 42], // Italy
    [19, 52], // Poland
    [22, 39], // Greece
    [26, 64], // Finland
    [32, 49], // Ukraine
    [100, 60], // Russia (outlier)
  ];

  it('returns null when there are no finite centroids', () => {
    expect(robustRegionFrame([])).toBeNull();
    expect(robustRegionFrame([[NaN, NaN]])).toBeNull();
  });

  it('keeps Europe framed by trimming the Russia outlier (centre stays in Europe)', () => {
    const frame = robustRegionFrame(EUROPE)!;
    expect(frame).not.toBeNull();
    // Centre stays over Europe (well west of Russia's ~100°E), not dragged into Asia.
    expect(frame.centre[0]).toBeLessThan(40);
    expect(frame.centre[0]).toBeGreaterThan(-20);
    expect(frame.centre[1]).toBeGreaterThan(35);
    expect(frame.centre[1]).toBeLessThan(65);
    // Radius stays modest, so the fit distance doesn't clamp out to the whole world.
    expect(fitDistanceForAngularRadius(frame.radius)).toBeLessThan(3.2);
  });

  it('is pulled east and blown out when the outlier is NOT trimmed (baseline)', () => {
    // Sanity check that the outlier really would distort a naive centre/radius — this is
    // the bug `robustRegionFrame` fixes.
    const c = geoCentroidOf(EUROPE);
    const naiveRadius = regionAngularRadius(c, EUROPE);
    const robust = robustRegionFrame(EUROPE)!;
    expect(c[0]).toBeGreaterThan(robust.centre[0]); // naive centre sits further east
    expect(naiveRadius).toBeGreaterThan(robust.radius); // and spans much wider
  });

  it('keeps a compact cluster intact (centre near the mean)', () => {
    const frame = robustRegionFrame([
      [10, 50],
      [20, 48],
      [15, 45],
    ])!;
    expect(frame.centre[0]).toBeGreaterThan(10);
    expect(frame.centre[0]).toBeLessThan(20);
    expect(frame.centre[1]).toBeGreaterThan(44);
    expect(frame.centre[1]).toBeLessThan(51);
  });

  it('handles a single point (radius 0)', () => {
    const frame = robustRegionFrame([[30, 20]])!;
    expect(frame.centre[0]).toBeCloseTo(30, 3);
    expect(frame.centre[1]).toBeCloseTo(20, 3);
    expect(frame.radius).toBeCloseTo(0, 6);
  });
});
