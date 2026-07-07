# Phase 4 — Map modes UI

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%

## Goal
Deliver the two map-based modes using a D3-geo rendered SVG world map, reusing the shared
Play/Summary flow from Phase 3.

## Depends on
Phase 2 (quiz engine) and Phase 3 (shared Play/Summary components).

## Scope / Deliverables
- [x] **D3-geo map component** rendering the bundled TopoJSON as SVG (a
      `geoNaturalEarth1` projection); responsive sizing (fixed `viewBox`, projected once).
      Pan/zoom not implemented (it was optional); tiny-state selectability handled instead
      via transparent centroid hit-dots (locate) and a pointer ring (highlight).
- [x] **Highlight by ISO:** highlight a target country while others render neutrally.
- [x] **Hit-detection:** click/tap a country shape → resolve its ISO code.
- [x] **`map-highlight`** mode: a country is highlighted → pick its name from the options.
- [x] **`map-locate`** mode: given a country name → click the correct country on the map;
      feedback reveals the correct country (green) and the wrong pick (red) on a miss.
- [x] **Lazy-load** the map geometry so flag-only sessions don't pay for it (the whole map
      board — d3-geo + WorldMap — is a dynamic-import chunk; the TopoJSON is fetched on demand).
- [x] Works for both `fixed` and `survival` session types.

## Technical notes
- The country JSON ↔ geometry join was established in Phase 1; reuse those keys so clicks map
  reliably to `iso2`.
- Consider a subtle zoom/centering on the relevant region when a filter is active (ties into
  Phase 5) to keep small countries clickable — at minimum ensure tiny states are selectable.
- Keep rendering performant on mid-range mobile (avoid re-rendering all paths per frame).

## Acceptance criteria
- Both map modes are playable start-to-finish for fixed and survival.
- Clicking a country resolves the correct ISO; feedback is accurate.
- Map interaction is smooth on a mid-range mobile browser.

## Out of scope
- Region filter UI (Phase 5), persistence (Phase 6), SR (Phase 7).

## Progress log
- **2026-07-07 — Done.** Implemented both map modes and wired them into the shared
  Play/Summary flow.
  - **New components:**
    - `src/ui/components/WorldMap.svelte` — pure, presentational D3-geo map. Projects all
      194 countries once with `geoNaturalEarth1().fitExtent(...)` into a fixed `viewBox`
      (so it scales responsively with no re-projection on resize and no per-question
      re-render). One `<path data-iso>` per country; states: `highlight`, `reveal`,
      `picked-wrong`. Clicks resolve to ISO and are reported via an `onpick(iso2)` callback;
      display-only when not `interactive`, and locked when `disabled`.
    - `src/ui/components/MapBoard.svelte` — async wrapper that loads the geometry on mount
      (memoized in the data layer) and shows loading/error states. Play **dynamically
      imports** this, keeping d3-geo + geometry out of the main bundle.
  - **Tiny-state handling** (technical note "ensure tiny states are selectable"): in
    `map-locate`, small countries (projected area < threshold) get transparent centroid
    hit-dots so microstates are tappable; in `map-highlight`, a pointer ring is drawn on
    the highlighted country so even microstates are visible. Pan/zoom (optional) was skipped
    in favour of these; zoom-to-region is deferred to Phase 5's filter work.
  - **Domain:** added `isMapMode(mode)` helper (`src/domain/questions.ts`). **Data:**
    memoized `loadCountryFeatures()` so remounts are cheap. **Play shell:** setup now offers
    all four modes; prompt/board/choice-grid branch per mode; `map-highlight` reuses
    `ChoiceGrid` (name variant), `map-locate` answers via map clicks. **i18n:** added
    `play.prompt.whichHighlighted`, `play.prompt.locate`, `play.map.loading/error` (EN + FR).
  - **Testing:** added `WorldMap.test.ts` (7 component tests: render/hit-detection/
    highlight/reveal/lock/hit-dots), an `isMapMode` unit test, and Play tests for the
    four-mode setup and a full `map-highlight` fixed session. Full suite: **111 passing**;
    `svelte-check` and `lint` clean.
  - **Browser verification** (headless Chrome via CDP, dev server on 5180): both modes
    render all 194 countries; `map-locate` hit-detection resolves the correct ISO and
    reveals correct/wrong on a miss; `map-highlight` shows the marker ring + 4 options and
    is non-interactive; `map-locate` + **survival** drains lives and ends on the summary.
    Zero console errors. Production build confirms the map is a separate lazy chunk
    (`MapBoard-*.js`, ~23 kB incl. d3-geo) with the 756 kB TopoJSON as an on-demand asset.
  - Playwright E2E remains unconfigured in this repo (the PRD's heavy-loop tool); the
    headless-Chrome smoke check above stands in for it at this phase boundary.
