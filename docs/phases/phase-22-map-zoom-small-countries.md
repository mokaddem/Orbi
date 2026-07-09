# Phase 22 — Map zoom & small-country visibility/selection

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
· **Track:** v1.3 content, languages & new modes

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Make **every** country — including micro-states like Liechtenstein, Monaco, San Marino, Vatican City,
Andorra, Malta, Singapore — clearly **visible** and reliably **selectable** in the two map modes.
Today tiny countries are effectively impossible to see, and selecting them (or trusting that a
selection was correct) is unreliable. Add **zoom** (and/or a better mechanism) plus tighten
hit-detection and post-answer feedback so map play is fair for small countries.

## The trigger (owner report)
> "Liechtenstein was impossible to see, but the selection worked (not sure if clicking on Switzerland
> validated it though)."

Two distinct problems: **(1) visibility** — the country can't be seen on the board; and **(2)
interaction confidence** — in click-to-locate it's unclear whether the right country was picked, and
whether clicking a large neighbour (Switzerland) could falsely validate the tiny target (Liechtenstein).

## In scope
- Both map modes: `map-highlight` (see the prompt country) and `map-locate` (click the answer).
- Visibility of small countries, reliable/unambiguous selection, and clear reveal feedback.

## Current state (so scope is clear)
- **`WorldMap.svelte`** projects all countries **once** with `geoNaturalEarth1().fitExtent(...)` on a
  fixed 980×500 logical surface (scales responsively via `viewBox`). **There is no pan or zoom.**
- **`map-framing.ts`** (Phase 12) fits the projection to the active region filter via a robust
  MultiPoint over member centroids — good for region framing, but a micro-state stays tiny even when
  its region fills the board.
- **Micro-state handling already exists but is evidently insufficient on real screens:**
  - *map-highlight:* a "pointer ring" `marker` is drawn on the highlighted country with a **radius floor
    of 13px** (`WorldMap.svelte:113–119`) so even a microstate gets *some* ring. On a phone, scaled down
    from a 980px-wide surface, that ring is still small and easy to miss.
  - *map-locate:* transparent **"hit dots"** (`r=9`) are added for countries whose projected area is
    `< SMALL_AREA` (14px²), rendered above the country paths and sorted smallest-first so the tiniest
    wins overlaps (`WorldMap.svelte:57, 101–109, 159–174`). This should make Liechtenstein clickable —
    but a 9px radius on a downscaled board can fall below a comfortable touch target, and it's not
    visible, so the player has no idea where to aim or whether they hit it.
- **Answer reveal** tints the picked-wrong country red and the correct one green (`stateFor`), but if
  the country is a 2px speck the reveal is as invisible as the prompt — which is why the owner couldn't
  tell what got validated.
- **Not a data gap:** Liechtenstein *has* geometry (only Tuvalu is geometry-less and already excluded
  from map answers by `eligibleAnswers`). This is purely a rendering/interaction problem.

## Depends on
Phase 4 (map modes) and Phase 12 (map readability & region framing — `map-framing.ts`, the marker /
hit-dot machinery this phase revisits). Related to Phase 11 (input & answer-flow UX). Independent of the
new game modes (23–25); placed **right before** them so the map is solid before more modes lean on it.

## Scope / Deliverables
- [ ] **Chosen mechanism (owner decision)** — one or a combination of:
      - **Interactive pan + zoom** on the board (wheel/trackpad, pinch, drag; double-tap/`+`/`−`
        buttons; a reset/"fit" control), with sensible min/max zoom. Likely `d3-zoom` or a lightweight
        SVG transform on the projected `<g>` (avoid re-projecting per frame — keep the one-shot
        projection and transform the group).
      - **Auto-focus the target** — in `map-highlight`, frame/zoom toward the highlighted country (with
        surrounding context) so it's unmistakably visible; in `map-locate`, ensure the target's tap
        target is generous even before any manual zoom.
      - **Inset / loupe panels** for dense micro-state clusters (as paper atlases do for Europe), or an
        enlarged always-on marker + label for below-threshold countries.
