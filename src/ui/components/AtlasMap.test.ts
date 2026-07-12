import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';
import AtlasMap from './AtlasMap.svelte';

type CountryFeature = Feature<Geometry, GeoJsonProperties>;

function square(lon: number, lat: number, half: number): CountryFeature {
  return {
    type: 'Feature',
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

// Real ISO codes so getCountry() resolves each path's region.
const features = new Map<string, CountryFeature>([
  ['FR', square(2, 47, 5)], // Europe
  ['DE', square(10, 51, 5)], // Europe
  ['NG', square(8, 9, 5)], // Africa
]);

const cls = (container: HTMLElement, iso: string) =>
  container.querySelector(`path[data-iso="${iso}"]`)?.classList;

describe('AtlasMap', () => {
  it('region mode highlights every member of the region', () => {
    const { container } = render(AtlasMap, { features, highlightRegion: 'Europe' });

    expect(cls(container, 'FR')).toContain('hl');
    expect(cls(container, 'DE')).toContain('hl');
    expect(cls(container, 'NG')).not.toContain('hl');
    // No single-country focus in region mode.
    expect(container.querySelector('path.focus')).toBeNull();
  });

  it('country mode focuses one country and tints its region for context', () => {
    const { container } = render(AtlasMap, { features, highlightCountry: 'FR' });

    // The country itself is the bright focus…
    expect(cls(container, 'FR')).toContain('focus');
    // …its same-region neighbour is the soft context tint (not the focus, not plain hl)…
    expect(cls(container, 'DE')).toContain('context');
    expect(cls(container, 'DE')).not.toContain('focus');
    // …and an out-of-region country gets neither treatment.
    expect(cls(container, 'NG')).not.toContain('context');
    expect(cls(container, 'NG')).not.toContain('focus');
  });

  // A speck of a country (Monaco) among large neighbours, so it falls under the "too small to
  // see at world scale" threshold and earns a locator ring.
  const withSpeck = new Map<string, CountryFeature>([
    ['MC', square(7.4, 43.7, 0.2)], // Monaco — Europe, a dot at world scale
    ['FR', square(2, 47, 20)], // Europe, large
    ['NG', square(8, 9, 20)], // Africa, large — widens the frame
  ]);

  it('marks a hard-to-see small country with a locator ring, but never in region mode', () => {
    const country = render(AtlasMap, { features: withSpeck, highlightCountry: 'MC' });
    expect(country.container.querySelector('[data-testid="locator"]')).not.toBeNull();

    const region = render(AtlasMap, { features: withSpeck, highlightRegion: 'Europe' });
    expect(region.container.querySelector('[data-testid="locator"]')).toBeNull();
  });

  it('does not clutter a clearly-visible large country with a locator ring', () => {
    const { container } = render(AtlasMap, { features: withSpeck, highlightCountry: 'FR' });
    expect(cls(container, 'FR')).toContain('focus');
    expect(container.querySelector('[data-testid="locator"]')).toBeNull();
  });

  it('exposes the accessible label', () => {
    const { getByRole } = render(AtlasMap, {
      features,
      highlightCountry: 'FR',
      label: 'France located on the world map',
    });
    expect(getByRole('img', { name: 'France located on the world map' })).toBeInTheDocument();
  });
});
