// Projection helper shared by the Atlas map views. Projects every country once with
// the same Natural Earth projection the game map uses, fit to the whole world (no
// region zoom — the Atlas shows regions *in context*). Pure and DOM-free so it is
// unit-testable and reusable by both the region-detail map and the index thumbnails.
import { geoNaturalEarth1, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Polygon } from 'geojson';
import type { CountryFeature } from '../../data';

/** A country's projected SVG path, keyed by ISO alpha-2. */
export interface ProjectedCountry {
  iso2: string;
  d: string;
  /**
   * Screen-space centroid of the country's *largest* landmass, `[x, y]` in the same
   * width×height units as `d` — where a locator ring is anchored. Computed from the main
   * polygon only, so far-flung minor territories (French overseas departments, Alaska /
   * Hawaii, …) never drag it off the mainland. `null` if it has no finite centroid.
   */
  anchor: [number, number] | null;
  /**
   * The larger side of that landmass's projected bounding box, in the same units as `d`:
   * how big the country actually reads on the world map. Drives the "too small to see at
   * world scale" test that decides whether a country needs a locator ring.
   */
  screenSize: number;
}

/** The country's largest polygon (by projected area) as a standalone feature — or the whole
 *  feature when it is a single polygon. Used to anchor the locator on the main landmass. */
function mainLandmass(path: ReturnType<typeof geoPath>, f: CountryFeature): Feature {
  const g = f.geometry;
  if (g?.type !== 'MultiPolygon' || g.coordinates.length < 2) return f as Feature;
  let best: Feature = f as Feature;
  let bestArea = -Infinity;
  for (const coordinates of g.coordinates) {
    const poly: Feature<Polygon> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates },
    };
    const area = Math.abs(path.area(poly));
    if (area > bestArea) {
      bestArea = area;
      best = poly;
    }
  }
  return best;
}

/** Anchor + screen size for a projected feature, shared by projectWorld/projectRegion. */
function measure(path: ReturnType<typeof geoPath>, f: CountryFeature) {
  const main = mainLandmass(path, f);
  const [cx, cy] = path.centroid(main);
  const anchor: [number, number] | null =
    Number.isFinite(cx) && Number.isFinite(cy) ? [cx, cy] : null;
  const [[x0, y0], [x1, y1]] = path.bounds(main);
  const w = x1 - x0;
  const h = y1 - y0;
  const screenSize = Number.isFinite(w) && Number.isFinite(h) ? Math.max(w, h) : 0;
  return { anchor, screenSize };
}

/**
 * Project **only** the given region's member countries into `width`×`height` units, with the
 * Natural Earth projection **fit to those members** — i.e. a zoomed locator of that region
 * (Europe fills the tile), not the whole world. Used by the review study card (Phase 48) so a
 * region of neighbours is legible per country rather than a speck on a world thumbnail. Members
 * that project to nothing are dropped; a non-member `memberIsos` entry is simply ignored.
 */
export function projectRegion(
  features: Map<string, CountryFeature>,
  memberIsos: Iterable<string>,
  width: number,
  height: number,
  margin = 8,
): ProjectedCountry[] {
  const members = new Set(memberIsos);
  const memberFeatures = [...features]
    .filter(([iso]) => members.has(iso))
    .map(([, f]) => f as Feature);
  if (memberFeatures.length === 0) return [];
  const projection = geoNaturalEarth1().fitExtent(
    [
      [margin, margin],
      [width - margin, height - margin],
    ],
    { type: 'FeatureCollection', features: memberFeatures } as FeatureCollection,
  );
  const path = geoPath(projection);
  const out: ProjectedCountry[] = [];
  for (const [iso2, f] of features) {
    if (!members.has(iso2)) continue;
    const d = path(f);
    if (!d) continue;
    out.push({ iso2, d, ...measure(path, f) });
  }
  return out;
}

/**
 * Project the given country geometry into `width`×`height` logical units, framed to
 * the whole set. Countries that project to nothing are dropped.
 */
export function projectWorld(
  features: Map<string, CountryFeature>,
  width: number,
  height: number,
  margin = 6,
): ProjectedCountry[] {
  const fitTarget: FeatureCollection = {
    type: 'FeatureCollection',
    features: [...features.values()],
  } as FeatureCollection;
  const projection = geoNaturalEarth1().fitExtent(
    [
      [margin, margin],
      [width - margin, height - margin],
    ],
    fitTarget,
  );
  const path = geoPath(projection);
  const out: ProjectedCountry[] = [];
  for (const [iso2, f] of features) {
    const d = path(f);
    if (!d) continue;
    const main = mainLandmass(path, f);
    const [cx, cy] = path.centroid(main);
    const anchor: [number, number] | null =
      Number.isFinite(cx) && Number.isFinite(cy) ? [cx, cy] : null;
    const [[x0, y0], [x1, y1]] = path.bounds(main);
    const w = x1 - x0;
    const h = y1 - y0;
    const screenSize = Number.isFinite(w) && Number.isFinite(h) ? Math.max(w, h) : 0;
    out.push({ iso2, d, anchor, screenSize });
  }
  return out;
}
