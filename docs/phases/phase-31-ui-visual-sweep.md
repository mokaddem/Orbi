# Phase 31 — Full UI visual sweep (more icons, flags & maps throughout)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
· **Track:** v1.5 navigation & visual depth

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
A cross-cutting pass to make the app more **visual** — add icons, country **flags**, and small
**maps / region silhouettes** wherever they add clarity or delight, extending the Playful visual layer
(Phases 12 & 18) to every screen. This is **enrichment, not a redesign**: the existing house style,
palette, and components stay; text-heavy surfaces gain the imagery the app already has the pieces for.

## The trigger (owner request)
> "Full UI sweep to add more icons, flags, maps throughout the app."

## In scope
- An **audit** of every screen/list for spots where an icon / flag / mini-map would help, then adding
  them consistently, reusing the existing asset system.
- Extending the inline icon registry (Lucide → `icons.ts`) with any new glyphs the sweep needs.

## Current state (so scope is clear)
- **The asset system already exists — this sweep spends it more widely, it doesn't build new infra.**
  - **Icons:** an inline SVG registry (`src/ui/components/icons.ts`, generated from Lucide by
    `scripts/build-icons.mjs`; rendered by `Icon.svelte`). Add an icon by editing the generator's map
    and rerunning it — no runtime icon dependency (bundled, offline, crisp).
  - **Flags:** bundled per-country SVGs via `Flag.svelte`.
  - **Maps / shapes:** `RegionIcon.svelte` (continent silhouettes), `ModeIcon.svelte` (per-mode glyphs),
    the D3 `MapBoard`/`AtlasMap`, region-shape data (`region-shapes.json`), and Phase 22's micro-state
    map dots.
  - **Mascot:** `Mascot.svelte` (Phase 18) — a friendly globe character in several poses.
