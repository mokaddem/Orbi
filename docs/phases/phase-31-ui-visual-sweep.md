# Phase 31 — Full UI visual sweep (more icons, flags & maps throughout)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
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
- [ ] **Audit checklist (first deliverable)** — walk every route (Home, Play setup + in-game, Summary,
      History/Progress, Atlas, Settings, NotFound) and list each spot where an icon / flag / mini-map
      would add clarity, plus a note where imagery should be *withheld* to avoid noise. Owner signs off
      on the list before changes land.
- [ ] **Icons** — add missing glyphs to the registry (via `build-icons.mjs`) and place them beside
      currently text-only labels/actions (settings rows, buttons, section headers, empty states).
- [ ] **Flags** — show the country flag beside country names in lists that lack it (e.g. recent
      sessions, recommendation cards, summaries), respecting density limits.
- [ ] **Maps / silhouettes** — put a region silhouette (`RegionIcon`) or a small map wherever a region
      is named without one; consider a mini locator for country contexts (reusing existing shapes).
- [ ] **Consistency & a11y** — one house style (stroke weight, sizing, colour tokens); icons stay
      **decorative beside text** (never replacing a label); theme-aware; offline (no CDN); respects
      `prefers-reduced-motion`.
- [ ] **Tests / checks** — component tests for new imagery where it carries state; headless-Chrome
      screenshots of the touched screens; confirm no bundle bloat regressions from added assets.

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