- [ ] **Reliable, unambiguous selection (map-locate)** — a below-threshold country's tap target
      reliably wins over its larger neighbours; clicking a neighbour registers **that neighbour** (never
      a false-positive for the tiny target); touch targets meet a comfortable minimum (~44px effective).
- [ ] **Legible reveal** — after answering, the picked and correct countries are clearly indicated even
      when tiny (e.g. ring/label/auto-zoom on reveal), so the player always sees what happened.
- [ ] **Responsive & touch-first** — works with mouse, trackpad, and touch; doesn't fight page scroll;
      respects `prefers-reduced-motion` (already honoured for the marker/transitions).
- [ ] **Performance & offline** — keep the single projection pass; no new network/deps beyond a small
      zoom helper; no regression to flag-only sessions (map code stays lazy-loaded via `MapBoard`).
- [ ] **Tests** — pan/zoom transform math or hit-target logic unit-tested where pure; a component test
      that a micro-state (e.g. LI) is reachable/selectable and that a neighbour click doesn't validate
      the target; existing `WorldMap`/`map-framing` tests still green.

## Technical notes
- **Prefer transforming the projected group over re-projecting.** The projection is computed once and
  memoized; a zoom/pan should apply an SVG/`d3-zoom` transform to the `<g class="countries">` (and the
  markers/hit-dots), so switching questions and zooming stay cheap.
- **Verify the LI/CH case specifically.** Determine whether there is an actual false-validation bug
  (neighbour click grading as correct) or "only" a legibility problem — the fix differs. The hit-dot is
  painted above country paths, so in principle LI's dot wins where it overlaps CH; confirm on a real
  touch device and at region/world framing.
- **A "fit region / reset" affordance** matters once free zoom exists, so a lost player can recover the
  default framing (which `map-framing.ts` already computes).
- Keep the marker/hit-dot fallbacks as a floor even if zoom lands — zoom helps deliberate inspection,
  but the target should be visible/selectable without requiring the player to zoom every question.

## Open Questions — to resolve with the owner
1. **Primary mechanism** — free pan/zoom, auto-focus on the target, inset/loupe for clusters, or a
   combination? (Recommendation: interactive pinch/scroll **zoom + pan** with a reset control, **plus**
   keep/raise the micro-state tap target and improve reveal legibility — zoom alone won't fix
   confidence.)
2. **map-highlight auto-zoom** — automatically zoom to the highlighted country each question, or keep
   the ring and let the player zoom manually?
3. **Confirm-to-answer in map-locate** — tap to place a pin, then confirm (prevents mis-taps and
   answers the "did it validate?" worry), or keep instant single-tap?
4. **Touch-target minimum & a11y** — target size floor; any keyboard/zoom accessibility expectations
   (a11y is otherwise Deferred in the main PRD)?
5. **Is there a real hit-detection bug** in the LI/CH case, or purely visibility? (Drives whether
   grading logic needs a fix vs. just rendering.)

## Acceptance criteria
- Every in-scope country, including micro-states, is **visible** and **selectable** in both map modes on
  desktop and mobile.
- In `map-locate`, selecting a country is unambiguous: a neighbour click never falsely validates the
  target, and the tiny target is reachable with a comfortable tap.
- After answering, the player can clearly see which country they picked and which was correct, even for
  micro-states.
- Fast loop green (`npm run test` / `check` / `lint`); a manual headless-Chrome check on :5180 that
  exercises Liechtenstein (highlight + locate) at world and region framing.

## Out of scope
- New map projections or a 3D/interactive globe.
- Non-map modes (flag/text) and the new game modes (23–25).
- Full accessibility overhaul (still Deferred in the main PRD) — this phase only avoids introducing a11y
  regressions and sets a reasonable touch-target floor.

## Progress log
- **2026-07-09 — PRD drafted after the owner hit the problem in play (Liechtenstein invisible; unsure
  whether clicking neighbouring Switzerland validated the answer in locate mode). Grounded in the
  current map implementation (`WorldMap.svelte` one-shot projection with 13px marker floor + `r=9`
  hit-dots for `<14px²` countries; `map-framing.ts` region fit; no pan/zoom). NOT built — awaiting the
  clarifying round and explicit build approval.**
