# Phase 20 — Encyclopedia (region & country info pages)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
· **Track:** v1.3 content, languages & new modes

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Add a **browsable reference section** (not a quiz) so the player can *learn* and *look things up*, not
only be tested. Two page types:
- **Region page** — the countries a region covers (grouped by sub-region) plus the region's **map**.
- **Country page** — the country's **flag** and the **region / sub-region** it belongs to.

## In scope
- A reference index (list of regions + a way to reach any country).
- Region detail pages and country detail pages, deep-linkable and fully offline.
- Localised throughout (EN/FR, and DE once Phase 17 lands).

## Current state (so scope is clear)
Almost all the data and rendering primitives already exist — this is mostly **new routes + views over
existing accessors**, not new data:
- **Data accessors** (`src/data/countries.ts`, re-exported from `src/data/index.ts`):
  `getRegionTree()` (region → sub-region → countries, alpha-sorted), `getCountriesByRegion`,
  `getCountriesBySubregion`, `getCountry(iso)`, `flagUrl(country)`, `countryCount()`.
- **Region maps:** `src/data/generated/region-shapes.json` already has a simplified silhouette SVG path
  per region (World + the 5 M49 regions), rendered today by `RegionIcon.svelte`. For a richer map, the
  full geometry is available via `src/data/geometry.ts` (`loadTopology`, `loadCountryFeatures`,
  `indexFeaturesByCountry`) and the D3 rendering in `WorldMap.svelte` / `MapBoard.svelte`.
- **Routing:** `src/ui/routes.ts` — hash routes via `svelte-spa-router` (`/`, `/play`, `/summary`,
  `/history`, `/settings`, `*`) + `navLinks`. Adding a section = new route entries + a nav link.
- **i18n:** `$localizedName(country)` and `$localizedRegion(regionLabel)` already give localised names.
- **Launch tie-in:** `pendingConfig` + `push('/play')` (`src/ui/stores/game.ts`) is exactly how other
  screens stage a session — a "practice this region" button would reuse it with a `RegionFilter`.

## Depends on
Phase 1 (data layer) and the Phase 12 build step that emits `region-shapes.json`. Independent of the
game-mode phases. **Soft prerequisite for Phase 21** if that phase adds per-entity dispute explainers
(they'd live as encyclopedia pages). If **Phase 19** (region reclassification) is done first, this
reference should reflect the final region grouping.

## Scope / Deliverables
- [ ] **Routes + nav entry** — add reference routes (e.g. `#/reference`, `#/reference/region/:region`,
      `#/reference/country/:iso2`) to `routes.ts` and a `navLinks` entry with an i18n label.
- [ ] **Index page** — list the regions (with `RegionIcon`) and their country counts, and a path to any
      country (a full A–Z list and/or search — see Open Questions).
- [ ] **Region detail** — the region's map (silhouette or highlighted real map — Open Question), its
      sub-regions, and a grid of member countries (flag + localised name), each linking to its country
      page. Show counts.
- [ ] **Country detail** — a large flag, the localised country name, and its region + sub-region (both
      localised, linking back to the region page). Optional extras gated on Open Questions.
- [ ] **Deep-linking & offline** — pages are reachable by URL, survive reload, and work with no network
      (all data/assets already bundled).
- [ ] **i18n** — new `reference.*` message keys (EN/FR, and DE if Phase 17 is in); parity enforced by
      `messages.test.ts`. Country/region names via the existing localised accessors.
- [ ] **Tests** — data-driven rendering (a region lists its members; a country shows the right region),
      route-param handling (unknown region/iso → graceful not-found), and i18n.

## Technical notes
- **Reuse `getRegionTree()`** as the backbone for both the index and region pages — it already produces
  the exact region → sub-region → country nesting these pages need.
- **Map choice matters for cost.** The bundled silhouettes are cheap and already loaded for icons; the
  full D3 map is richer but lazily loads the TopoJSON (as map game-modes do). A reasonable split:
  silhouettes on the index/region cards, a highlighted real map only on the region detail page.
- **Country-page extras have dependencies:** capital needs the data added in Phase 23; neighbours need
  `world-countries`' `borders` (not yet in the dataset). Keep the MVP to **flag + region/sub-region**
  (the explicit ask) and note extras as extensible.
- Keep it read-only and framework-light: no new state stores beyond routing; the accessors are pure.

## Open Questions — to resolve with the owner
1. **Region map style** — cheap bundled **silhouette** (already available) vs. the **real D3 map with
   member countries highlighted** (richer, lazy TopoJSON load)? (Recommend: silhouette on cards, real
   highlighted map on region detail.)
2. **Country-page fields** — MVP is flag + region + sub-region. Add capital (needs Phase 23), neighbours
   (needs `borders` data), area/population later? Keep MVP minimal?
3. **Navigation & naming** — section label in EN/FR/DE ("Reference" / "Atlas" / "Encyclopedia" /
   "Encyclopédie"). A top-level nav entry, or reached from Home?
4. **Search/filter** — needed at launch (195 countries) or is a grouped A–Z list enough for v1?
5. **Play tie-in** — include a "practice this region" CTA that stages a `RegionFilter` session via
   `pendingConfig`? (Recommend yes — cheap, and it links learning to play.)

## Acceptance criteria
- The player can browse from a reference index to any region and any country, entirely offline, with
  correct deep links and a graceful not-found for bad params.
- Region pages show the members grouped by sub-region plus the region map; country pages show the flag
  and the (localised) region/sub-region, cross-linked.
- All copy and names are localised; `messages.test.ts` parity holds.
- Fast loop green (`npm run test` / `check` / `lint`); manual headless-Chrome check on :5180.

## Out of scope
- Rich per-country facts beyond flag + region/sub-region (capital, neighbours, demographics) unless an
  Open Question opts them in.
- Editing/authoring content in-app; all content is derived from the bundled dataset.
- Dispute / "who recognises this country" explainers — those belong to Phase 21 (and would render as
  encyclopedia pages once both ship).

## Progress log
- **2026-07-09 — PRD drafted from the owner's v1.3 improvement list (region pages with members + map;
  country pages with flag + region). NOT built — awaiting the clarifying round and explicit build
  approval.**
