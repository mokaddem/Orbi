# Phase 12 — Visual polish, option imagery & map readability

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** 🟡 Stage 2 built app-wide (Playful + turquoise) & verified — awaiting final owner review · **Progress:** 95%
· **Track:** v1.1 enhancements (post-launch)

> **Note (2026-07-08):** Stage 1 signed off (commit `29ebfb3`). **Stage 2:** four full-UI directions
> were presented as preview artifacts; the owner chose **Playful & educational** and recolored the
> accent to **turquoise/teal (`#10A5A0`)**. That direction has now been **built into the real Svelte
> app, app-wide** (token-first restyle; domain logic untouched; Stage 1 map framing preserved) and
> verified (check/lint/224 tests/build + live headless screenshots of every screen). **Awaiting the
> owner's final review at `localhost:5180`; then Phase 12 → ✅ Done.** Details in the Progress log.

> ## ⚠️ Process requirement — get approval BEFORE building (MANDATORY)
> **NEVER start implementing this phase (or any phase) without the owner's explicit approval first.**
> Answering the clarifying questions is *not* approval to code — after the questions are resolved,
> present the plan and **wait for the owner to say "go" before writing any implementation.** This is a
> design task with strong subjective/taste elements, so:
> - **Ask** the owner (Sami) as many clarifying questions as necessary — and get answers — rather
>   than guessing; agree the *direction* and the concrete map/zoom targets up front.
> - **Then get explicit approval to begin**, and proceed in small, reviewable steps.
> - Confirm the functional fixes (Stage 1) with the owner **before** producing the alternative
>   makeovers (Stage 2).
> - Record answers and decisions in the Progress log.

## Goal
A general UI makeover, plus specific readability fixes the owner called out. Delivered in two
stages so the owner can react before a full restyle:

- **Stage 1 — fix & enrich the current UI:** option imagery (icons/flags/pictures), tasteful
  micro-effects, and — most importantly — a **readable map** (non-selected countries are
  currently barely visible, and region-filtered sessions are too zoomed out).
- **Stage 2 — propose alternatives:** once Stage 1 is agreed, present **a few alternative full
  UI design directions** for the owner to choose from.

## Depends on
Functional app (Phases 2–10). **Recommended: [Phase 11](archive/phase-11-input-answer-ux.md) first**, so
the makeover styles the final button/auto-advance interaction model rather than the old one.

## Scope / Deliverables

### Stage 1 — readability & enrichment
- [x] **Map contrast/readability.** New `--map-*` tokens in `src/app.css` (muted land `--map-land`
      on tinted water `--map-water`, soft-but-legible `--map-border`, accent-tinted `--map-land-hover`)
      wired into `WorldMap.svelte`, so the **whole** map reads, not just the selected country.
      Hover now uses a clear accent tint + accent stroke (a muted-land hover was too subtle).
      Highlight/reveal/wrong still pop; marker ring + hit-dots retained for microstates.
- [x] **Map framing / zoom.** Region-filtered sessions now frame to a robust MultiPoint over the
      members' **centroids** (`src/ui/components/map-framing.ts`, unit-tested), trimming a far
      isolated outlier (Russia in "Europe") via a ±60° floor + MAD gate and padding a small,
      capped context margin. Fixes "too zoomed out"; the whole world still fits when unfiltered.
      (Interactive pan/zoom not added — a fixed comfortable fit met the ask.)
- [x] **Option imagery.** Flag thumbnails beside the name options in **map-highlight** only
      (new `name-flag` variant in `ChoiceGrid.svelte`); **not** in `flag-to-country` (would
      trivialise it). Setup screen gains inline-SVG mode glyphs (`ModeIcon.svelte`) and continent
      silhouettes (`RegionIcon.svelte`) on the region cards.
- [x] **Micro-effects.** Feedback banner entrance, correct-answer pop, streak flourish, marker
      fade-in, and a button press response — all subtle and gated behind `prefers-reduced-motion`.
- [x] **Asset/offline budget.** Continent silhouettes generated offline at build time from the
      coarse 110m TopoJSON (`scripts/build-data.mjs` → `region-shapes.json`, ~17.5 KB, simplified +
      speck-culled), inlined into the JS bundle — no runtime geometry load. Mode glyphs are inline SVG.

### Stage 2 — alternative makeovers (gated on Stage 1 sign-off)
- [x] **Presented** four alternative full-UI directions as clickable static preview artifacts
      (Minimalist, Playful, Modern glossy, Map-atlas), each showing the setup + in-game screens on
      the real layout/copy with the actual glyphs, region silhouettes, and a generated Europe map.
