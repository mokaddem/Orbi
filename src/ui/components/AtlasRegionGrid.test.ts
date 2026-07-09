import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
import AtlasRegionGrid from './AtlasRegionGrid.svelte';

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

// One real ISO per region so getCountry() resolves each path's region for highlighting.
const features = new Map<string, CountryFeature>([
  ['FR', square(2, 47, 5)], // Europe
  ['NG', square(8, 9, 5)], // Africa
  ['BR', square(-52, -10, 8)], // Americas
  ['CN', square(104, 35, 10)], // Asia
  ['AU', square(134, -25, 10)], // Oceania
]);

describe('AtlasRegionGrid', () => {
  it('renders one linked card per region with localized name and count', () => {
    const { container } = render(AtlasRegionGrid, { features });

    const cards = container.querySelectorAll('a.rcard');
    expect(cards.length).toBe(5);

    const expected: Record<string, number> = {
      Africa: 54,
      Americas: 35,
      Asia: 47,
      Europe: 45,
      Oceania: 14,
    };
    for (const [region, count] of Object.entries(expected)) {
      const card = container.querySelector(`a.rcard[href="#/atlas/region/${region}"]`);
      expect(card, `card for ${region}`).toBeInTheDocument();
      expect(card).toHaveAttribute('data-hl', region);
      expect(card?.textContent).toContain(region);
      expect(card?.textContent).toContain(`${count} countries`);
    }
  });

  it('projects the world geometry once into shared <defs>', () => {
    const { container } = render(AtlasRegionGrid, { features });
    const defsPaths = container.querySelectorAll('#atlas-world path');
    expect(defsPaths.length).toBe(features.size);
    // Each card references the shared symbol rather than re-drawing the world.
    expect(container.querySelectorAll('use').length).toBe(5);
  });
});
