# Phase 12 — Visual polish, option imagery & map readability

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** 🟡 Decisions locked — NOT built (two Stage-1 builds reverted) · **Progress:** 5%
· **Track:** v1.1 enhancements (post-launch)

> **Note (2026-07-07):** Stage 1 has now been built **and reverted twice** at the owner's request —
> **no Phase 12 code exists in the tree.** The owner will (re)do this phase in a fresh **interactive**
> session and, per the process rule below, **implementation must not begin until the owner explicitly
> approves it.** The clarifying decisions, the resolved open questions, and the carry-forward findings
> in the Progress log are all retained to seed that session.

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
- [ ] **Map contrast/readability.** Non-highlighted countries fill with `--color-bg` (#f7f9fc)
      on a white `--color-surface` board with 0.4px `--color-border` strokes
      (`src/ui/components/WorldMap.svelte`), so land barely reads. Introduce map-specific colors
      (distinct land vs water/background, stronger borders, clear hover/selected states) so the
      **whole** map is legible, not just the selected country. Keep microstate visibility
      (existing marker ring + hit-dots).
- [ ] **Map framing / zoom.** Region-filtered sessions felt *too zoomed out* (owner tried
      "Central Europe → locate"). Tune the `geoNaturalEarth1().fitExtent` framing (currently
      `MARGIN = 6`) so a filtered region fills the board better — e.g. tighter padding, a zoom
      factor, or fitting to the sub-region bounds — while keeping some surrounding context.
      Consider whether interactive pan/zoom is wanted.
- [ ] **Option imagery.** Add flags/icons/pictures to answer options where it helps:
      flag thumbnails beside country names (`flag-to-country`, `map-highlight`), and mode/region
      iconography on the setup screen. `country-to-flag` already shows flags
      (`src/ui/components/ChoiceGrid.svelte`).
- [ ] **Micro-effects.** Tasteful transitions/animations (selection, correct/wrong feedback,
      streak flourish, map reveal), honouring `prefers-reduced-motion`.
- [ ] **Asset/offline budget.** Any new icons/images must stay bundled and PWA-precacheable
      (no runtime network); keep the cache budget reasonable.

### Stage 2 — alternative makeovers (gated on Stage 1 sign-off)
- [ ] **Present a few (owner picks how many) alternative full UI directions** — e.g. as
      side-by-side mockups / preview artifacts and/or a switchable live theme — covering layout,
      palette, typography, and component styling, for the owner to choose one to finalise.

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