- [x] **Owner picked: Playful & educational, turquoise/teal accent (`#10A5A0`).**
- [x] **Built the Playful + turquoise direction into the real app, app-wide** — token-first restyle,
      verified (check/lint/224 tests/build + live screenshots). Awaiting final owner review → ✅ Done.

## Technical notes
- Only a **single light theme** exists today (dark mode is in the main PRD's Deferred list) —
  clarify whether dark mode is now in scope. Colors are CSS variables in `src/app.css`.
- Map projection is computed once per session (memoized on `features` + `focusIsos`); framing
  changes should preserve that (don't re-project per question).
- Keep changes UI-layer; domain logic stays untouched.

## Open Questions — to resolve with the owner
Ask these (and more as needed) before building:
1. **Design direction / vibe:** minimalist, playful/education, modern/glossy, map-atlas
   aesthetic…? Any references or products you like the look of?
2. **Palette:** keep the current blue accent or reskin? Brand colors? Dark mode now, or stay
   deferred?
3. **Option imagery:** flags next to names for *all* text-option modes? Any other imagery
   (region silhouettes, continent icons)? Icon source (bundled SVG set — must stay offline)?
4. **Map framing:** how tight should a region fill the board — edge-to-edge or with context
   margin? Want zoom/pan controls, or a fixed fit? Any preference on the projection?
5. **Map colors:** preferred land/water treatment (e.g. muted land + light water, or the
   reverse)? Show country borders prominently or subtly?
6. **Motion:** how much animation is welcome vs. distracting?
7. **Stage 2 alternatives:** how many directions to propose, and in what form — static
   mockups, live switchable themes, or hosted preview pages?

## Acceptance criteria
- The full map is clearly legible (all countries, not just the selected one), and
  region-filtered sessions are framed at a comfortable zoom.
- Options carry helpful imagery; the UI has tasteful, reduced-motion-safe effects.
- Everything stays offline/PWA-friendly; fast loop green.
- Stage 1 is signed off by the owner, then a few alternative makeovers are presented and one is
  chosen.
- All owner questions above are answered and reflected in the work.

## Out of scope
- Interaction-model changes (buttons/auto-advance) — that's Phase 11.
- New content/modes.

## Progress log
- **2026-07-07 — Clarifying round done; Stage 1 decisions locked (owner).** These stand for the
  (re)implementation:
  1. **Map framing:** for region-filtered sessions, fit the region with a *small context margin*
     — it fills most of the board but a ring of surrounding countries stays visible.
     (Unfiltered/World sessions still show the whole world — can't zoom without revealing a
     locate answer.)
  2. **Map colors:** muted land + a tinted water/background + soft-but-legible borders, via new
     map-specific CSS tokens, so *every* country reads (not just the selected one).
  3. **Option flags:** add flag thumbnails to the name options in **map-highlight only**
     (`country-to-flag` already shows flags). **Not** in `flag-to-country` — the prompt is a flag
     there, so flags on options would trivialise it to picture-matching.
  4. **Setup icons:** mode + region icons as simple inline-SVG line/symbol glyphs (offline,
     consistent on every OS — no emoji, per the project's flag rationale).
  5. **Motion:** subtle & tasteful transitions (feedback, selection, map reveal, light streak
     flourish); always gated behind `prefers-reduced-motion`.
  6. **Dark mode:** out of scope for now — stays in the main PRD's Deferred list.
  - **Two-stage delivery:** Stage 1 (the above) → owner sign-off → Stage 2 (present a few
    alternative full makeovers; format/count decided at that point).
- **2026-07-07 — Stage 1 implementation reverted (owner request).** Built once, then reverted so
  the phase can be redone interactively; decisions above retained, no code left in the tree.
  Findings worth carrying forward:
  - **The "too zoomed out" root cause:** M49 regions like "Europe"/"Eastern Europe" include
    **Russia** (geometry to ~170°E), so fitting the projection to a region's *full geometry*
    blows the bounding box out to nearly half the globe. Fix that worked: frame to a robust box
    of member **centroids** (trim sprawling outliers) fit via a **MultiPoint** — a lat/lon
    *Polygon* triggers a d3-geo winding bug that zooms *out* instead of in. Not antimeridian-aware,
    so **Oceania** (Pacific spread) stays approximate — still open.
  - Map-locate hover needs a clear affordance (accent tint) since a muted-land hover reads as too
    subtle.
- **2026-07-07 — Stage 1 built a second time, then reverted again (owner request).** The build was
  done, verified green, and reviewed — then the owner asked to **revert all code** and (re)do the
  phase in a dedicated interactive session. No code remains in the tree; deliverables above are
  unchecked again. **Process lesson (now a hard rule at the top of this file and in CLAUDE.md):
  do NOT start implementing without the owner's explicit approval — answering clarifying questions
  is not a green light to code.** Everything below is retained to seed the next session.
  - **Still-open questions the owner answered (carry forward):**
    1. **Region buttons → add continent-silhouette icons** (not text-only).
    2. **Oceania framing → accept approximate** (don't fix the antimeridian now).
    3. **Stage 2 form → preview mockups** (present a few static preview artifacts, build only the
       chosen one) — for when Stage 1 is signed off.
  - **Findings that worked (carry forward), on top of the earlier revert's notes:**
    - Map colors via new `--map-*` tokens (muted land / tinted water / soft borders) made the whole
      map read; highlight/reveal/wrong still pop.
    - Map framing: fit a **MultiPoint** of samples along a padded box of member **centroids**.
      Crucial tuning — the outlier-trim floor should be **~±60°** (not tighter) and padding
      **capped (~12°)**: a tighter floor over-trims the **Americas** (the dense Caribbean skews the
      median/MAD), framing Canada and the southern cone off-screen. The gate should clip only a
      *far isolated* outlier (Russia) and keep continuous pole-to-pole spreads whole.
    - Option flags belong on **map-highlight** only; setup icons work as inline `ModeIcon` glyphs +
      continent `RegionIcon` silhouettes.
    - Continent silhouettes can be generated offline from coarse (110m) geometry at build time,
      simplified + speck-culled, to ~7.6 KB total — no runtime geometry load.
    - Micro-effects should stay subtle and `prefers-reduced-motion`-gated; the locate hover needs a
      clear accent tint.
- **2026-07-08 — Stage 1 built (third time), with explicit owner approval, and verified.** The owner
  said "Go" after the plan was presented, so implementation proceeded (per the process rule).
  Delivered exactly the locked decisions:
  - **Map readability** via new `--map-*` tokens (muted land / tinted water / soft borders) in
    `app.css` + `WorldMap.svelte`; hover now a clear accent tint.
  - **Map framing** extracted to a pure, unit-tested `src/ui/components/map-framing.ts`
    (`focusFrame()`): centroid-based robust box → MultiPoint fit, ±60° outlier floor + MAD gate,
    capped padding. Confirmed by screenshot that Europe frames with context and no Russia blow-out;
    world still fits whole.
  - **Option flags** on map-highlight only (`ChoiceGrid` `name-flag` variant); **mode glyphs**
    (`ModeIcon.svelte`) and **continent silhouettes** (`RegionIcon.svelte`) on the setup screen.
    Silhouettes generated offline in `build-data.mjs` (110m → merge → per-region recentre + Russia
    trim → Douglas–Peucker simplify + speck-cull → `region-shapes.json`, ~17.5 KB, no runtime fetch).
  - **Micro-effects**: feedback entrance, correct pop, streak flourish, marker fade-in, press
    response — all `prefers-reduced-motion`-gated.
  - **Verification:** `npm run check` + `npm run lint` clean; **224 Vitest tests pass** (added
    `map-framing.test.ts` and a `name-flag` `ChoiceGrid` case); `npm run build` (incl. `prebuild`
    data step) succeeds and precaches. Manual browser checks (setup, map-highlight, map-locate for
    Europe + World, hover, answered) all confirmed. No E2E harness exists in the repo to run.
  - **Next:** awaiting owner sign-off on Stage 1 before starting **Stage 2** (a few alternative
    full-UI makeovers, presented as static preview mockups per the earlier decision).
- **2026-07-08 — Stage 1 signed off by the owner.** Reviewed at `localhost:5180` and approved as-is
  ("perfect"), no tweaks requested. Stage 1 is final (commit `29ebfb3`). **Stage 2 is now unblocked:**
  present a few alternative full-UI design directions as static preview mockups (build only the chosen
  one, per the earlier decision). Count and vibes to be agreed with the owner before producing mockups.
- **2026-07-08 — Stage 2 mockups built & presented (owner approved: all four directions, clickable
  preview per direction).** Each preview shows the **setup** and **in-game (map-highlight)** screens on
  the *real* app layout/copy, reusing the actual `ModeIcon` glyphs and `region-shapes.json` continent
  silhouettes, plus a real Natural-Earth Europe map (France highlighted, framed to a clean Europe
  window — no Russia blow-out) generated offline; flags are simplified representative SVGs. Built by a
  single shared HTML/JS template with four distinct theme stylesheets, so the directions are strictly
  comparable. All four verified (setup + in-game + answered feedback states) via headless-Chrome
  screenshots before publishing. Directions & URLs:
  - **Minimalist / calm** — flat, hairline, deep-teal accent, uppercase labels:
    https://claude.ai/code/artifact/e8ab06d5-b28a-4049-b767-876c7e399166
  - **Playful & educational** — warm ground, coral accent, chunky rounded cards, springy press:
    https://claude.ai/code/artifact/bff298c1-4351-4e37-a439-bcef616b3863
  - **Modern glossy** — cool neutrals, indigo accent, glassy cards + soft depth, gradient brand:
    https://claude.ai/code/artifact/b6e0e354-336c-4d76-bf81-3963db6aa6a3
  - **Map-atlas / cartographic** — parchment + serif, graticule overlay + compass, goldenrod highlight:
    https://claude.ai/code/artifact/4c6dfe60-6972-4b1e-8d2a-2a1cbd46ee8d
  - Mockup sources kept in the session scratch dir (not committed — throwaway previews). **Decision
    pending: which direction to finalise.** Then build only that into the app (fresh go-ahead first).
- **2026-07-08 — Owner chose the Playful direction; accent recolored to turquoise/teal.** The owner
  liked Playful but not the orange; a side-by-side accent comparison (Berry / Cobalt / Turquoise /
  Grape vs. the current orange) was produced
  (https://claude.ai/code/artifact/bc686369-c266-46e5-bd6a-a2071f68fa89) and the owner picked
  **turquoise/teal**. The Playful mockup was recolored (accent `#10A5A0`, hover tint `#DBF3F1`, button
  shadow `#0B7E7A`, progress gradient `#4FD1CA→#10A5A0`, map highlight `#7FD9D3`/`#0B7E7A`) with
  everything else — warm ground, rounded chunky style, layout — unchanged, and re-verified via
  screenshots. The Playful artifact was updated in place (same URL, above). **Selected direction for
  the app build: Playful & educational + turquoise.** Build into the real Svelte app is the remaining
  Stage 2 work and needs a fresh explicit go-ahead before any app code changes.
- **2026-07-08 — Stage 2 built into the app, app-wide (owner go-ahead: "apply it app-wide").**
  Token-first restyle of the real Svelte app:
  - `src/app.css`: Playful palette (warm ground `#fff6f1`, turquoise accent `#10a5a0` + weak `#dbf3f1`
    / strong `#0b7e7a` tints, warm map tokens, turquoise highlight `#7fd9d3`/`#0b7e7a`), `--radius`
    16px, a Trebuchet-led rounded font stack, shared treatment tokens (`--shadow-chunky[-press]`,
    `--shadow-card`, `--ring-selected`, `--progress-gradient`), and a global `:focus-visible`.
  - Components: chunky 2px rounded cards with a soft drop + springy `translateY(-2px)` hover,
    accent-weak selected fills with a selection ring, gradient progress bar, chunky accent buttons
    (press-down on `:active`), turquoise brand / active nav pill / streak. Touched `Play`, `ChoiceGrid`,
    `Nav`, `Home`, `Summary`, `History`, `SegmentedControl`, and `WorldMap` (warm 2px map frame,
    turquoise-tint highlight + darker outline, darker marker ring). New motion is
    `prefers-reduced-motion`-gated. **No component had hardcoded colours** (all token-driven), so the
    palette propagated app-wide from `app.css`.
  - Domain logic untouched; the map framing is left exactly as the signed-off Stage 1 `focusFrame`.
  - **Verified:** `npm run check` (0 errors/0 warnings) + `npm run lint` (eslint + prettier) clean;
    **224 Vitest tests pass**; `npm run build` succeeds (PWA precache 56 entries). Drove the **live dev
    app** headless over the DevTools protocol and screenshotted Home, Play setup, in-game map-highlight
    (real world map with the turquoise highlight + marker and flag-thumbnail options), History, and
    Settings — all consistently themed. **Awaiting the owner's final review at `localhost:5180`; then
    Phase 12 will be marked ✅ Done.**
