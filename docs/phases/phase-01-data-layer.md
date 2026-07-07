# Phase 1 — Data layer

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%

## Goal
Assemble the bundled static dataset and provide typed loaders/accessors the rest of the app
uses to enumerate countries, resolve flags and geometry, and navigate the region tree.

## Depends on
Phase 0 (project scaffolding).

## Scope / Deliverables
- [x] A **build/prep script** that produces a normalized dataset JSON, keyed by ISO code,
      containing for each in-scope country: `iso2`, `iso3`, `name.en`, `name.fr`, `region`,
      `subregion`, `flagAsset` path.
- [x] **Scope filter:** include only UN members + observers (~195), excluding dependent
      territories / disputed regions.
- [x] Source names (EN/FR) + ISO codes + regions/sub-regions (UN M49) from **`world-countries`**
      (see Progress log for why this replaced `i18n-iso-countries` for names).
- [x] Bundle **`flag-icons` SVGs** for every in-scope country.
- [x] Bundle **`world-atlas` TopoJSON** and join geometry to countries by ISO code.
- [x] Typed loaders/accessors: `getCountries()`, `getCountry(iso)`, and a **region tree**
      index (`region → subregion → countries`).
- [x] **Integrity report:** detect and log any in-scope country missing a flag or geometry.
- [x] Unit tests asserting counts and integrity (see acceptance).

## Technical notes
- The join is the risky part: `world-atlas` uses numeric ISO 3166-1 codes; map them to
  alpha-2/alpha-3. Keep a small override table for known mismatches.
- Prefer generating the dataset at build time (committed artifact or prebuild step) so the
  runtime loads plain JSON — no heavy processing in the browser.
- Consider lazy-loading TopoJSON separately from the country JSON (map modes only need it).

## Acceptance criteria
- Dataset covers ~195 countries; every country has `name.en`, `name.fr`, `region`,
  `subregion`, and a resolvable `flagAsset`.
- Unit test asserts the expected country count and that **every** in-scope country resolves
  both a flag and map geometry (or is explicitly listed as a known exception).
- Region-tree query returns the correct members for a sample region and sub-region.

## Out of scope
- Rendering flags/maps (Phases 3–4); choosing distractors (Phase 2).

## Progress log
- **2026-07-06** — Implemented the data layer; all deliverables and acceptance criteria met.
  - **Sources (bundled, offline):** `world-countries` (names EN/FR, ISO alpha-2/3 + numeric,
    UN M49 region/sub-region, `unMember` flag) · `flag-icons` 4x3 SVGs · `world-atlas`
    Natural Earth TopoJSON. `topojson-client` is the only new runtime dependency; the rest are
    build-time devDependencies.
  - **Deviation from PRD — name source:** used `world-countries` common names instead of
    `i18n-iso-countries`. The latter's names are either verbose (“Russian Federation”, “Holy
    See (Vatican City State)”) or, in alias mode, ambiguous (DR Congo → “Congo”, colliding
    with the Republic of the Congo). `world-countries` gives curated, **unique** common names
    in both EN and FR (verified: no duplicate names in either language), which are far better
    quiz answers. It is also the UN M49 geoscheme source, so one dependency covers names,
    codes, regions, and scope. `i18n-iso-countries` was removed.
  - **Scope = 195:** `unMember === true` (193 members + Vatican City, which world-countries
    marks as a member) **plus** the observer State of Palestine (`PS`). Excludes Taiwan,
    Kosovo, Western Sahara, and all dependent territories.
  - **Sub-regions:** world-countries’ sub-regions are the M49 names, with two pragmatic
    refinements in Europe (adds “Central Europe” and “Southeast Europe” alongside the four
    cardinal ones). Kept as-is — consistent and complete; noted here for future reference.
  - **TopoJSON join:** join key is the numeric ISO code (`ccn3` ↔ TopoJSON geometry `id`,
    normalized to drop leading zeros). Chose the **50m** resolution: it covers **194/195**
    countries; **110m** omits ~29 micro-states. The only gap is **Tuvalu (TV)**, recorded as
    a known exception in both the build script and the tests. Each record carries a baked
    `hasGeometry` boolean so map modes can skip Tuvalu without loading the geometry.
  - **Build step:** `scripts/build-data.mjs` (run via `npm run data:build`, wired as
    `prebuild`) writes `src/data/generated/{countries.json, countries-50m.json, flags/*.svg,
    meta.json}`, prints an integrity report, and **exits non-zero** on any unexpected missing
    flag/geometry or a stale known-exception (so a broken dataset fails the build loudly).
    Result: 195 countries, 195/195 flags, 194/195 geometry.
  - **Runtime API (`src/data/`):** `getCountries`, `countryCount`, `getCountry` (alpha-2 or
    alpha-3, case-insensitive), `flagUrl` (Vite-resolved, base-aware, content-hashed URLs via
    `import.meta.glob`), `getRegions`, `getSubregions`, `getCountriesByRegion`,
    `getCountriesBySubregion`, `getRegionTree`. Geometry is **lazy-loaded** separately:
    `loadTopology` fetches the bundled TopoJSON `?url` on demand (kept out of the main JS
    chunk — verified via a probe build); `loadCountryFeatures` / `indexFeaturesByCountry`
    join it to countries by ISO code.
  - **Tests (25, all passing):** `countries.test.ts` — exact count (195), completeness &
    uniqueness of every field, flag file present for every country, geometry present for all
    but the known exception, region-tree partitioning/sorting and sample region/sub-region
    membership. `geometry.test.ts` — decodes the real TopoJSON and asserts the join yields
    194 features incl. a sample (FR/DE/BR/JP/US) and excludes Tuvalu.
  - **Verification:** `npm run test` (25 pass) · `npm run check` (0 errors) · `npm run lint`
    (clean) · `npm run build` (ok; `prebuild` regenerates the dataset). A throwaway probe
    build confirmed all 195 flags bundle (small ones inlined as data-URIs, larger ones as
    separate hashed assets) and the TopoJSON is emitted as a **separate**, lazily-fetched
    asset. No browser smoke — Phase 1 adds no visible UI (rendering is Phases 3–4).
  - **Config:** added `resolveJsonModule` to `tsconfig.app.json`; `src/data/generated/` added
    to `.prettierignore`; test files opt into Node types locally via a triple-slash reference
    so app code stays browser-only.
