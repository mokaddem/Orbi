# Phase 18 — Playful visual layer (icons & imagery)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** 🟡 In progress · **Progress:** 100%
(implementation complete & verified — awaiting owner review of Stages 2–3, then merge + archive)
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
- [x] **Icon system** — `Icon.svelte` (24×24, `currentColor`, `aria-hidden`) over a generated registry
      (`icons.ts` via `scripts/build-icons.mjs`, 28 Lucide/ISC glyphs copied inline; `lucide-static` is
      a devDependency only). Applied to nav, actions, session chips, stat tiles, streak, mastery,
      achievements, unlock, daily.
- [x] **Spot illustrations** — `Mascot.svelte`, a six-pose globe (wave/celebrate/relaxed/sleepy/
      thinking/daily) on the Home hero, the "all caught up" state, and the empty/celebration states
      (History, Summary). Duotone via CSS vars, `currentColor` line.
- [x] **Achievements art** — every badge now has an inline-SVG glyph (continent badges keep the region
      silhouette); the grid reads visually, not as a text list.
- [x] **Consistency pass** — one `Icon.svelte` (name prop → registry) + `Mascot.svelte` (pose prop);
      `ModeIcon`/`RegionIcon` retained as domain glyphs. Only used icons are inlined (tree-shaken).
- [x] **A11y** — decorative art is `aria-hidden` (default); every icon sits beside a text label; no
      icon is the sole signifier of an action. No a11y regressions introduced.
- [x] **Budget check** — +~4.7 KB gzip total (JS +4.4, CSS +0.28); no runtime icon dependency; no new
      network requests for imagery. `npm run build` succeeds; prod build verified on the :5181 preview.
- [x] **Tests** — `Icon.test.ts` + `Mascot.test.ts` (14 tests) cover rendering, a11y modes, sizing,
      unique clip ids, and the daily calendar; existing component tests remain green (341 total).

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
- **2026-07-09 — Clarifying round resolved with owner; explicit go-ahead given (mascot concept first).
  Decisions:**
  - **Q1 Icon source:** *Hybrid* — copy only the used Lucide (ISC/MIT) icon paths inline into a small
    registry (no runtime dependency) for generic UI; keep hand-authored domain glyphs (`ModeIcon`,
    `RegionIcon`). A header/NOTICE credits Lucide's license.
  - **Q2 Illustration style:** *Richer duotone illustrations with a recurring mascot* — a friendly-globe
    character, one pose per key surface.
  - **Q3 Colour:** *Two-tone* — line in `currentColor` + a turquoise accent from the Phase 12 CSS vars.
    Nuance agreed: two-tone is the default for the mascot/illustrations and larger domain glyphs; tiny
    functional icons default to monochrome `currentColor` (accent variant for active/filled states).
  - **Q4 Rollout:** *Incremental, high-impact first* — Stage 1 (mascot concept → Home hero + Nav/action
    icons + empty states), Stage 2 (achievements art + emoji→SVG + session chips), Stage 3 (stat tiles +
    daily card). Review between stages.
  - **Q5 Photos:** *No raster photos* — vector only, per the flag/offline precedent.
  - Started on branch `phase-18-playful-visuals`. First deliverable: mascot concept (2–3 poses) rendered
    for sign-off before rolling it across screens.
- **2026-07-09 — Mascot concept approved** (owner: "approve the concept, add the daily pose"). Six poses:
  wave, celebrate, relaxed, sleepy, thinking, daily (globe holding a calendar). Generic name kept.
- **2026-07-09 — Foundation + Stage 1 built (fast loop green: 327 tests, 0 type errors, lint clean).**
  - `Mascot.svelte` — the six-pose globe; inline SVG, duotone via CSS vars, `currentColor` line,
    decorative `aria-hidden` (optional `label`). Verified in-app via headless Chrome.
  - Icon system — `scripts/build-icons.mjs` generates `icons.ts` (28 icons copied inline from Lucide,
    ISC; `lucide-static` is a **devDependency** used only as the source — no runtime icon dep) + a thin
    `Icon.svelte` house-style renderer.
  - Stage 1 surfaces: Home hero (wave mascot beside the title); `Nav` link icons (home/play/history/
    settings, text retained); Home action icons (custom/train); empty-state art — History (sleepy),
    Summary no-result (thinking), Summary perfect (celebrate).
  - Stage 1 reviewed and approved by the owner. Two follow-ups agreed: proceed to Stage 2, and add an
    "all caught up" state for the `relaxed` pose.
- **2026-07-09 — "All caught up" state + Stage 2 built (fast loop green: 327 tests, 0 type errors,
  lint clean).**
  - **All caught up:** Home now shows a relaxed-globe status ("You're all caught up — no mistakes to
    review!") when the player has progress but no training plan. New i18n key `home.caughtUp` in EN/FR/DE.
  - **Stage 2 (emoji → inline SVG):** `AchievementsGrid` badges (🎯💯🛡️⚡🔥📅🗺️💎👑🏅 →
    target/award/shield/bolt/flame/calendar/map/gem/crown/medal; continent badges keep `RegionIcon`);
    `StreakIndicator` + Play in-game streak (🔥 → flame, accent when lit); `WorldMasteryMeter` (🌍 →
    globe); History unlock banner (🎉 → party). Session-type chips (Fixed/Survival) gained
    list-checks / heart icons. The NextUpCard "fresh" glyph was already an inline `RegionIcon` (no
    change). Play lives (♥/♡) and the ✕ dismiss are plain text glyphs, left as-is.
  - Remaining: Stage 3 (stat-tile icons + daily-card mascot) and the cross-cutting budget/test pass.
- **2026-07-09 — Stage 3 + cross-cutting pass done (all deliverables ticked).**
  - **Stage 3:** History overview tiles gained accent icons (play/target/bolt/clock);
    `DailyChallengeCard` gained a calendar-check eyebrow icon + the daily-pose mascot as spot art.
  - **A11y:** audited all Icon/Mascot usages — all decorative (`aria-hidden`), all beside text, no
    icon-only actions.
  - **Bundle budget:** measured against `main` — +16.7 KB raw / **+4.4 KB gzip** JS, +0.28 KB gzip CSS
    (~4.7 KB gzip total), well under the ~15 KB budget. `lucide-static` confirmed absent from `dist/`.
    Prod build serves correctly on the :5181 preview (PWA precache intact, imagery all inline).
  - **Tests:** added `Icon.test.ts` + `Mascot.test.ts` (14). Full fast loop green: **341 tests**,
    svelte-check 0 errors, lint clean.
  - **Status:** implementation complete and verified across dev + prod preview. Awaiting the owner's
    review of Stages 2–3 before marking ✅ Done and merging to `main` + archiving.
