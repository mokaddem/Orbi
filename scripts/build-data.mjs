// @ts-check
/**
 * Phase 1 — Data layer build/prep step.
 *
 * Assembles the bundled, normalized geography dataset the app loads at runtime.
 * Runs at build time (see the `data:build` / `prebuild` npm scripts) so the browser
 * only ever loads plain JSON — no heavy processing on the client.
 *
 * Sources (all bundled, offline, no runtime API):
 *   - world-countries : common names (EN/FR), ISO codes (alpha-2/3 + numeric),
 *                       UN M49 region/sub-region, and the `unMember` flag used for scope.
 *   - flag-icons      : one SVG per country, keyed by lowercase ISO alpha-2.
 *   - world-atlas     : Natural Earth TopoJSON (50m), geometries keyed by numeric ISO code.
 *
 * Outputs, into src/data/generated/:
 *   - countries.json        normalized array, one record per in-scope country
 *   - countries-50m.json    the TopoJSON (lazy-loaded by map modes)
 *   - flags/<iso2>.svg       one flag per in-scope country
 *   - meta.json             counts, source versions, and integrity exceptions
 *
 * The script prints an integrity report and exits non-zero on any *unexpected*
 * missing flag or geometry, so a broken dataset fails the build loudly.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { feature, merge } from 'topojson-client';
import { geoNaturalEarth1, geoPath, geoCentroid } from 'd3-geo';
import { CAPITAL_I18N } from './data/capitals-i18n.mjs';
import { LANGUAGE_I18N } from './data/languages-i18n.mjs';
import { INDUSTRY_TAXONOMY, COUNTRY_INDUSTRIES, KNOWN_NO_INDUSTRY } from './data/industries.mjs';
import { INDUSTRY_FACTS } from './data/industry-facts.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const NM = join(ROOT, 'node_modules');
const OUT = join(ROOT, 'src', 'data', 'generated');
const FLAG_OUT = join(OUT, 'flags');

/** TopoJSON resolution to bundle. 50m covers every in-scope country except Tuvalu;
 *  110m omits ~29 micro-states, 10m is far larger for negligible quiz benefit. */
const TOPO_RES = '50m';

/**
 * UN observer states to include on top of full members. world-countries marks the
 * 193 members (plus Vatican City) as `unMember: true`; only the State of Palestine
 * must be added explicitly. Total in-scope = 195.
 */
const OBSERVERS = new Set(['PS']);

/**
 * Countries knowingly absent from the bundled TopoJSON at this resolution. Kept as an
 * explicit allow-list so the build fails if the set of gaps ever changes unexpectedly.
 */
const KNOWN_NO_GEOMETRY = new Set(['TV']); // Tuvalu — too small for world-atlas 50m

/**
 * Localized short-name overrides, keyed by ISO alpha-2 then locale, for the few cases
 * where world-countries ships an outdated exonym. Upstream FR/DE both still carry the
 * pre-2018 "Swaziland"/"Swasiland" for Eswatini; EN already uses the modern name.
 */
const NAME_OVERRIDES = {
  SZ: { fr: 'Eswatini', de: 'Eswatini' },
};

/**
 * Phase 19 — sub-region regrouping into balanced "play regions".
 *
 * The raw `world-countries` sub-regions are finer than classic UN M49 (Europe alone is
 * split into six, with non-M49 labels like "Central Europe"), leaving 12 of ~24 buckets
 * below a playable size — e.g. Eastern Europe = 4, so a 10-question region game just
 * cycles the same handful. We regroup them here, at build time, so every selectable
 * bucket holds at least {@link MIN_POOL} countries and a filtered game has real variety.
 *
 * The top-level `region` (the five M49 continents) is left untouched — only `subregion`
 * is rewritten. Nothing persists a sub-region label (history stores ISO codes; the
 * bucket is always recomputed), so this needs no progress migration.
 */
const MIN_POOL = 8;

