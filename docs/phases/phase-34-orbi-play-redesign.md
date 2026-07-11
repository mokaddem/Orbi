# Phase 34 — "Orbi Play" visual redesign (mobile & desktop)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ✅ Done (built & verified; pending merge/archive) · **Progress:** 100%
· **Track:** v2.0 visual redesign

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Reskin the whole app in the **"Orbi Play"** direction — a bright, tactile, game-app look — and make it
work equally well on **mobile and desktop**. It keeps the two hard constraints (the **Orbi** mascot and
the **teal** accent) and stays rounded/chunky, but moves off the current warm-cream Phase-12 theme onto a
cool-white ground with coral/sunshine secondary accents, and replaces the wrapping top nav with a
**responsive navigation** (a bottom tab bar + raised Play button on mobile; a left sidebar rail on
desktop). **Presentation only** — no new game modes, data, or domain logic.

## The trigger (owner request)
> "I like A, Orbi Play! Make sure that design also translates correctly on Desktop. Mobile is important
> but desktop as well. Now prepare a PRD to implement A for both mobile and desktop." — owner, after
> reviewing a three-direction redesign prototype (directions **A · Orbi Play**, **B · Cartographer**,
> **C · Explorer HUD**). **A was chosen; B & C are retired.**

## Reference prototype (source of truth for the look)
An interactive comparison gallery shows **Orbi Play on both mobile and desktop for every screen**:
- Artifact: https://claude.ai/code/artifact/3a904286-8049-49bc-992b-df10545e7d6e
- It is a faithful HTML/CSS glance-prototype (not the real Svelte components): CSS-drawn flags, a
  stylized world map, and inline Orbi SVGs. Implementation should match its **spirit and layout**, using
  the app's **real** components (D3 maps, bundled SVG flags, `Mascot.svelte`), not copy its shortcuts.

## In scope
- A new **design-token set** in `src/app.css` (the "Orbi Play" palette + radii + shadows + font stack),
  keeping teal as the accent. Every component already styles through these tokens (Phase 12).
- A **responsive navigation + app shell**: mobile bottom tab bar with a raised center **Play** button and
  a slim top app-bar; desktop **left sidebar rail**. Replaces today's single wrapping top `<header>`.
- **Component restyle** (through tokens where possible; structural tweaks where needed): buttons (pill +
  chunky drop + press), cards, chips/pills/"sticker" tags, `SegmentedControl`, stat tiles, progress
  meters, `ChoiceGrid`, mode/region/format cards, `Practice` accordions, toggles, `AtlasRegionGrid` cards.
- **Per-page desktop layouts** (multi-column where the content warrants it) so nothing is a lonely narrow
  column on a wide screen, and the focused screens (Play, Summary) stay centred rather than stretched.
- **Mascot**: Orbi more present in the Home hero and the brand mark; keep Phase-33 reactive placements.
- Trilingual copy (EN/FR/DE) for any genuinely new label; PWA `theme-color`/manifest colours updated.

## Current state (so scope is clear)
- **Theme (Phase 12 "Playful"):** warm-cream ground (`--color-bg: #fff6f1`), turquoise accent
  (`--color-accent: #10a5a0`), warm borders, rounded/chunky components, `--radius: 16px`,
  `--shadow-chunky`, `--progress-gradient`. Everything reads through these tokens in `src/app.css`.
- **Shell / nav (`App.svelte` + `Nav.svelte`):** a **single top `<header class="nav">`** — brand "Orbi",
  the six links (Home · Play · Atlas · History · Progress · Settings) and the EN/FR/DE `LanguageSwitcher`.
  Below `900px` the links **wrap to a second full-width row** (no bottom nav, no drawer). Content is a
  centred `<main>` at `--max-width: 900px`. **This is the layout the redesign replaces.**
- **Routes (unchanged in count):** Home, Play (setup + live game), Summary, Practice, History, Progress,
  Atlas, Atlas Region, Atlas Country, Settings, NotFound. `PageHero` puts an idle Orbi beside most `<h1>`s.
