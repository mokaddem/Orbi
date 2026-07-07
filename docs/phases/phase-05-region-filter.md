# Phase 5 — Region / sub-region filter

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%

## Goal
Let the player restrict any mode and session type to a region and optionally a sub-region,
wiring the region tree into session setup and the question generator.

## Depends on
Phases 2 (engine), 3 (flag modes), 4 (map modes).

## Scope / Deliverables
- [x] **Region/sub-region selector UI** driven by the data-layer region tree, with **World**
      (all countries) as the default.
- [x] Wire the chosen filter into session setup for **all four modes** and both session types
      so the question pool and distractors are restricted accordingly.
- [x] **Small-region guard:** when a filter has fewer countries than needed to build N
      options, fall back gracefully (reduce option count and/or warn) instead of failing.
- [x] (If map modes) optionally focus/zoom the map to the selected region.

## Technical notes
- The generator already accepts a region filter (Phase 2) — this phase is mostly UI + wiring
  + edge-case handling, not new engine logic.
- Persisting the last-used filter as a preference can wait for Phase 6.

## Acceptance criteria
- Selecting a region or sub-region restricts questions **and** distractors for every mode.
- Very small regions (e.g. a sub-region with < 4 countries) are handled without errors.

## Out of scope
- Persisting filter preference (Phase 6), SR-based training (Phase 7).

## Progress log
- **2026-07-07** — Implemented and marked ✅ Done.
  - **Selector UI** (`Play.svelte` setup): two dependent `<select>`s — region (default
    **World** = all countries) and sub-region (default *All of {region}*, shown only once a
    region is picked) — driven by `getRegionTree()`. A live pool-count hint shows how many
    countries the current selection asks about and warns when options are reduced.
  - **Distractor restriction** (`stores/game.ts`): the session's *universe* is now the
    filtered pool (`filterCountries(getCountries(), filter)`), so both the countries asked
    about **and** the multiple-choice distractors stay inside the selected region/sub-region,
    for all four modes and both session types. The `filter` is still passed through so it is
    recorded in the summary and preserved by *Retry*.
  - **Small-region guard:** a pool smaller than the 4 default choices degrades gracefully —
    `buildQuestion` caps options at what the pool can supply (verified for *Australia and New
    Zealand*, 2 countries → 2 options, no error), and the setup hint warns of the reduction.
  - **Map focus (optional):** `WorldMap`/`MapBoard` gained a `focusIsos` prop that fits the
    projection to the selected region's features (still drawing every country for context);
    wired from `Play` with a per-session memoized ISO list so the projection is computed once,
    not per question.
  - **i18n:** added FR names for all M49 regions/sub-regions (`i18n/regions.ts` +
    `localizedRegion` store) so the selector and summary are bilingual; a test asserts every
    dataset region/sub-region has a translation. Summary meta now shows the played region.
  - **Testing:** full Vitest suite green (123 tests, +12): distractor restriction &
    small-region guard (`game.test.ts`), selector + filtered start & sub-region reveal
    (`Play.test.ts`), region i18n coverage (`regions.test.ts`), projection reframing
    (`WorldMap.test.ts`). `npm run check`, `npm run lint`, and `npm run build` all pass;
    MapBoard/d3-geo stays a lazy chunk. Playwright E2E is not yet set up in the repo (the
    project has run the Vitest fast loop to date); recommend adding it in Phase 9/10 QA.