/** Raw `world-countries` sub-region → play-region bucket (the common case). */
const SUBREGION_REGROUP = {
  // Africa: Northern (6) + Middle (10); Eastern (17) + Southern (5); Western (16) intact.
  'Northern Africa': 'Northern & Central Africa',
  'Middle Africa': 'Northern & Central Africa',
  'Western Africa': 'Western Africa',
  'Eastern Africa': 'Eastern & Southern Africa',
  'Southern Africa': 'Eastern & Southern Africa',
  // Americas: North America (3) + Central America (7); Caribbean (13), South America (12) intact.
  'North America': 'North & Central America',
  'Central America': 'North & Central America',
  Caribbean: 'Caribbean',
  'South America': 'South America',
  // Asia: Central (5) + Eastern (5); Southern (9), South-Eastern (11), Western (17) intact.
  'Central Asia': 'Central & Eastern Asia',
  'Eastern Asia': 'Central & Eastern Asia',
  'Southern Asia': 'Southern Asia',
  'South-Eastern Asia': 'South-Eastern Asia',
  'Western Asia': 'Western Asia',
  // Europe → classic UN M49 four. The world-countries "Central Europe" and "Southeast
  // Europe" splits dissolve back into the four; the members that don't follow their raw
  // sub-region's majority are corrected by SUBREGION_OVERRIDE_ISO below.
  'Northern Europe': 'Northern Europe',
  'Western Europe': 'Western Europe',
  'Eastern Europe': 'Eastern Europe',
  'Southern Europe': 'Southern Europe',
  'Central Europe': 'Eastern Europe', // Czechia, Hungary, Poland, Slovakia (Austria/Slovenia overridden)
  'Southeast Europe': 'Southern Europe', // the Balkans (Bulgaria/Romania overridden)
  // Oceania → a single bucket (14): its four raw sub-regions (2/3/4/5) are all far below
  // MIN_POOL and 14 can't be split into two ≥ MIN_POOL pieces, so it stays region-only.
  'Australia and New Zealand': 'Oceania',
  Melanesia: 'Oceania',
  Micronesia: 'Oceania',
  Polynesia: 'Oceania',
};

/**
 * Per-country overrides for the Europe reshuffle, where a country's classic-M49 bucket
 * differs from the majority mapping of its raw `world-countries` sub-region.
 */
const SUBREGION_OVERRIDE_ISO = {
  AT: 'Western Europe', // Austria: raw "Central Europe" → Western (classic M49)
  SI: 'Southern Europe', // Slovenia: raw "Central Europe" → Southern (classic M49)
  BG: 'Eastern Europe', // Bulgaria: raw "Southeast Europe" → Eastern (classic M49)
  RO: 'Eastern Europe', // Romania: raw "Southeast Europe" → Eastern (classic M49)
};

/**
 * Resolve a raw `world-countries` record to its play-region bucket. Throws on an
 * unmapped sub-region so a data-source change fails the build loudly instead of
 * silently leaving a country in a stale (possibly tiny) bucket.
 */
function playRegion(c) {
  const bucket = SUBREGION_OVERRIDE_ISO[c.cca2] ?? SUBREGION_REGROUP[c.subregion];
  if (!bucket) {
    throw new Error(
      `build-data: no play-region bucket for ${c.cca2} (raw sub-region "${c.subregion}")`,
    );
  }
  return bucket;
}

/** Read a JSON file relative to node_modules. */
function readNmJson(rel) {
  return JSON.parse(readFileSync(join(NM, rel), 'utf8'));
}

function pkgVersion(name) {
  try {
    return readNmJson(`${name}/package.json`).version;
  } catch {
    return 'unknown';
  }
}

/**
 * Build one dissolved continent silhouette per M49 region (plus a whole-world shape),
 * as SVG path strings sharing a square viewBox. Uses the coarse 110m TopoJSON.
 *
 * @param {{iso2:string,numericId:string,region:string,hasGeometry:boolean}[]} countryRecords
 */
