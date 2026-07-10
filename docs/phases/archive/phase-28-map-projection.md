# Phase 28 — Selectable map projection (Settings)

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
· **Track:** v1.4 post-play feedback

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Let the player choose the **map projection** used by the map modes, from a small curated set, in
Settings. Today the world map is always drawn with one projection; offering alternatives (e.g. Equal
Earth, Mercator, Equirectangular, and maybe an orthographic "globe") is both a learning aid and a
personalization touch.

## The trigger (owner report)
> "Propose different map projections in the settings."

## In scope
- A **projection preference** persisted with the other prefs.
- A **Settings control** to pick from a curated list of projections.
- `WorldMap.svelte` honouring the chosen projection for both map modes.

## Current state (so scope is clear)
- **The projection is hard-coded.** `WorldMap.svelte` builds `geoNaturalEarth1().fitExtent(...)` once
  (memoized via `$derived.by`; recomputed only when `features`/`focusIsos` change) and uses `geoPath`
  for both the country paths and the centroid math that positions the highlight marker and micro-state
  hit-dots. Nothing else references the projection.
- **Framing is projection-agnostic in principle.** `map-framing.ts` computes a MultiPoint frame from
  member centroids and hands it to `fitExtent`; any standard planar D3 projection can be fit the same
  way. (An **orthographic/globe** projection is the exception — it needs rotation + hemisphere clipping
  and back-face hit-detection handling, so it's a step up in complexity — see Open Questions.)
- **Prefs are a small typed bag.** `Prefs` = `{ language, survivalLives, fixedLength,
  choicesPerQuestion }` persisted via the persistence store; `PREFS_BOUNDS` validates numeric fields.
  Settings renders each as a labelled row (`Settings.svelte`). Adding a `mapProjection` enum pref
  follows the exact same pattern (default + validation + a control).
- **d3-geo is already a dependency.** Additional projection constructors (`geoEqualEarth`,
  `geoMercator`, `geoEquirectangular`, `geoOrthographic`, …) are named imports from the same package —
  tree-shaken, so only the ones we offer are bundled. No new dependency, works offline.

## Depends on
Phase 4 (map modes) and Phase 12 (map readability / `map-framing.ts`). **Related to Phase 22** (map
zoom & micro-state visibility) — both touch `WorldMap.svelte`'s projection/centroid path; sequence so
they don't collide (recommend doing 22's reveal/zoom work aware of a swappable projection, or landing
this first as it's smaller). Independent of the review/practice phases (26, 27).

## Scope / Deliverables
- [x] **`mapProjection` preference** — new enum pref `'naturalEarth' | 'equalEarth' | 'equirectangular'
      | 'mercator'` (owner chose 4 planar, no orthographic), default `naturalEarth`, persisted and
      validated like the other prefs. Migration-safe: absent → default via the `{ ...DEFAULT_PREFS,
      ...stored }` merge, and `clampPrefs` guards a corrupted value with `isMapProjection`.
      (`src/data/persistence/types.ts`.)
- [x] **Settings control** — a labelled **dropdown** under a new **"Map"** heading listing the offered
      projections with localized names; `onchange` calls `updatePrefs({ mapProjection })` immediately.
      (`src/ui/routes/Settings.svelte`.)
- [x] **`WorldMap.svelte` honours the pref** — new `projection` prop resolved via `projectionFor(name)`
      in the memoized `$derived.by`; the **single projection pass** and `fitExtent` framing are kept, and
      the marker + micro-state hit-dot centroids come from the *same* projection so highlights/hits stay
      aligned. Threaded `MapBoard` → `Play` (`projection={$prefs.mapProjection}`).
- [x] **Curated list only** — four vetted planar projections that all fit the 980×500 board and keep
      every in-scope country visible; the full d3-geo catalogue is not exposed.
- [x] **i18n** — `settings.map`, `settings.mapProjection`, and the four `settings.projection.*` names in
      EN/FR/DE with parity.
- [x] **Tests** — `types.test.ts` (default/guard/clamp coercion), `store.test.ts` round-trips a
      non-default projection, `projection.test.ts` (distinct constructors + unknown→naturalEarth fallback),
      and a `WorldMap` test that a non-default projection changes the projected `d`; existing `WorldMap` /
      `map-framing` tests stay green under the default.

### Owner decisions (clarifying round, 2026-07-10)
- **Projections:** 4 planar — Natural Earth (default), Equal Earth, Equirectangular, Mercator. **No
  orthographic globe** (deferred as the bigger lift it is).
- **Control:** new **"Map"** heading in Settings + a **dropdown** of localized names.
- **Preview:** a **small live preview** that re-projects as the pref changes (reuses the real
  `MapBoard`, lazy-imported so d3-geo/geometry load only when Settings is opened).
- **Scope:** **global** — one projection drives both map modes.

### Live preview (added per owner's "small live preview" choice)
- [x] A width-constrained, non-interactive whole-world `MapBoard` below the dropdown, re-deriving from
      `$prefs.mapProjection`, so the chosen projection is visible without opening a map game.

## Technical notes
- **Map a pref enum → constructor** in one small pure helper (`projectionFor(name): GeoProjection`),
  unit-testable, so `WorldMap` stays declarative. Default-fallback on an unknown value.
- **Keep the one-shot projection.** The projection must remain `$derived` on `(features, focusIsos,
  projectionName)` only — never per question — to preserve the "project once per session" performance
  property called out in `WorldMap.svelte`.
- **Cylindrical projections (Mercator/Equirectangular) can waste vertical space or exaggerate poles;**
  `fitExtent` handles sizing, but sanity-check that region framing and the aspect ratio still look right
  on the 980×500 logical surface. Mercator's polar stretch is a known trade-off — fine to offer with a
  short in-app note, or exclude, per owner taste.
- **Orthographic ("globe") is a bigger lift** (rotation controls, clipping the far hemisphere, and
  ensuring `map-locate` hit-detection ignores back-face geometry). Treat as optional/stretch or a later
  phase; don't let it block the simple planar-projection switch.
- **Interaction with Phase 22 zoom:** if zoom lands, it's an SVG transform on the projected group and is
  projection-independent — so this phase and 22 compose, but coordinate the shared file.

## Open Questions — to resolve with the owner
1. **Which projections to offer?** (Recommendation: **Natural Earth (default), Equal Earth,
   Equirectangular, Mercator** — all planar, low-risk. Add **Orthographic/globe** only if wanted as a
   stretch.)
2. **Include the orthographic globe?** (Recommendation: defer — it needs rotation + hemisphere clipping
   + hit-detection changes; scope as optional or its own follow-up.)
3. **Control style & placement** — segmented control vs. dropdown; under a new "Map" heading in Settings
   or within Gameplay?
4. **Live preview** — show a small preview of the selected projection in Settings, or just apply it
   next time a map mode is played?
5. **Per-mode or global** — one projection for both map modes (recommended) or separate?

## Acceptance criteria
- The player can pick from a curated projection list in Settings; the choice persists across reloads and
  is applied to both map modes.
- Every in-scope country stays visible and correctly positioned under each offered projection; the
  highlight marker and micro-state hit-dots remain aligned (same projection drives paths and centroids).
- The projection is still computed **once per session**, not per question; default behaviour is
  unchanged for players who don't touch the setting.
- EN/FR/DE parity for the new strings; fast loop green (`npm run test` / `check` / `lint`); a manual
  headless-Chrome check on :5180 switching projection and playing a map round.

## Out of scope
- A fully interactive/rotatable 3D globe (beyond an optional static orthographic view).
- Map **zoom/pan** and micro-state visibility (Phase 22) — separate concern in the same file.
- Non-map modes.

## Progress log
- **2026-07-09 — PRD drafted from the owner's v1.4 feedback ("propose different map projections in
  settings"). Grounded in `WorldMap.svelte` (hard-coded `geoNaturalEarth1`, one-shot `fitExtent`
  projection also used for marker/hit-dot centroids), `map-framing.ts` (projection-agnostic MultiPoint
  fit), and the `Prefs` pattern in `Settings.svelte`. d3-geo already bundled, so extra projections are
  tree-shaken imports. NOT built — awaiting the clarifying round and explicit build approval.**
- **2026-07-10 — Clarifying round with the owner (see *Owner decisions* above): 4 planar projections
  (no globe), a "Map" heading + dropdown in Settings, a small live preview, global scope. Owner gave
  explicit "go ahead".**
- **2026-07-10 — Built & verified. Added the `mapProjection` pref (type + `MAP_PROJECTIONS` +
  `isMapProjection` guard + `clampPrefs` coercion) and a pure `projectionFor()` helper
  (`src/ui/components/projection.ts`); `WorldMap`/`MapBoard` gained a `projection` prop, `Play` passes
  `$prefs.mapProjection`. Settings got the "Map" section (dropdown + lazy-loaded live preview). EN/FR/DE
  strings added with parity. Tests: `types.test.ts`, `projection.test.ts`, a new WorldMap projection
  test, and a non-default round-trip in `store.test.ts`. Fast loop green — `npm run check` (0 errors),
  `npm run test` (446 passing), `npm run lint` clean. Manual headless-Chrome check on :5180: switching
  the dropdown to Mercator re-projects the preview live (BR path changes), persists across reload, and a
  map-highlight round then renders under Mercator with the highlight ring correctly positioned; no
  console errors. **Phase ✅ Done.**
</content>