- **Mascot:** `Mascot.svelte` — 9 poses, motion (Phase 33), reduced-motion aware; the brand identity
  (Phase 29). **No user account/name exists** (single-user, no login) — greetings can't be personalised.
- **Data/features:** complete (v1.x). This phase adds **none** — it re-presents what's there.
- **Asset rule (unchanged):** bundled inline vector / SVG flags / TopoJSON, offline, no CDN, no fetch.

## Depends on
Phase 12 (visual system / token architecture), Phase 18 (icons & mascot), Phase 29 (Orbi identity),
Phase 30 (History/Progress split — final page set), Phase 33 (motion foundation & reduced-motion toggle).
Supersedes the *look* of Phase 12 while reusing its **token mechanism**.

## Responsive strategy (the "works on desktop too" requirement)
Mobile-first, with a single primary breakpoint (recommend **≈860px**):
- **Mobile (≤ breakpoint):** one scrolling column. A **bottom tab bar** (fixed) with a raised center
  **Play** FAB is the primary nav; a slim **top app-bar** carries the brand, language, and Settings.
  Content gets bottom padding to clear the bar. Focused screens (Play/Summary) hide chrome as today.
- **Desktop (> breakpoint):** a **left sidebar rail** (brand · prominent Play button · nav · language ·
  Settings) with the content to its right, capped at a comfortable width (recommend **~1100–1200px**).
  Content-rich pages become multi-column; focused screens stay centred (≤~640px), never stretched.
- **Per-page desktop layout (from the prototype):**
  - **Home** — hero greeting + full-width "resume" banner, then a two-column grid (daily + quick-start
    modes · world-mastery with region bars).
  - **Play** — centred board (HUD → prompt/flag/map → choices → feedback); never full-bleed.
  - **Summary** — single centred results card.
  - **Practice** — two panes: country picker + a persistent "what you'll play" panel (mode/format/Start).
  - **History** — full-width activity chart, then two columns (most-missed · recent sessions).
  - **Progress** — hero mastery card + stat row, then two columns (region breakdown + extra knowledge ·
    achievements grid).
  - **Atlas** — region grid widens 2→4 columns; A–Z list flows into columns.
  - **Atlas Region** — map banner + heading, sub-region members in multi-column chips.
  - **Atlas Country** — two columns: flag + facts · "Did you know?" + locator map.
  - **Settings** — a single comfortable centred column.

## Scope / Deliverables
- [x] **Design tokens (`src/app.css`)** — the Orbi Play palette: cool-white ground (`#eafaf8`), surface
      `#fff`, teal accent **retained** (kept `#10a5a0` literally) with `accent-strong #0b7e7a` /
      `accent-weak #d6f4f0`, coral (`#ff7a59`) + sunshine (`#ffb020`) secondaries, cool map palette,
      rounder radius (20px), chunky button drop + press, rounded meters. Correct/wrong greens/reds kept.
- [x] **Responsive nav + shell** — new `Nav`/shell: mobile bottom tab bar + raised Play FAB + slim top
      app-bar; desktop left sidebar rail; `App.svelte` is rail-plus-content on desktop, column-plus-
      bottom-bar on mobile. `aria-current`, one `<nav>` landmark per breakpoint, focus-visible, safe-area
      insets. The wrapping top-nav layout is gone.
- [x] **Component restyle** — pill CTAs (chunky press), cards, chips/tags, `SegmentedControl`, stat tiles,
      meters, `ChoiceGrid`, mode/region/format option cards, `Practice` accordions & toggles,
      `AtlasRegionGrid` cards — all through the new token language; press/hover states; reduced-motion
      respected. Sunshine flame is the one sparing warm accent (icon-only, AA-safe).
- [x] **Per-page desktop layouts** — grids/max-widths for all screens; no horizontal overflow at any
      width; focused screens (Play/Summary/Settings) centred, dashboards (Home/History/Progress/Practice/
      AtlasCountry) multi-column. Verified at ~390px and ~1280px with seeded data.
- [x] **Mascot** — Orbi larger in the Home hero (108px) + the rail/app-bar brand mark; Phase-33 reactive
      beats kept; decorative/aria-hidden.