function buildRegionShapes(countryRecords) {
  const VB = 100; // square viewBox side
  const MARGIN = 6;
  const OUTLIER_FLOOR_DEG = 60; // mirror src/ui/components/map-framing.ts
  const MAD_K = 3;

  const topo110 = readNmJson('world-atlas/countries-110m.json');
  const geomByNumeric = new Map(
    topo110.objects.countries.geometries.map((g) => [String(Number(g.id)), g]),
  );

  const wrap180 = (deg) => ((((deg + 180) % 360) + 360) % 360) - 180;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  function median(nums) {
    const s = [...nums].sort((a, b) => a - b);
    const n = s.length;
    if (!n) return NaN;
    const m = n >> 1;
    return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /** Circular mean of longitudes (degrees), robust across the antimeridian. */
  function meanLon(lons) {
    const sin = lons.reduce((a, d) => a + Math.sin(toRad(d)), 0) / lons.length;
    const cos = lons.reduce((a, d) => a + Math.cos(toRad(d)), 0) / lons.length;
    return toDeg(Math.atan2(sin, cos));
  }

  /** Members of a region as { geom, centroid:[lon,lat] } (only those with 110m geometry). */
  function membersOf(region) {
    const out = [];
    for (const c of countryRecords) {
      if (region && c.region !== region) continue;
      const geom = geomByNumeric.get(String(Number(c.numericId)));
      if (!geom) continue;
      const centroid = geoCentroid(feature(topo110, geom));
      if (!Number.isFinite(centroid[0]) || !Number.isFinite(centroid[1])) continue;
      out.push({ geom, centroid });
    }
    return out;
  }

  /**
   * Drop a member whose centroid is a far isolated outlier on either axis (beyond both
   * MAD_K·MAD and a ±60° floor from the median), measured in a frame recentred on the
   * region's mean longitude so the antimeridian doesn't distort the judgement. Keeps
   * continuous spreads whole; only clips a lone outlier like Russia in "Europe".
   */
  function trimOutliers(members) {
    if (members.length < 4) return members;
    const centreLon = meanLon(members.map((m) => m.centroid[0]));
    const relLon = members.map((m) => wrap180(m.centroid[0] - centreLon));
    const lat = members.map((m) => m.centroid[1]);
    const keepAxis = (vals) => {
      const med = median(vals);
      const mad = median(vals.map((v) => Math.abs(v - med)));
      const thr = Math.max(MAD_K * mad, OUTLIER_FLOOR_DEG);
      return vals.map((v) => Math.abs(v - med) <= thr);
    };
    const okLon = keepAxis(relLon);
    const okLat = keepAxis(lat);
    const kept = members.filter((_, i) => okLon[i] && okLat[i]);
    return kept.length ? kept : members;
  }

  // Icons render at ~40–90px, so sub-degree coastline detail is invisible: simplify
  // the geometry (Douglas–Peucker, tolerance in degrees) and cull tiny islands before
  // projecting. This keeps the whole file to a few KB with no visible loss.
  const TOL_DEG = 0.7;
  const MIN_AREA_DEG2 = 2.0; // ~1.4°×1.4°; drops specks, keeps the likes of Iceland/NZ

  /** Shoelace area of a closed lon/lat ring (deg²). */
  function ringArea(ring) {
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    }
    return Math.abs(a) / 2;
  }

  /** Perpendicular distance from point p to segment a–b (planar; fine at continent scale). */
  function perpDist(p, a, b) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    if (!len2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }

  /** Douglas–Peucker over an open point list. */
  function dp(points, tol) {
    if (points.length < 3) return points;
    let maxD = 0;
    let idx = 0;
    const first = points[0];
    const last = points[points.length - 1];
    for (let i = 1; i < points.length - 1; i++) {
      const d = perpDist(points[i], first, last);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol) {
      const left = dp(points.slice(0, idx + 1), tol);
      const right = dp(points.slice(idx), tol);
      return left.slice(0, -1).concat(right);
    }
    return [first, last];
  }

  /** Simplify a closed ring (keeps it closed); returns null if it collapses. */
  function simplifyRing(ring, tol) {
    const open = ring.slice(0, -1);
    if (open.length < 4) return ring;
    const simp = dp(open, tol);
    if (simp.length < 3) return null;
    return [...simp, simp[0]];
  }

  /** Simplify one polygon [outer, ...holes]; null if its outer ring is a speck. */
  function simplifyPolygon(poly, tol, minArea) {
    if (ringArea(poly[0]) < minArea) return null;
    const outer = simplifyRing(poly[0], tol);
    if (!outer) return null;
    const rings = [outer];
    for (let i = 1; i < poly.length; i++) {
      if (ringArea(poly[i]) < minArea) continue;
      const hole = simplifyRing(poly[i], tol);
      if (hole) rings.push(hole);
    }
    return rings;
  }

  function simplifyGeometry(geo, tol, minArea) {
    if (geo.type === 'Polygon') {
      const p = simplifyPolygon(geo.coordinates, tol, minArea);
      return p ? { type: 'Polygon', coordinates: p } : null;
    }
    const polys = geo.coordinates
      .map((p) => simplifyPolygon(p, tol, minArea))
      .filter((p) => p !== null);
    return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null;
  }

  /** Round every number in a path 'd' string to 1 decimal place. */
  const roundPath = (d) =>
    d.replace(/-?\d+\.\d+/g, (n) => (Math.round(parseFloat(n) * 10) / 10).toString());

  function silhouette(region) {
    const members = region ? trimOutliers(membersOf(region)) : membersOf('');
    if (!members.length) return '';
    const merged = merge(
      topo110,
      members.map((m) => m.geom),
    );
    const simplified = simplifyGeometry(merged, TOL_DEG, MIN_AREA_DEG2);
    if (!simplified) return '';
    // Recentre the projection on the region so wide/Pacific spreads don't wrap.
    const centreLon = region ? meanLon(members.map((m) => m.centroid[0])) : 0;
    const projection = geoNaturalEarth1()
      .rotate([-centreLon, 0])
      .fitExtent(
        [
          [MARGIN, MARGIN],
          [VB - MARGIN, VB - MARGIN],
        ],
        simplified,
      );
    const d = geoPath(projection)(simplified);
    return d ? roundPath(d) : '';
  }

  const regions = [...new Set(countryRecords.map((c) => c.region))].sort((a, b) =>
    a.localeCompare(b, 'en'),
  );
  /** @type {Record<string, string>} */
  const shapes = { World: silhouette('') };
  for (const region of regions) shapes[region] = silhouette(region);

  return { viewBox: `0 0 ${VB} ${VB}`, source: 'world-atlas 110m · M49 regions', shapes };
}

