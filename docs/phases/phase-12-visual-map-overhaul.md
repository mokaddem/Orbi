# Phase 12 — Visual polish, option imagery & map readability

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
· **Track:** v1.1 enhancements (post-launch)

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This is a design task with strong subjective/taste elements. **The implementer MUST ask the
> owner (Sami) as many clarifying questions as necessary — and get answers — before and during
> implementation, rather than guessing.** In particular, agree the *direction* and the concrete
> map/zoom targets up front. Do not begin the makeover until the
> [Open Questions](#open-questions--to-resolve-with-the-owner) are resolved, and confirm the
> functional fixes (Stage 1) with the owner **before** producing the alternative makeovers
> (Stage 2). Record answers and decisions in the Progress log.

## Goal
A general UI makeover, plus specific readability fixes the owner called out. Delivered in two
stages so the owner can react before a full restyle:

- **Stage 1 — fix & enrich the current UI:** option imagery (icons/flags/pictures), tasteful
  micro-effects, and — most importantly — a **readable map** (non-selected countries are
  currently barely visible, and region-filtered sessions are too zoomed out).
- **Stage 2 — propose alternatives:** once Stage 1 is agreed, present **a few alternative full
  UI design directions** for the owner to choose from.

## Depends on
Functional app (Phases 2–10). **Recommended: [Phase 11](phase-11-input-answer-ux.md) first**, so
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
- _(none yet)_
