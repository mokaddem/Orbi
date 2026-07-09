import { describe, it, expect } from 'vitest';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
import { projectWorld } from './atlas-map';

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
});