// --- 1. Load sources ---------------------------------------------------------
const worldCountries = readNmJson('world-countries/dist/countries.json');
const topo = readNmJson(`world-atlas/countries-${TOPO_RES}.json`);

// Set of numeric ISO codes that resolve to a geometry, normalized (drops leading zeros).
const geometryIds = new Set(topo.objects.countries.geometries.map((g) => String(Number(g.id))));

// --- 2. Determine scope: UN members + observers, sorted by English name ------
const inScope = worldCountries
  .filter((c) => c.unMember || OBSERVERS.has(c.cca2))
  .sort((a, b) => a.name.common.localeCompare(b.name.common, 'en'));

// --- 3. Reset output directory ----------------------------------------------
rmSync(OUT, { recursive: true, force: true });
mkdirSync(FLAG_OUT, { recursive: true });

// --- 4. Build records, copy flags, and run the join/integrity checks ---------
const countries = [];
const missingFlag = [];
const missingGeometry = [];
const missingCapital = [];
const missingLanguages = [];
/** In-scope countries with no curated industries that are NOT on the KNOWN_NO_INDUSTRY list. */
const missingIndustries = [];
/** `iso2:key` for any industry key not present in INDUSTRY_TAXONOMY (typo guard). */
const badIndustryKeys = [];
/** ISO-639-3 codes actually used, and the English name the source gives each (for i18n QA). */
const languageEnByCode = new Map();
/** Taxonomy keys assigned to ≥1 country, so a dead (unused) taxonomy entry fails the build. */
const usedIndustryKeys = new Set();
/** Phase 32: (country, industry) pairs that carry a curated "why" fun fact, and the covered set. */
let factPairs = 0;
const factCountries = new Set();