- [x] **Copy & i18n** — no fake personalization; Home greeting in Orbi's voice; no genuinely-new label was
      needed (nav/shell reuse existing keys), verified in EN/FR/DE (bottom-bar labels fit at 390px).
- [x] **PWA/meta** — manifest `background_color` → cool ground `#eafaf8`; `theme_color`/`theme-color` kept
      teal `#10a5a0`; favicon unchanged.
- [x] **Tests / checks** — `npm run test` (492) / `check` / `lint` all green (no test churn — no test
      asserted the old nav markup); headless-Chrome captures of all screens at ~390px and ~1280px, a
      reduced-motion capture, and live map-locate + answered-flag boards (bottom bar clears the answer
      surface); production build clean, no bundle jump; PWA manifest regenerated. Playwright is not in the
      repo (per project convention) — critical flows exercised via headless-Chrome drives instead.

## Technical notes
- **Reskin through the token layer, not a rewrite.** The whole app already styles through `app.css`
  custom properties (Phase 12). Most of the new look is new token values; budget the real structural work
  for the **nav/shell** and the **per-page desktop grids**.
- **Nav is the one genuinely new component.** Build it responsive from one source of truth (`navLinks`
  already exists in `routes.ts`); render as bottom bar + FAB under the breakpoint and as a rail above it
  (CSS-driven where possible, so there's a single accessible link list). Mind fixed-bar overlap, keyboard
  order, and `env(safe-area-inset-*)` on mobile.
- **Keep it offline & dependency-light.** No CSS framework, no icon CDN, no webfont fetch — reuse the
  bundled Lucide icon set, `Mascot.svelte`, SVG flags and D3 maps. If a rounded display face is wanted,
  self-host/bundle it; do not link a font CDN (breaks offline/PWA).
- **Teal is kept, ground is cooler.** The accent barely moves (`#10a5a0`→`#0fb0aa`); the visible change is
  the **ground** (warm cream → cool mint-white) and the **secondary accents** (coral/sun). Flag OQ 5.
- **Accessibility.** Preserve focus-visible rings, keep AA contrast for text and teal-on-white, label the
  nav, and keep every animation (incl. the chunky button press) under `prefers-reduced-motion` / the
  in-app toggle (Phase 33).
- **Expect component-test churn.** Tests asserting the old top-nav structure/classes will need updating;
  domain unit tests are unaffected (no logic change).

## Open Questions — to resolve with the owner

> **Resolved 2026-07-11 (owner) — recommended defaults accepted:** (1) mobile bar = Home · Atlas ·
> **Play(FAB)** · History · Progress, with **Settings** in the top app-bar; (2) breakpoint ~860px, content
> cap ~1160px; (3) Home greeting in **Orbi's voice, no user name** (no account exists — never surface a
> personal name); (4) coral + sunshine introduced **sparingly** alongside teal; (5) **cool mint-white**
> ground; (6) rollout tokens + shell/nav first, then per-route; (7) tracked as **v2.0**. All baked into the
> Implementation plan below.

1. **Mobile bottom-bar composition** — with **Play** as the raised FAB, which four destinations flank it,
   and where do the rest live? *Recommended:* tabs = Home · Atlas · **Play(FAB)** · History · Progress;
   **Settings** via a gear in the slim top app-bar (and in the desktop rail). Practice stays reachable
   from Play/Home.
2. **Desktop breakpoint & max width** — confirm ~860px switch to the rail and a ~1100–1200px content cap
   (vs. fully fluid).
3. **Home greeting copy** — there is **no user name**. Use Orbi's voice ("Hi, I'm Orbi — ready to explore?")
   or a neutral time-based greeting? *Recommended:* Orbi's voice; no fake personalization.
4. **Secondary accents** — introduce coral (`#ff7a59`) + sunshine (`#ffb020`) alongside teal (streaks,
   highlights, danger), or stay teal-only? *Recommended:* introduce, used sparingly.
