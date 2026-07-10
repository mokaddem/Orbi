# Phase 29 — Identity & Home polish (app name · mascot favicon · region-mastery breakdown)

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
· **Track:** v1.4 post-play feedback

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
A small cluster of identity and Home-screen polish items from the owner's play session, bundled because
each is light and two of them (name + favicon) are the same "what is this app called and what's its
face" concern:

- **Stage A — App name.** Give the app a real name (it's currently the literal "Geography Quiz").
- **Stage B — Mascot favicon.** Use the globe **mascot** as the favicon / app icon (today's favicon is
  a generic globe unrelated to the mascot introduced in Phase 18).
- **Stage C — Region-mastery breakdown on Home.** Make the Home "World mastery" bar reveal a per-region
  percentage breakdown when tapped (collapsible).

## The trigger (owner report)
> - "Find an application name."
> - "Use the mascot as favicon."
> - "On Home there's a 'World mastery' progress bar — clicking it should show, as a collapsible, the
>   percentage per region."

## In scope
- Choosing and wiring a product name across the visible/metadata surfaces.
- Replacing the favicon + PWA icon set with mascot-derived artwork.
- An expand/collapse interaction on the Home mastery meter revealing the existing per-region breakdown.

## Current state (so scope is clear)
### Stage A — name
- The name **"Geography Quiz"** (short **"Geo Quiz"**) is hard-coded in several places: `index.html`
  `<title>` + `apple-mobile-web-app-title`, the PWA `manifest.name` / `short_name` in `vite.config.ts`,
  and the on-screen `home.title` / `home.tagline` i18n strings (EN/FR/DE). Any rename touches all of
  these, in all three locales.

### Stage B — favicon / icons
- **The current favicon is not the mascot.** `public/favicon.svg` is a generic blue globe (grid lines,
  `#2b6cb0`). The PWA icon set — `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`,
  `apple-touch-icon.png` — predates the mascot too.
- **The mascot exists as inline SVG.** `Mascot.svelte` (Phase 18) draws a friendly globe character in
  several poses, duotone (turquoise land on a sea-tint body) with the outline in `currentColor`, colours
  derived from the `app.css` palette. It is a Svelte component, **not** a standalone asset file — a
  favicon needs a static, self-contained SVG (resolved colours, no `currentColor`/CSS vars) plus
  rasterized PNGs at the icon sizes.

### Stage C — Home mastery breakdown
- **Both pieces already exist.** `WorldMasteryMeter.svelte` renders the overall bar (a `compact` variant
  is shown on Home; `Home.svelte` `.mastery-row`). `RegionMasteryBreakdown.svelte` renders one row per
  region with silhouette + localized name + count + bar, and is already used elsewhere (History).
- **The data is already loaded.** `loadMastery()` returns `MasteryResult` = `{ overall, byRegion }`,
  with `byRegion` ordered least-complete first; Home already has `mastery` in state. So the breakdown
  needs **no new computation** — only a disclosure UI wiring `byRegion` into `RegionMasteryBreakdown`.
- **No expand/collapse affordance today.** The compact meter is static; there is nothing clickable.

## Depends on
Phase 18 (mascot) for Stage B; Phase 16 (mastery + `RegionMasteryBreakdown`) for Stage C; Phase 9 (PWA
manifest/icons) for Stage B wiring; Phase 8/17 (i18n EN/FR/DE) for Stage A strings. Stages are
independent and can land in any order or separately.

## Scope / Deliverables
### Stage A — app name
- [x] **Chosen name (owner decision).** Pick from a shortlist (see Open Questions) or the owner's own.
      Constraints: short, pronounceable, works in EN/FR/DE, evokes globe/geography/learning, fits the
      friendly globe mascot, and a `short_name` that stays legible under a home-screen icon (~12 chars).
- [x] **Wire it everywhere** — `index.html` title + apple title, `manifest.name`/`short_name`
      (`vite.config.ts`), and the on-screen title/tagline i18n (EN/FR/DE). Keep `<html lang>` and the
      description coherent. Decide whether the name is localized or a fixed brand across locales.
- [x] **Repo/docs touch-up (light)** — README/heading references if any; not a rename of the repo dir.

### Stage B — mascot favicon & icons
- [x] **Static mascot favicon** — produce a standalone `favicon.svg` derived from the mascot (resolved
      colours, no CSS vars / `currentColor`, a single legible pose — likely `wave` or a neutral face),
      framed to read at 16–32px. Keep it crisp and offline (inline SVG, no external refs).
- [x] **Regenerate the PNG icon set** from the same mascot artwork: `pwa-192x192.png`,
      `pwa-512x512.png`, `apple-touch-icon.png`, and a **maskable** 512 with adequate safe-zone padding
      so it isn't clipped to a circle awkwardly.
- [x] **Manifest/head wiring** stays consistent (theme colours, `includeAssets`, purposes) — verify the
      PWA still installs with the new icons and the favicon shows in a browser tab.

### Stage C — Home region-mastery breakdown
- [x] **Disclosure on the Home meter** — make the compact `WorldMasteryMeter` expand/collapse to reveal
      `RegionMasteryBreakdown` fed from `mastery.byRegion`. Accessible: a real button/toggle with
      `aria-expanded`, keyboard operable, `prefers-reduced-motion`-friendly if animated.
- [x] **Reuse, don't duplicate** — feed the existing `RegionMasteryBreakdown` component; don't fork a
      Home-specific breakdown. Keep the meter presentational (state/toggle in `Home.svelte` or a thin
      wrapper).
- [x] **Tests** — component test for the toggle (collapsed by default, expands to show region rows,
      aria state) and that Home renders the breakdown from `byRegion`.

### Cross-cutting
- [x] i18n parity (EN/FR/DE) for any new strings (name, "show/hide breakdown" labels).
- [x] Fast loop green; existing meter/mascot/manifest tests still pass.

## Technical notes
- **Name is mostly find-and-replace + a decision**, but it's spread across HTML, the Vite PWA manifest,
  and three locale files — inventory them first so none is missed (search for "Geography Quiz" / "Geo
  Quiz"). Decide up front: single global brand vs. localized name.
- **Favicon can't reference the component.** Extract the chosen pose's paths into a static SVG with
  literal fills (pull the actual token values from `app.css`), then rasterize to PNG at each size
  (bundle-time asset generation or a one-off export). Keep the maskable safe-zone in mind.
- **Stage C is genuinely small** — the component and data already exist; it's a disclosure wrapper. The
  main care is a11y (toggle semantics) and not re-loading mastery (it's already in Home state).
- These three ship independently — if the name decision stalls, Stages B/C need not wait (though the
  favicon ideally lands alongside or after the name so the icon set is regenerated once).

## Open Questions — to resolve with the owner
1. **App name** — pick one, or supply your own. Starter shortlist (globe/learning, EN/FR/DE-friendly):
   *Globe Trek · Atlas Quest · Terra · Worldly · GeoGlobe · Mappa · Globetrotter · Voyageo · Kaptn
   Globe (the mascot's name?)*. Which direction (playful vs. plain), and is the name **localized** or a
   **fixed brand**?
2. **Should the mascot get a name too** (used in copy / as the app name)?
3. **Favicon pose** — which mascot pose/expression reads best at 16–32px (recommend `wave` or a plain
   neutral face)? Full character or just the globe head?
4. **Icon regeneration** — is there an existing export pipeline/tool for the PNGs, or should this phase
   add a small one-off generator?
5. **Home breakdown** — collapsed by default (recommended) or expanded? Animate the disclosure or snap?
6. **Breakdown unit** — top-level regions (as `byRegion` gives today). Confirm this is the right
   granularity (ties into Phase 19).

## Acceptance criteria
- **Name:** the app presents a single chosen name consistently across tab title, installed-app name, and
  the Home screen, in EN/FR/DE; no stray "Geography Quiz"/"Geo Quiz" left where the brand should be.
- **Favicon:** the browser-tab favicon and installed PWA icons are recognizably the mascot; the PWA
  still installs and the maskable icon isn't awkwardly clipped.
- **Breakdown:** tapping the Home mastery bar reveals per-region percentages (reusing
  `RegionMasteryBreakdown`) and collapses again; it's keyboard-accessible and reduced-motion-friendly.
- Fast loop green (`npm run test` / `check` / `lint`); a manual headless-Chrome check on :5180 (tab
  favicon, Home title, and the expand/collapse) + a `preview` (:5181) install check for the icons.

## Out of scope
- A full rebrand/visual redesign beyond name + icon (the Playful visual layer is Phases 12/18).
- Renaming the git repository or deployment path.
- New mastery computation or a different mastery definition (Phase 16 owns that).

## Progress log
- **2026-07-10 — Built and verified (all three stages). Clarifying round resolved with the owner:**
  - **Name → `Orbi`** (fixed brand across EN/FR/DE), chosen as the **mascot's name that doubles as the
    app name** (resolves open Q1 + Q2 — the character *is* the brand). Owner shortlist iterated over
    two extra rounds; "Orbi" (from orb/orbit — round, friendly, tri-lingual) picked over Globo/Terra/
    Rondo. Deliberately avoided "Globi" (Swiss cartoon trademark).
  - **Favicon → candidate B: smile + inked outline** (open Q3), globe-head only (arms/shadow dropped)
    for 16–32 px legibility. Chosen from a live-SVG prototype comparing 2 expressions × 2 line
    treatments at true tab sizes on light/dark grounds.
  - **Home breakdown → collapsed by default, animated** (open Q5), top-level M49 regions (open Q6),
    reusing `RegionMasteryBreakdown` fed from `mastery.byRegion` (no new computation/re-fetch).
  - **Icon pipeline (open Q4): reused the existing `scripts/gen-icons.sh` (Inkscape).** Authored a
    static `public/favicon.svg` (resolved turquoise, inked outline, transparent) + matching
    `scripts/maskable-icon.svg` (Orbi on a padded accent-strong ground, inside the safe zone), then
    regenerated the 192/512/maskable/apple-touch PNGs.
  - **Wiring:** `index.html` (title/apple-title/description), `vite.config.ts` manifest
    (`name`/`short_name`/`description`), and `app.title` + `home.title` in en/fr/de → `Orbi`; the
    `home.demo` welcome line now names the mascot ("Hi, I'm Orbi …", trilingual); README H1 + intro.
  - **Coherence fix (in scope):** `theme_color`/`background_color` in the manifest **and** `index.html`
    still carried the pre-Playful blue `#2b6cb0`/`#f7f9fc`; realigned to turquoise `#10a5a0` / `#fff6f1`.
  - **Stage C a11y:** the whole compact meter is a real `<button aria-expanded aria-controls>` with an
    explicit `aria-label` and a rotating chevron; keyboard-operable and `focus-visible`. The reveal is a
    **CSS keyframe** (not a Svelte JS transition) — reduced-motion-friendly *and* deterministic under
    jsdom (Web Animations `element.animate` is absent there, which broke `transition:slide`).
  - **New i18n:** `home.mastery.showRegions` / `hideRegions` (en/fr/de).
  - **Verification:** `npm run check` (0 errors) · `npm run test` (453 pass, incl. a new Home disclosure
    test: collapsed-by-default, expand→region rows + progressbars, aria state, collapse) · `npm run lint`
    clean. Real-browser check on :5180 via CDP: title `Orbi`, meter renders, collapsed `aria-expanded=false`
    (breakdown absent) → click → `aria-expanded=true`, label flips, **5 region rows** shown. Prod build +
    :5181 preview install check: manifest (`name:"Orbi"`, `theme_color:#10a5a0`) + favicon.svg + all PNG
    icons serve 200; icons render as the recognizable Orbi mascot.**
- **2026-07-09 — PRD drafted from three light owner feedback items (app name; mascot favicon; Home
  mastery-bar per-region breakdown), bundled as one identity/Home-polish phase per the owner's
  preference for fewer PRDs. Grounded in: the hard-coded name across `index.html` / `vite.config.ts` /
  i18n; `public/favicon.svg` being a generic (non-mascot) globe while `Mascot.svelte` holds the real
  character as inline SVG; and Home already loading `MasteryResult.byRegion` with an unused
  `RegionMasteryBreakdown` component available. NOT built — awaiting the clarifying round and explicit
  build approval.**
</content>