- **Where imagery is already present** (don't regress these): mode setup cards (ModeIcon), region picker
  (RegionIcon), option grids (flags), most-missed list (flags), achievements (silhouettes + glyphs),
  mastery meters (icons), Atlas.
- **Where it's thin / text-only today** (candidates — to be confirmed by the audit): recent-sessions
  list (mode + region shown as plain text), Summary screen, Settings, Home CTAs and empty states, the
  Daily card, recommendation/"Next up" cards, and any list that names a country/region/mode without a
  flag/silhouette/icon beside it.

## Depends on
Phase 18 (icon registry + mascot), Phase 12 (visual system), Phase 22 (map dots), Phase 20 (Atlas
imagery). Should **coordinate with Phase 30** (new History/Progress pages) and **Phase 29** (identity /
favicon) so all three land a coherent look. Best sequenced **after** 29/30 so the sweep covers the final
page structure and identity rather than being redone.

## Scope / Deliverables
- [x] **Audit checklist (first deliverable)** — every route walked; opportunities + withhold list
      produced and owner-approved (see 2026-07-10 progress-log entry). Home / Play-setup / Practice /
      Progress found already imagery-saturated; the gaps clustered on History, Summary, AtlasCountry,
      NotFound, WeeklyRecap, Atlas search, and the Play in-game surface.
- [x] **Icons** — placed beside text-only labels/actions: History recent-session rows (`ModeIcon`),
      Summary meta line (`ModeIcon`) + stat tiles (`trophy`/`target`/`clock`/`flame`) + action buttons
      (`repeat`/`train`/`play`), WeeklyRecap chips, Atlas search input (`search`), AtlasCountry fact
      labels (`landmark`/`languages`/`factory`/`globe`/`map`). **No new glyphs needed** — all reused the
      existing registry, so `build-icons.mjs` was untouched.
- [x] **Flags** — Play wrong-answer reveal shows the correct country's flag (map/capital modes); Play
      attribute-mode prompts (capitals / languages / industries) anchor the country name with its flag
      (never the flag↔country modes — that would leak the answer).
- [x] **Maps / silhouettes** — `RegionIcon` silhouette beside the region on History rows and the Summary
      meta line; **AtlasCountry gained a real locator map** (owner opted in) — the country picked out
      bright, its region tinted for context — via an extended `AtlasMap` (`highlightCountry`), geometry
      lazy-loaded on mount so the base bundle stays light.
- [x] **Consistency & a11y** — one house style (Icon sizing/stroke, accent colour tokens); icons stay
      decorative beside labels (the survival hearts are the one deliberate colour accent, and they are
      functional state, with a `{remaining} of {total} lives` label); theme-aware; offline; the heart
      transition is dropped under `prefers-reduced-motion`. Button accessible names unchanged.
- [x] **Tests / checks** — `npm run test` (467 pass, +11 new incl. `AtlasMap.test.ts` for the new
      country-focus logic), `npm run check` (0/0), `npm run lint` clean; headless-Chrome screenshots of
      all touched screens on :5180; production build confirms no new chunk / heavy dep and no bundle jump.
- [x] **Survival hearts (owner add-on)** — the text `♥`/`♡` lives became bigger, filled red heart SVGs
      (dimmed grey when lost). Requested mid-build ("add picture/real heart and make them bigger").

## Technical notes
- **Reuse before adding.** Prefer `Flag` / `RegionIcon` / `ModeIcon` / existing `Icon` names; only add a
  Lucide glyph when nothing fits, and keep the generator (`build-icons.mjs`) the single source.
- **Mini-maps: silhouettes first.** Static region silhouettes (already generated, few KB) are cheap;
  a live D3 map per list row is not — reserve interactive maps for where they already live. Decide the
  bar for "small map" (Open Question 3).
- **Guard against noise.** More imagery can clutter as easily as it can help; the audit's "leave
  text-only" notes matter as much as the additions. Density limits for flags in dense lists.
- **Bundle awareness.** Flags/shapes are already bundled; adding icons is a few hundred bytes each.
  Watch for accidentally pulling many large flag SVGs into a single view.

## Open Questions — to resolve with the owner
1. **Ambition** — a light, high-value touch (a few key screens) or a thorough every-screen sweep? Which
   surfaces are top priority?
2. **Withhold list** — any screens/lists to deliberately keep text-only (e.g. Settings)?
3. **Mini-maps** — silhouettes only, or a real locator map in some contexts (perf/complexity trade-off)?
4. **Flag density** — okay to add flags to every country-name list, or cap it (e.g. only ≤ N rows)?
5. **New icon sources** — stay Lucide-only (recommended), or allow another set for gaps?
6. **Sequencing** — confirm this runs after Phases 29 (identity) and 30 (page split) so it sweeps the
   final structure once.

## Acceptance criteria
- An owner-approved audit checklist exists, and the agreed additions are implemented consistently (house
  style, a11y, offline, theme-aware).
- Country-name lists show flags (within density limits); region references show a silhouette/map; text-
  only actions/headers gain fitting icons — with no regressions to imagery already present.
- Fast loop green (`npm run test` / `check` / `lint`); headless-Chrome screenshots of the touched
  screens on :5180; no unexpected bundle-size jump.

## Out of scope
- A visual redesign, new palette, or layout overhaul (Phases 12/18 own the visual system).
- New mascot poses or a rebrand (identity is Phase 29).
- New data/imagery sources that aren't bundled/offline (no CDN, no runtime fetches).

## Progress log
- **2026-07-10 — PRD drafted from the owner's request for a "full UI sweep to add more icons, flags,
  maps throughout the app." Framed as an audit-then-enrich pass over the existing bundled asset system
  (icon registry, `Flag`, `RegionIcon`, silhouettes, mascot), deliberately after the identity (29) and
  page-split (30) work so it sweeps the final structure once. NOT built — awaiting the clarifying round
  and explicit build approval.**
- **2026-07-10 — Clarifying round + audit, owner-approved, then built & verified. Open-question
  answers (owner):**
  - **Ambition → full sweep** (all confirmed additions, not a light touch).
  - **Play additions → both** the wrong-answer reveal flag *and* the attribute-mode prompt flag.
  - **Mini-maps → a real locator map allowed** (not silhouettes-only) — so AtlasCountry got a live,
    lazy-loaded locator instead of just a `RegionIcon`.
  - Defaulted (not asked): stay **Lucide-only** (turned out no new glyphs were needed at all), and
    sequencing already satisfied (29 & 30 Done).
  **Mid-build owner add-ons:** (a) survival lives → bigger, filled "real" heart SVGs; (b) noted the app's
  graphics are still minimal and to "go a step above" — honoured by taking the richer option at each
  point here, with the bigger leaps (animation, new poses, illustrative moments) deferred to a new
  **Phase 33 "Graphic richness & delight — mascot, motion & illustration"** to be drafted after this
  ships (owner: draft *after* Phase 31; mascot in 31 limited to the NotFound empty state).
  **Implemented:** History recent-session rows (ModeIcon + region silhouette); AtlasCountry fact glyphs +
  real locator map (extended `AtlasMap` with a `highlightCountry` focus-with-region-tint mode); Summary
  meta/stat-tile/action-button icons; NotFound mascot; WeeklyRecap chip icons; Atlas search glyph; Play
  reveal flag + attribute-prompt flag + filled heart lives. **Deliberately withheld** (audit): AtlasRegion
  sub-region headers (no silhouette asset — only the 5 continents), flag↔country prompts (would leak),
  Atlas A–Z headers, decorative section-header glyphs, LanguageSwitcher flags. **Verified:** fast loop
  green (test 467 / check 0-0 / lint clean), headless-Chrome screenshots of every touched screen on
  :5180, prod build shows no new chunk or bundle jump. **Known limitation:** on the AtlasCountry locator,
  micro-states (e.g. Tuvalu) are too small to show as a visible focus fill — the tinted region still
  locates them; a Phase-22-style marker dot could be a later refinement.
  **Not yet committed/archived** — awaiting the owner's review of the result; archive on merge.