5. **Ground colour** — adopt the cool mint-white ground (departs from today's warm cream), or keep a warm
   ground with the rest of Orbi Play? *Recommended:* cool ground (as prototyped).
6. **Rollout** — one feature branch built page-by-page behind the new shell (tokens + nav first, then each
   route), reviewed via screenshots — or a different sequence? *Recommended:* tokens + shell/nav first.
7. **Version label** — record this as **v2.0** (a ground-up reskin), matching the Status-Table section?

## Implementation plan

Resolved decisions are baked in. Build order: **tokens → shell/nav → shared components → per-route layouts
→ copy/PWA → verification**, on a local `phase-34-orbi-play` branch (repo has no remote), committing per
stage. **Do not start until the owner gives an explicit build go.**

### Stage 0 — Branch & baseline
- Create branch `phase-34-orbi-play`.
- Confirm a green baseline: `npm run test` / `check` / `lint`. Capture "before" headless-Chrome shots of
  all ten routes at ~390px and ~1280px for before/after comparison.

### Stage 1 — Design tokens (`src/app.css`) — recolour, no structural change
- Repoint `:root` values, **keeping the token names** so components need no edits:
  - `--color-accent` **stays `#10a5a0`** (teal kept). `--color-accent-strong` `#0b7e7a`;
    `--color-accent-weak` → cool tint (~`#d6f4f0`).
  - Ground: `--color-bg` → **cool mint-white** (~`#eafaf8`); `--color-surface` `#ffffff`; `--color-border`
    `#d3efeb`; `--color-text` `#123130`; `--color-muted` `#6e8a88`.
  - `--map-*` retuned to the cool ground; keep the highlight turquoise.
  - `--radius` 16→~20px; keep `--shadow-chunky` / `--shadow-chunky-press`; `--progress-gradient` stays teal.
- Add tokens: `--color-coral` `#ff7a59`, `--color-sun` `#ffb020` (secondary accents, used sparingly);
  layout tokens `--content-max` (~1160px), `--rail-width` (~214px), `--bottombar-h`.
- Swap to a rounded system font stack (`ui-rounded, 'SF Pro Rounded', 'Segoe UI', system-ui, 'Trebuchet
  MS', …`). A bundled rounded display face may come later — **self-hosted, never a CDN** (offline/PWA).
- **Verify:** the app recolours everywhere with no layout change; screenshot Home/Play to confirm teal.

### Stage 2 — App shell + responsive nav (the one structural change)
- `App.svelte` → responsive shell:
  - **> ~860px:** grid `var(--rail-width) 1fr` — left `<Nav>` rail + `<main>` (capped at `--content-max`,
    centred).
  - **≤ ~860px:** single-column `<main>` + fixed bottom `<Nav>` + a slim top app-bar (brand · language ·
    Settings gear). `<main>` gets `padding-bottom: var(--bottombar-h)`; honour `env(safe-area-inset-*)`.
- `Nav.svelte` → one accessible `<nav aria-label>` fed by `navLinks`; CSS switches rail ↔ bottom bar:
  - **Mobile bar:** Home · Atlas · **Play (raised FAB)** · History · Progress. Settings in the top app-bar.
  - **Desktop rail:** brand (Orbi mark + "Orbi") · prominent **Play** button · Home · Atlas · History ·
    Progress · (spacer) · Settings · language.
  - `aria-current="page"` on active; keep hash hrefs; visible focus rings; logical tab order. Mark **Play**
    special (FAB/primary) via `navLinks` in `routes.ts` or a branch in `Nav`. Reuse `LanguageSwitcher`.
- **Verify:** nav at both widths, keyboard-only, SR landmark/`aria-current`; screenshots.

### Stage 3 — Shared component restyle (token-driven; light structural tweaks)
- Standardise the chunky pill CTA (radius 999px, `--shadow-chunky`, press = `--shadow-chunky-press` + 2px
  translate, **gated by reduced-motion**); apply to the main CTAs.
- Restyle via tokens + light CSS: `SegmentedControl`, `ChoiceGrid` (bubble tiles), stat tiles, meters
  (rounded), cards, chips/"sticker" tags, `AtlasRegionGrid` cards, `Practice` accordions & toggles,
  `StreakIndicator`, `WorldMasteryMeter`, `NextUpCard`, `DailyChallengeCard`.
- Orbi larger in the Home hero + brand mark; keep Phase-33 reactive beats; decorative/aria-hidden.
- **Verify:** update component tests asserting old markup; screenshots per component.

### Stage 4 — Per-route desktop layouts (route-by-route)
Add a `>860px` grid to each route; mobile stays single-column. Order: Home → Play → Summary → Practice →
History → Progress → Atlas → AtlasRegion → AtlasCountry → Settings → NotFound.
- **Home** hero + full-width resume banner, then 2-col (daily + quick-start modes · mastery + regions).
- **Play / Summary** centred (≤~640px) — never stretched.
- **Practice** 2-pane (picker · persistent mode/format/Start panel).
- **History** full-width chart, then 2-col (most-missed · recent). **Progress** hero mastery + stat row,
  then 2-col (regions + extra · achievements).
- **Atlas** region grid 2→4 col + A–Z into columns. **Region** map banner + multi-col members. **Country**
  2-col (flag+facts · did-you-know + locator). **Settings** single centred column. **NotFound** centred,
  larger Orbi.
- **Verify:** each route at ~390px and ~1280px; no horizontal overflow; the mobile bottom bar must not
  cover the map-locate answer surface.

### Stage 5 — Copy, i18n & PWA
- Home hero greeting in **Orbi's voice with no personal name** (reuse `home.demo` "Hi, I'm Orbi — ready to
  explore the world?" or a neutral line). Add any genuinely new label (e.g. "Quick Play", "Jump into a
  mode") to `en.ts` / `fr.ts` / `de.ts`.
- PWA: update `theme-color` (index.html) + manifest `theme_color`/`background_color` (vite PWA config) to
  the new ground/teal. Favicon / mascot icons unchanged (Phase 29).

### Stage 6 — Tests, verification & a11y
- Update component tests broken by the nav/markup change; `npm run test` / `check` / `lint` green.
- Headless-Chrome captures of all ten routes at ~390px and ~1280px + one reduced-motion capture.
- Playwright E2E smoke (fixed + survival + map-locate + reload persistence) on :5180 at the phase boundary.
- Production build: no bundle-size regression; PWA/offline check on :5181.
- A11y: AA contrast (teal & text on cool-white; coral/sun), focus-visible, nav landmark + `aria-current`,
  all motion (incl. the button press) off under `prefers-reduced-motion` / the in-app toggle.

### Risks & mitigations
- **Nav rewrite is the main risk** — one link list, CSS-switched by breakpoint; verify keyboard + SR.
- **Component-test churn** from markup changes — update tests alongside each component (domain untouched).
- **Bottom-bar overlap** on mobile (esp. the Play map surface) — content padding + safe-area; verify the
  map-locate answer isn't covered.
- **"Keep teal"** — `--color-accent` stays `#10a5a0` literally; the visible change is ground + secondaries
  + the nav.

## Acceptance criteria
- The app app-wide reads as **Orbi Play** — cool-white ground, teal accent **retained**, coral/sun
  secondaries, chunky rounded components, Orbi prominent — matching the approved prototype's spirit.
- **Responsive nav** works: mobile bottom tab bar + raised Play FAB; desktop left sidebar rail; all six
  destinations reachable at both sizes; `aria-current` + landmarks correct; the wrapping top nav is gone.
- **Every screen** is well-composed at **mobile (~390px)** and **desktop (~1280px)** — no horizontal
  scroll; focused screens (Play/Summary) centred not stretched; dashboards go multi-column on desktop.
- Reduced motion honoured (incl. button press), focus-visible intact, AA contrast for text/teal.
- Fast loop green (`test` / `check` / `lint`), affected component tests updated; headless-Chrome captures
  of all ten screens at both widths (+ a reduced-motion capture); Playwright smoke green; no bundle jump.

## Out of scope
- **No feature/logic/data changes** — game modes, SR, stats, i18n content, persistence all unchanged.
- **Directions B (Cartographer) and C (Explorer HUD)** — retired, not built.
- **A dark theme** (C's dark look was not chosen) — a possible future phase, not this one.
- **New mascot poses / new animations** — Phase 33 owns motion; this reuses it.
- **A new nav *information architecture*** beyond the responsive presentation — same destinations, just
  re-presented (bar/rail). Any re-grouping is out unless OQ 1 decides otherwise.

## Progress log
- **2026-07-11 — Built & verified (all six stages) on branch `phase-34-orbi-play`.** After the owner's
  explicit build go, implemented the redesign stage-by-stage:
  - **Tokens** (`app.css`): cool mint-white ground `#eafaf8`, teal accent kept `#10a5a0`, cooler
    text/borders, coral+sunshine secondaries, radius 16→20px, layout tokens (`--content-max`,
    `--rail-width`, `--bottombar-h`), rounded system-font stack. Pure recolour — cascaded app-wide.
  - **Shell + nav**: rewrote `App.svelte` (desktop rail-plus-content / mobile column + fixed bottom bar +
    slim top app-bar with brand·language·Settings gear) and `Nav.svelte` (one component rendering a
    desktop left rail *and* a mobile bottom tab bar with a raised centre Play FAB; only the visible one
    is in the a11y tree). `routes.ts` marks Play `primary` and exports `bottomTabs`. Wrapping top-nav
    removed.
  - **Components**: pill primary CTAs with chunky press (Play/Practice/Summary/Daily/NotFound); the lit
    streak flame recoloured to sunshine (the one sparing warm accent, icon-only so AA-safe); Orbi larger
    on Home. Most of the component look came free through the token layer.
  - **Per-route desktop layouts**: Home (full-width review banner → Daily·Mastery 2-col), History
    (full-width chart → most-missed·recent 2-col), Progress (stat row + recap → mastery·achievements
    auto-fit grid), Practice (2-pane: picker · sticky mode/format/Start), AtlasCountry (flag+facts ·
    did-you-know+locator 2-col); Play/Summary/Settings centred columns; Atlas/AtlasRegion already
    responsive. Focused screens capped ≤640–720px; content capped ~1160px.
  - **Copy/PWA**: Home greeting already Orbi's-voice/no-name; no new i18n key needed; manifest
    `background_color` → `#eafaf8` (teal `theme_color` kept).
  - **Verification**: `test` (492) / `check` / `lint` green; production build clean (no bundle jump);
    headless-Chrome captures of every route at ~390px and ~1280px with a seeded profile, plus a
    reduced-motion pass and live map-locate/answered-flag boards confirming the bottom bar never covers
    the answer surface; FR/DE bottom-bar labels fit at 390px. **Awaiting owner review / merge to main**
    (then archive this PRD).
- **2026-07-11 — Clarifying round resolved; implementation plan written (NOT yet built).** Owner accepted
  the recommended defaults for every open question (see the Resolved note): mobile bar
  Home·Atlas·**Play(FAB)**·History·Progress with Settings in the top app-bar; ~860px breakpoint / ~1160px
  content cap; **cool mint-white** ground; teal (`#10a5a0`) kept; coral + sunshine secondaries used
  sparingly; Home greeting in **Orbi's voice with no personal name** (no account/username exists — must not
  be surfaced); rollout tokens→shell→components→routes; **v2.0**. Added the staged **Implementation plan**
  above. **Still awaiting an explicit "go" to start building.**
- **2026-07-11 — Redesign explored; direction chosen; this PRD drafted.** Acting as UI designer, produced
  three full design directions (**A · Orbi Play**, **B · Cartographer**, **C · Explorer HUD**) across all
  ten screens as mobile phone mockups in one interactive comparison gallery (Artifact). Owner picked
  **A · Orbi Play**, asked to confirm it **translates to desktop** and to write this implementation PRD;
  **B & C retired.** The prototype was then extended so Orbi Play is shown on **mobile + desktop for every
  screen** (desktop = left sidebar rail + multi-column content), verified via headless-Chrome captures of
  all ten screens. **NOT built** — awaiting the clarifying round (Open Questions above) and an explicit
  build approval.
