import { describe, it, expect } from 'vitest';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
import { projectWorld, projectRegion } from './atlas-map';

type CountryFeature = Feature<Geometry, GeoJsonProperties>;

function square(lon: number, lat: number, half: number): CountryFeature {
  return {
    type: 'Feature',
    id: `${lon}:${lat}`,
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [lon - half, lat - half],
          [lon - half, lat + half],
          [lon + half, lat + half],
          [lon + half, lat - half],
          [lon - half, lat - half],
        ],
      ],
    },
  };
}

const features = new Map<string, CountryFeature>([
  ['AA', square(0, 0, 30)],
  ['BB', square(100, 20, 12)],
]);

describe('projectWorld', () => {
  it('returns one projected path per country, keyed by ISO', () => {
    const out = projectWorld(features, 980, 500);
    expect(out.map((c) => c.iso2).sort()).toEqual(['AA', 'BB']);
    for (const c of out) expect(c.d.startsWith('M')).toBe(true);
  });

  it('projects distinct geometries to distinct paths', () => {
    const out = projectWorld(features, 980, 500);
    const [a, b] = out;
    expect(a.d).not.toBe(b.d);
  });

  it('reports a finite in-bounds anchor and a positive screen size for each country', () => {
    const out = projectWorld(features, 980, 500);
    for (const c of out) {
      expect(c.anchor).not.toBeNull();
      const [x, y] = c.anchor!;
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(980);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(500);
      expect(c.screenSize).toBeGreaterThan(0);
    }
  });

  it('anchors a multi-part country on its largest landmass, not on far-flung minor parts', () => {
    // A big central mainland plus a sizeable-but-smaller island far to the east. A whole-country
    // centroid would be dragged east toward the island; the anchor must stay on the mainland
    // (this is the "Paris is not in Spain" fix for overseas-territory countries).
    const mainland = [
      [
        [-30, -30],
        [-30, 30],
        [30, 30],
        [30, -30],
        [-30, -30],
      ],
    ];
    const island = [
      [
        [125, -66],
        [125, -16],
        [175, -16],
        [175, -66],
        [125, -66],
      ],
    ];
    const feat: CountryFeature = {
      type: 'Feature',
      id: 'MP',
      properties: {},
      geometry: { type: 'MultiPolygon', coordinates: [mainland, island] },
    };
    const [mp] = projectWorld(new Map([['MP', feat]]), 980, 500);
    expect(mp.anchor).not.toBeNull();
    // Frame spans lon -30..175; the mainland (centred on lon 0) projects to the left third,
    // well left of centre. A whole-country centroid would land past it, toward the island.
    expect(mp.anchor![0]).toBeLessThan(300);
  });
});

describe('projectRegion (review study-card locator, Phase 48)', () => {
  it('projects only the requested members, ignoring non-members', () => {
    const out = projectRegion(features, ['BB'], 320, 240);
    expect(out.map((c) => c.iso2)).toEqual(['BB']);
    expect(out[0].d.startsWith('M')).toBe(true);
  });

  it('returns empty when no member resolves to geometry', () => {
    expect(projectRegion(features, ['ZZ'], 320, 240)).toEqual([]);
    expect(projectRegion(features, [], 320, 240)).toEqual([]);
  });

  it('fits the members to the box — a lone small country fills most of the tile', () => {
    // BB is a small square far from origin; framed on its own it should span much of the 320-wide
    // tile (unlike projectWorld, where it is a speck). Its projected bbox width proves the zoom.
    const [bb] = projectRegion(features, ['BB'], 320, 240);
    expect(bb.screenSize).toBeGreaterThan(120);
    // Anchor stays within the tile bounds.
    expect(bb.anchor![0]).toBeGreaterThanOrEqual(0);
    expect(bb.anchor![0]).toBeLessThanOrEqual(320);
  });
});
