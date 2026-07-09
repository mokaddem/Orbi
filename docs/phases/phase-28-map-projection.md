# Phase 28 — Selectable map projection (Settings)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
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
- [ ] **`mapProjection` preference** — a new enum pref (e.g. `'naturalEarth' | 'equalEarth' | 'mercator'
      | 'equirectangular'` [+ `'orthographic'` if in scope]) with a sensible default (current:
      `naturalEarth`), persisted and validated like the other prefs; migration-safe for existing stored
      prefs (absent → default).
- [ ] **Settings control** — a labelled selector (segmented control or dropdown) listing the offered
      projections with localized names; changing it updates the pref immediately.
- [ ] **`WorldMap.svelte` honours the pref** — resolve the pref to a D3 projection constructor and use
      it in the memoized projection. Keep the **single projection pass** and `fitExtent` framing; ensure
      centroids (marker + hit-dots) still come from the *same* projection so highlights/hits stay
      aligned. Changing the pref re-projects (a config-level change, not per-question).
- [ ] **Curated list only** — offer a short, vetted set that all fit the responsive `viewBox` board and
      keep every in-scope country visible; don't expose the full d3-geo catalogue.
- [ ] **i18n** — projection names + the Settings label in EN/FR/DE with parity.
- [ ] **Tests** — pref default/validation/persistence; a WorldMap test that the chosen projection is
      applied (e.g. distinct projected geometry / that a non-default pref changes output); existing
      `WorldMap` / `map-framing` tests still green under the default.

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
</content>
