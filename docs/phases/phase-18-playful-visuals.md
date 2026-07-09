# Phase 18 — Playful visual layer (icons & imagery)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
· **Track:** v1.3 content, languages & new modes

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Give the app more **visual character**. Today it is functional but text-heavy: outside of flags and
the map, most screens are labels and buttons. Add a **cohesive, bundled, offline** icon + light
illustration layer so Home, empty states, the summary, achievements, stats, and the daily card feel
playful and inviting — without adding heavy dependencies, network requests, or breaking the
offline-first PWA guarantee.

## In scope
- A consistent visual **icon set** applied where the UI is currently text-only (actions, nav, mode
  cards, session-type chips, stat tiles, achievements).
- Light **illustrations / spot art** for the moments that most benefit: the Home hero, empty states
  (fresh History, no-mistakes-to-train, perfect summary), and the Daily Challenge card.
- Keeping everything **inline/bundled SVG** so it renders identically on every OS and works offline.

## Current state (so scope is clear)
- **Phase 12** already did a visual pass: a "Playful + turquoise" palette and option imagery were built
  app-wide and signed off. This phase is the **next layer** — iconography and spot illustration — on top
  of that palette, not a re-theme.
- **Existing vector assets to extend, not replace:**
  - `src/ui/components/ModeIcon.svelte` — hand-authored inline-SVG line glyphs, one per `GameMode`,
    `stroke="currentColor"` so they follow the card's colour. This is the house style to follow (the
    same "inline SVG, not emoji, crisp on every OS" rationale the project uses for flags).
  - `src/ui/components/RegionIcon.svelte` + `src/data/generated/region-shapes.json` — per-region
    continent silhouettes generated offline. Reusable as playful region art elsewhere.
- **Text-only spots today** (candidates): Home actions, `Nav.svelte` links, session-type chips,
  `history.stats.*` tiles, `progress.achievements.badges.*` (title/desc text, no glyphs), empty states
  across History / Summary / training hint, and the Daily card.
- **Constraints baked into the project:** PWA + offline, "keep dependencies minimal", and the flag
  precedent of bundling vector assets rather than relying on the platform/emoji or a CDN.

## Depends on
Phase 12 (visual polish & palette). Independent of the other v1.3 phases; it only adds presentation.

## Scope / Deliverables
- [ ] **Icon system** — a small, consistent set of inline-SVG icons (house style from `ModeIcon`:
      24×24 viewBox, `currentColor`, `aria-hidden`), either hand-authored or sourced from one bundled
      MIT icon set (Open Question). Applied to the agreed text-only spots.
- [ ] **Spot illustrations** — a handful of lightweight decorative SVGs for the Home hero + the key
      empty/celebration states, in one coherent style. Theme-aware via CSS vars, not baked colours.
- [ ] **Achievements art** — give each badge (or badge tier) a glyph so the achievements grid reads
      visually, not as a text list.
- [ ] **Consistency pass** — a single place/pattern for icons (e.g. an `Icon.svelte` with a `name`
      prop, or per-purpose components mirroring `ModeIcon`) so usage stays uniform and tree-shakeable.
- [ ] **A11y** — decorative art is `aria-hidden`; any icon that carries meaning on its own gets an
      accessible label. No icon becomes the *only* signifier of an action without a text label.
- [ ] **Budget check** — confirm the added assets stay within an agreed bundle-size budget and don't
      regress the PWA/offline build (`npm run build` + preview on :5181).
- [ ] **Tests** — component tests that the new icons/illustrations render on their target screens;
      existing component tests updated for the new markup.

## Technical notes
- **Bundled, not fetched.** Everything must be inline SVG or a bundled asset — no remote images, no
  icon CDN, no network at runtime. This preserves offline play and the PWA cache story.
- **Follow the flag/`ModeIcon` precedent** for the *why*: vector, OS-independent, colour via
  `currentColor`/CSS vars so light/dark and the turquoise palette both work.
- If a third-party icon set is chosen, import **only the used icons** (tree-shaken or copied as inline
  SVG) to respect "keep dependencies minimal" and the bundle budget.
- Prefer enhancing existing components over new wrappers where a component already owns the surface
  (e.g. add art to `DailyChallengeCard`, `AchievementsGrid`, the History empty state) rather than
  bolting on a parallel layer.

## Open Questions — to resolve with the owner
1. **Icon source** — hand-author inline SVGs in the `ModeIcon` style (full control, more effort) or
   bundle a tree-shaken MIT set (e.g. Lucide/Heroicons) for breadth? (Recommend: bundled MIT set for
   generic UI icons, hand-authored for domain-specific ones like modes/regions.)
2. **Illustration style** — flat line, filled/duotone, or richer spot illustrations? Any mascot or
   recurring motif (globe, compass, passport)?
3. **Colour** — monochrome `currentColor` only, or multi-colour using the Phase 12 turquoise palette?
4. **Screen priority** — which screens matter most first (Home + empty states vs. achievements vs.
   everywhere)? Ship incrementally?
5. **Photos?** — the ask mentions "pictures". Recommend **no raster photos** of countries/landmarks
   (licensing, bundle size, offline weight, upkeep); stick to vector art. Confirm.

## Acceptance criteria
- The agreed screens carry consistent, on-brand iconography and/or spot illustration; the app no
  longer reads as text-only outside flags/map.
- Everything is bundled and renders offline (verified against the preview build on :5181); no runtime
  network requests for imagery.
- Theme/palette-consistent (light/dark + turquoise); decorative art is `aria-hidden`, meaningful icons
  are labelled.
- Bundle stays within the agreed budget; `npm run build` succeeds.
- Fast loop green (`npm run test` / `check` / `lint`); manual headless-Chrome check on :5180.

## Out of scope
- Re-theming or palette changes (owned by Phase 12).
- Animation/motion design beyond incidental transitions (could be a later phase).
- Raster photography / country landmark imagery (see Open Question 5).
- Full accessibility overhaul (still Deferred in the main PRD) — this phase only avoids *introducing*
  a11y regressions.

## Progress log
- **2026-07-09 — PRD drafted from the owner's v1.3 improvement list ("more playful icons and pictures
  overall"). NOT built — awaiting the clarifying round and explicit build approval.**
