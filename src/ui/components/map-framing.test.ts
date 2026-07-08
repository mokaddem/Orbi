import { describe, it, expect } from 'vitest';
import type { Feature, Geometry, GeoJsonProperties, MultiPoint } from 'geojson';
import { focusFrame } from './map-framing';

type CountryFeature = Feature<Geometry, GeoJsonProperties>;

/** A small clockwise-wound square centred on [lon, lat] (interior, not its complement). */
function square(lon: number, lat: number, half = 3): CountryFeature {
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

/** Longitude span covered by a frame's sample points. */
function lonSpan(frame: MultiPoint): number {
  const lons = frame.coordinates.map((c) => c[0]);
  return Math.max(...lons) - Math.min(...lons);
}

describe('focusFrame', () => {
  it('returns null with no focus (caller fits the whole world)', () => {
    expect(focusFrame([])).toBeNull();
  });

  it('returns null when every centroid is non-finite', () => {
    // An empty polygon yields a NaN centroid; nothing usable to frame.
    const degenerate: CountryFeature = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiPolygon', coordinates: [] },
    };
    expect(focusFrame([degenerate])).toBeNull();
  });

  it('produces a MultiPoint grid around the focused countries', () => {
    const frame = focusFrame([square(10, 50), square(20, 48), square(15, 45)]);
    expect(frame).not.toBeNull();
    expect(frame!.type).toBe('MultiPoint');
    // (GRID_STEPS + 1)² = 25 samples.
    expect(frame!.coordinates.length).toBe(25);
    // All samples sit within a padded box around the cluster (~5–20°E, ~40–55°N).
    for (const [lon, lat] of frame!.coordinates) {
      expect(lon).toBeGreaterThan(0);
      expect(lon).toBeLessThan(30);
      expect(lat).toBeGreaterThan(38);
      expect(lat).toBeLessThan(58);
    }
  });

  it('trims a far isolated outlier (Russia-in-Europe) so the box stays over the cluster', () => {
    const europe = [square(2, 48), square(10, 51), square(15, 47), square(19, 52), square(24, 45)];
    const withRussia = [...europe, square(100, 60)]; // lone far-east outlier

    const tight = focusFrame(europe)!;
    const withOutlier = focusFrame(withRussia)!;

    // The outlier must not stretch the frame across most of the continent.
    expect(lonSpan(withOutlier)).toBeLessThan(60);
    // And it stays close to the outlier-free framing.
    expect(Math.abs(lonSpan(withOutlier) - lonSpan(tight))).toBeLessThan(15);
  });

  it('keeps a continuous pole-to-pole spread whole (does not over-trim the Americas)', () => {
    // Centroids marching from far south to far north, ~15° apart — no isolated gap.
    const americas = [
      square(-70, -40),
      square(-65, -20),
      square(-75, 0),
      square(-90, 20),
      square(-100, 40),
      square(-105, 55),
    ];
    const frame = focusFrame(americas)!;
    const lats = frame.coordinates.map((c) => c[1]);
    // The southern cone (~-40) and the north (~55) both survive the trim.
    expect(Math.min(...lats)).toBeLessThan(-40);
    expect(Math.max(...lats)).toBeGreaterThan(55);
  });

  it('gives a small single-country region breathing room rather than a zero-size box', () => {
    const frame = focusFrame([square(2, 47)])!;
    expect(frame.coordinates.length).toBe(25);
    // A lone centroid is padded to at least ~2·PAD_MIN across, not collapsed to a point.
    expect(lonSpan(frame)).toBeGreaterThan(8);
  });
});
