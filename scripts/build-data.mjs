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

for (const c of inScope) {
  const iso2 = c.cca2;
  const iso2lower = iso2.toLowerCase();

  const flagSrc = join(NM, 'flag-icons/flags/4x3', `${iso2lower}.svg`);
  const hasFlag = existsSync(flagSrc);
  if (hasFlag) copyFileSync(flagSrc, join(FLAG_OUT, `${iso2lower}.svg`));
  else missingFlag.push(iso2);

  const hasGeometry = geometryIds.has(String(Number(c.ccn3)));
  if (!hasGeometry) missingGeometry.push(iso2);

  countries.push({
    iso2,
    iso3: c.cca3,
    numericId: c.ccn3, // numeric ISO 3166-1 code — the TopoJSON join key
    name: {
      en: c.name.common,
      fr: c.translations.fra?.common ?? c.name.common,
    },
    region: c.region,
    subregion: c.subregion,
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
  },
  geometryExceptions: missingGeometry,
  flagExceptions: missingFlag,
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

const unexpectedGeometry = missingGeometry.filter((cc) => !KNOWN_NO_GEOMETRY.has(cc));
const staleExceptions = [...KNOWN_NO_GEOMETRY].filter((cc) => !missingGeometry.includes(cc));

if (missingFlag.length || unexpectedGeometry.length || staleExceptions.length) {
  console.error('[build-data] INTEGRITY CHECK FAILED:');
  if (missingFlag.length) console.error(`  - missing flags: ${missingFlag.join(', ')}`);
  if (unexpectedGeometry.length)
    console.error(`  - unexpected missing geometry: ${unexpectedGeometry.join(', ')}`);
  if (staleExceptions.length)
    console.error(
      `  - KNOWN_NO_GEOMETRY lists countries that now HAVE geometry: ${staleExceptions.join(', ')}`,
    );
  process.exit(1);
}

console.log('[build-data] OK — dataset written to src/data/generated/');