for (const c of inScope) {
  const iso2 = c.cca2;
  const iso2lower = iso2.toLowerCase();

  const flagSrc = join(NM, 'flag-icons/flags/4x3', `${iso2lower}.svg`);
  const hasFlag = existsSync(flagSrc);
  if (hasFlag) copyFileSync(flagSrc, join(FLAG_OUT, `${iso2lower}.svg`));
  else missingFlag.push(iso2);

  const hasGeometry = geometryIds.has(String(Number(c.ccn3)));
  if (!hasGeometry) missingGeometry.push(iso2);

  // Canonical capital (English) from world-countries; the first listed for the one
  // in-scope multi-capital country (South Africa → Pretoria). FR/DE come from the
  // curated override map, defaulting to English where no exonym differs.
  const capitalEn = c.capital?.[0];
  if (!capitalEn) missingCapital.push(iso2);
  const capital = {
    en: capitalEn ?? '',
    fr: CAPITAL_I18N[iso2]?.fr ?? capitalEn ?? '',
    de: CAPITAL_I18N[iso2]?.de ?? capitalEn ?? '',
  };

  // Languages (Phase 23): ISO-639-3 code → localized name. English from world-countries;
  // FR/DE from the curated LANGUAGE_I18N override, defaulting to English where none differs.
  const languages = Object.entries(c.languages ?? {}).map(([code, en]) => {
    languageEnByCode.set(code, en);
    return {
      code,
      name: {
        en,
        fr: LANGUAGE_I18N[code]?.fr ?? en,
        de: LANGUAGE_I18N[code]?.de ?? en,
      },
    };
  });
  if (languages.length === 0) missingLanguages.push(iso2);

  // Industries (Phase 25): curated taxonomy keys → localized names. No bundled source —
  // COUNTRY_INDUSTRIES is hand-authored ("main" = reputation). Covered countries get ≥1;
  // the rest are on the KNOWN_NO_INDUSTRY allow-list, enforced by the integrity checks below.
  const industryKeys = COUNTRY_INDUSTRIES[iso2] ?? [];
  const industryFacts = INDUSTRY_FACTS[iso2] ?? {};
  const industries = industryKeys.map((key) => {
    const name = INDUSTRY_TAXONOMY[key];
    if (!name) badIndustryKeys.push(`${iso2}:${key}`);
    else usedIndustryKeys.add(key);
    // Phase 32: attach the curated "why" fun fact for this (country, industry) pair, if any.
    const fact = industryFacts[key];
    return fact
      ? { key, name: name ?? { en: key, fr: key, de: key }, fact }
      : { key, name: name ?? { en: key, fr: key, de: key } };
  });
  if (industries.length === 0 && !KNOWN_NO_INDUSTRY.has(iso2)) missingIndustries.push(iso2);
  for (const ind of industries) {
    if (ind.fact) {
      factPairs += 1;
      factCountries.add(iso2);
    }
  }

  countries.push({
    iso2,
    iso3: c.cca3,
    numericId: c.ccn3, // numeric ISO 3166-1 code — the TopoJSON join key
    name: {
      en: c.name.common,
      fr: NAME_OVERRIDES[iso2]?.fr ?? c.translations.fra?.common ?? c.name.common,
      de: NAME_OVERRIDES[iso2]?.de ?? c.translations.deu?.common ?? c.name.common,
    },
    capital,
    languages,
    industries,
    region: c.region,
    subregion: playRegion(c), // Phase 19: regrouped play-region bucket (region left as-is)
    flagAsset: `flags/${iso2lower}.svg`,
    hasGeometry,
  });
}

// --- 5. Copy the TopoJSON for lazy runtime loading (map modes only) ----------
copyFileSync(
  join(NM, `world-atlas/countries-${TOPO_RES}.json`),
  join(OUT, `countries-${TOPO_RES}.json`),
);

// --- 6. Write dataset + meta -------------------------------------------------
writeFileSync(join(OUT, 'countries.json'), `${JSON.stringify(countries, null, 2)}\n`);

// --- 6b. Continent silhouettes for the setup screen's region icons -----------
// One small SVG path per M49 region (plus "World"), generated offline from the
// coarse 110m TopoJSON so there's no runtime geometry load for the icons. Country
// borders are dissolved (topojson `merge`), the shape is recentred per region so
// Pacific-spanning Oceania doesn't wrap, and a far isolated member (Russia in
// "Europe") is trimmed so the silhouette frames the continent proper. Coordinates
// are rounded to 1 dp to keep the whole file to a few KB.
const regionShapes = buildRegionShapes(countries);
writeFileSync(join(OUT, 'region-shapes.json'), `${JSON.stringify(regionShapes)}\n`);

const meta = {
  topoResolution: TOPO_RES,
  sources: {
    'world-countries': pkgVersion('world-countries'),
    'flag-icons': pkgVersion('flag-icons'),
    'world-atlas': pkgVersion('world-atlas'),
  },
  counts: {
    countries: countries.length,
    withFlag: countries.length - missingFlag.length,
    withGeometry: countries.length - missingGeometry.length,
    withCapital: countries.length - missingCapital.length,
    withLanguages: countries.length - missingLanguages.length,
    withIndustries: countries.filter((c) => c.industries.length > 0).length,
    distinctLanguages: languageEnByCode.size,
    industryTaxonomy: Object.keys(INDUSTRY_TAXONOMY).length,
    industryFactPairs: factPairs,
    withIndustryFacts: factCountries.size,
  },
  geometryExceptions: missingGeometry,
  flagExceptions: missingFlag,
  capitalExceptions: missingCapital,
  languageExceptions: missingLanguages,
  industryExceptions: [...KNOWN_NO_INDUSTRY].sort(),
};
writeFileSync(join(OUT, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`);

// --- 7. Integrity report -----------------------------------------------------
const n = countries.length;
console.log(`[build-data] ${n} in-scope countries (UN members + observers)`);
console.log(
  `[build-data] flags:    ${n - missingFlag.length}/${n}` +
    (missingFlag.length ? `  MISSING: ${missingFlag.join(', ')}` : ''),
);
console.log(
  `[build-data] geometry: ${n - missingGeometry.length}/${n} (${TOPO_RES})` +
    (missingGeometry.length ? `  absent: ${missingGeometry.join(', ')}` : ''),
);
console.log(
  `[build-data] capitals: ${n - missingCapital.length}/${n}` +
    (missingCapital.length ? `  MISSING: ${missingCapital.join(', ')}` : ''),
);
console.log(
  `[build-data] langs:    ${n - missingLanguages.length}/${n} with ≥1 language` +
    `  (${languageEnByCode.size} distinct)` +
    (missingLanguages.length ? `  MISSING: ${missingLanguages.join(', ')}` : ''),
);

// Phase 25 — industries coverage. No bundled source, so coverage is curated: report the
// covered/excluded split (per region) so a narrow dataset can never pass silently.
const withIndustries = countries.filter((c) => c.industries.length > 0);
const perRegionCovered = {};
const perRegionExcluded = {};
for (const c of countries) {
  const bucket = c.industries.length > 0 ? perRegionCovered : perRegionExcluded;
  bucket[c.region] = (bucket[c.region] ?? 0) + 1;
}
console.log(
  `[build-data] industry: ${withIndustries.length}/${n} covered (${Object.keys(INDUSTRY_TAXONOMY).length}-category taxonomy)`,
);
console.log(
  `[build-data]   covered by region:  ` +
    Object.entries(perRegionCovered)
      .sort()
      .map(([r, c]) => `${r} ${c}`)
      .join(', '),
);
console.log(
  `[build-data]   excluded (${KNOWN_NO_INDUSTRY.size}) by region: ` +
    Object.entries(perRegionExcluded)
      .sort()
      .map(([r, c]) => `${r} ${c}`)
      .join(', '),
);

// Phase 32 — "why" fun-fact coverage. A subset by design (silent-omit elsewhere), so this is
// informational, not a gate: report how many (country, industry) pairs carry a fact.
const totalIndustryPairs = withIndustries.reduce((s, c) => s + c.industries.length, 0);
console.log(
  `[build-data] facts:    ${factPairs}/${totalIndustryPairs} (country, industry) pairs ` +
    `across ${factCountries.size} countries have a "why" fun fact`,
);

const unexpectedGeometry = missingGeometry.filter((cc) => !KNOWN_NO_GEOMETRY.has(cc));
const staleExceptions = [...KNOWN_NO_GEOMETRY].filter((cc) => !missingGeometry.includes(cc));

// Keep the curated CAPITAL_I18N map honest: fail on an entry for a country not in scope,
// or an override that just repeats the English name (a no-op that should be deleted).
const inScopeIso = new Set(countries.map((c) => c.iso2));
const capitalEnByIso = new Map(countries.map((c) => [c.iso2, c.capital.en]));
const staleCapitalI18n = [];
const noopCapitalI18n = [];
for (const [iso, ov] of Object.entries(CAPITAL_I18N)) {
  if (!inScopeIso.has(iso)) {
    staleCapitalI18n.push(iso);
    continue;
  }
  const en = capitalEnByIso.get(iso);
  for (const loc of ['fr', 'de']) {
    if (ov[loc] !== undefined && ov[loc] === en) noopCapitalI18n.push(`${iso}.${loc}`);
  }
}

// Same honesty checks for the curated LANGUAGE_I18N map: fail on an entry for a language
// code not present in the dataset, or an override that just repeats the English name.
const staleLanguageI18n = [];
const noopLanguageI18n = [];
for (const [code, ov] of Object.entries(LANGUAGE_I18N)) {
  const en = languageEnByCode.get(code);
  if (en === undefined) {
    staleLanguageI18n.push(code);
    continue;
  }
  for (const loc of ['fr', 'de']) {
    if (ov[loc] !== undefined && ov[loc] === en) noopLanguageI18n.push(`${code}.${loc}`);
  }
}

// Phase 25: keep the curated industries dataset exhaustive and honest.
//  - unexpectedNoIndustry: an in-scope country in neither the map nor the allow-list (a gap).
//  - staleNoIndustry: a KNOWN_NO_INDUSTRY entry that is out of scope or now HAS a curated entry.
//  - industryOutOfScope: a COUNTRY_INDUSTRIES entry for a country not in scope.
//  - badIndustryKeys: an industry key not in the taxonomy (collected during the build loop).
//  - unusedIndustryKeys: a taxonomy category assigned to no country (a dead entry to prune).
const unexpectedNoIndustry = missingIndustries.slice();
const staleNoIndustry = [...KNOWN_NO_INDUSTRY].filter(
  (cc) => !inScopeIso.has(cc) || COUNTRY_INDUSTRIES[cc] !== undefined,
);
const industryOutOfScope = Object.keys(COUNTRY_INDUSTRIES).filter((cc) => !inScopeIso.has(cc));
const unusedIndustryKeys = Object.keys(INDUSTRY_TAXONOMY).filter((k) => !usedIndustryKeys.has(k));

// Phase 32: keep the curated INDUSTRY_FACTS store honest (coverage is a subset by design, so
// unlike industries there is NO exhaustiveness check — a missing fact just omits the blurb):
//  - factOutOfScope: a fact keyed to an iso2 that is not in scope.
//  - factForMissingIndustry: a fact keyed to a (country, industry) pair the country doesn't have
//    (a stale/typo key that could never surface, since the quiz only shows the country's own).
//  - factIncompleteLang: a fact missing a non-empty en / fr / de (trilingual parity is required).
const factOutOfScope = [];
const factForMissingIndustry = [];
const factIncompleteLang = [];
for (const [iso2, byKey] of Object.entries(INDUSTRY_FACTS)) {
  if (!inScopeIso.has(iso2)) {
    factOutOfScope.push(iso2);
    continue;
  }
  const owned = new Set(COUNTRY_INDUSTRIES[iso2] ?? []);
  for (const [key, tr] of Object.entries(byKey)) {
    if (!owned.has(key)) {
      factForMissingIndustry.push(`${iso2}:${key}`);
      continue;
    }
    if (!tr?.en?.trim() || !tr?.fr?.trim() || !tr?.de?.trim())
      factIncompleteLang.push(`${iso2}:${key}`);
  }
}

// Phase 19: every selectable play-region bucket must hold at least MIN_POOL countries,
// so a region-filtered game never degenerates into cycling the same handful.
const bucketSizes = new Map();
for (const c of countries) {
  const key = `${c.region} / ${c.subregion}`;
  bucketSizes.set(key, (bucketSizes.get(key) ?? 0) + 1);
}
const tooSmall = [...bucketSizes].filter(([, count]) => count < MIN_POOL);
console.log(
  `[build-data] buckets:  ${bucketSizes.size} play-regions, smallest ` +
    `${Math.min(...bucketSizes.values())} (min ${MIN_POOL})`,
);

if (
  missingFlag.length ||
  unexpectedGeometry.length ||
  staleExceptions.length ||
  tooSmall.length ||
  missingCapital.length ||
  staleCapitalI18n.length ||
  noopCapitalI18n.length ||
  missingLanguages.length ||
  staleLanguageI18n.length ||
  noopLanguageI18n.length ||
  unexpectedNoIndustry.length ||
  staleNoIndustry.length ||
  industryOutOfScope.length ||
  badIndustryKeys.length ||
  unusedIndustryKeys.length ||
  factOutOfScope.length ||
  factForMissingIndustry.length ||
  factIncompleteLang.length
) {
  console.error('[build-data] INTEGRITY CHECK FAILED:');
  if (missingFlag.length) console.error(`  - missing flags: ${missingFlag.join(', ')}`);
  if (unexpectedGeometry.length)
    console.error(`  - unexpected missing geometry: ${unexpectedGeometry.join(', ')}`);
  if (staleExceptions.length)
    console.error(
      `  - KNOWN_NO_GEOMETRY lists countries that now HAVE geometry: ${staleExceptions.join(', ')}`,
    );
  if (tooSmall.length)
    console.error(
      `  - play-region buckets below MIN_POOL (${MIN_POOL}): ` +
        tooSmall.map(([k, n]) => `${k} (${n})`).join(', '),
    );
  if (missingCapital.length)
    console.error(`  - countries with no capital: ${missingCapital.join(', ')}`);
  if (staleCapitalI18n.length)
    console.error(
      `  - CAPITAL_I18N entries for out-of-scope countries: ${staleCapitalI18n.join(', ')}`,
    );
  if (noopCapitalI18n.length)
    console.error(
      `  - CAPITAL_I18N overrides identical to English (delete them): ${noopCapitalI18n.join(', ')}`,
    );
  if (missingLanguages.length)
    console.error(`  - countries with no language: ${missingLanguages.join(', ')}`);
  if (staleLanguageI18n.length)
    console.error(
      `  - LANGUAGE_I18N entries for unused language codes: ${staleLanguageI18n.join(', ')}`,
    );
  if (noopLanguageI18n.length)
    console.error(
      `  - LANGUAGE_I18N overrides identical to English (delete them): ${noopLanguageI18n.join(', ')}`,
    );
  if (unexpectedNoIndustry.length)
    console.error(
      `  - in-scope countries with no industries and not on KNOWN_NO_INDUSTRY: ${unexpectedNoIndustry.join(', ')}`,
    );
  if (staleNoIndustry.length)
    console.error(
      `  - KNOWN_NO_INDUSTRY entries out of scope or now covered: ${staleNoIndustry.join(', ')}`,
    );
  if (industryOutOfScope.length)
    console.error(
      `  - COUNTRY_INDUSTRIES entries for out-of-scope countries: ${industryOutOfScope.join(', ')}`,
    );
  if (badIndustryKeys.length)
    console.error(`  - industry keys not in INDUSTRY_TAXONOMY: ${badIndustryKeys.join(', ')}`);
  if (unusedIndustryKeys.length)
    console.error(
      `  - taxonomy categories assigned to no country (prune them): ${unusedIndustryKeys.join(', ')}`,
    );
  if (factOutOfScope.length)
    console.error(
      `  - INDUSTRY_FACTS entries for out-of-scope countries: ${factOutOfScope.join(', ')}`,
    );
  if (factForMissingIndustry.length)
    console.error(
      `  - INDUSTRY_FACTS keyed to industries the country doesn't have: ${factForMissingIndustry.join(', ')}`,
    );
  if (factIncompleteLang.length)
    console.error(
      `  - INDUSTRY_FACTS entries missing an en/fr/de string: ${factIncompleteLang.join(', ')}`,
    );
  process.exit(1);
}

console.log('[build-data] OK — dataset written to src/data/generated/');
