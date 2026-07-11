# Phase 35 — Play mode picker redesign + "Grand Tour" format

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done (merged & archived) · **Progress:** 100%
· **Track:** v2.0 follow-up (builds on Phase 34)

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the open questions with the owner (Sami), present the plan, and get
> an **explicit "go"** before writing any implementation. (See the callout at the top of the main PRD.)

## Goal
Rework the Play **"Choose a mode"** screen so the eight modes read as the four **families** they already
are — **Map**, **Flags**, **Capitals**, **Extra** — and add a new session **format** that isn't capped at
a fixed number of questions: **Grand Tour**, which asks about **every country in the selected
region / sub-region exactly once**.

## The trigger (owner request)
> "Let's work on the Play page, especially 'choose a mod'. Redo the design of the full page. Regroup modes
> related to map together, same for flags and capital. The others are extra. […] add a new format 'full'
> (i'll let you choose a better name), that will list all countries from the selected region/sub-region.
> Basically, we're not capped on the number of questions per fixed game." — owner

## Decisions (resolved with the owner, via side-by-side prototypes)
- **Layout: category-first (Variant B).** A 2×2 grid of family cards (emblem chip + name + one-line hint);
  picking a family reveals its two **direction** modes in an accent-tinted tray ("Pick a direction").
  Chosen over the "grouped sections / all modes visible" variant (Variant A). The picker keeps a single
  `mode` selection and adds a `category` selection.
- **Format name: "Grand Tour"** (owner's pick over Marathon / Full / Complete). A third format card next to
  **Fixed** and **Survival**. (A launch "New" badge was prototyped and then dropped at the owner's request.)
- **Register as a phase PRD** (repo convention) — this file; archive when Done + merged.
- Family emblem colours: Map = teal (accent), Flags = coral, Capitals = sun, **Extra = a new violet token**.

## In scope
- **Category-first mode picker** in `Play.svelte`: `MODE_GROUPS` (map / flags / capitals / extra), a
  `category` state, `selectCategory()` that lands on the family's first direction, and a re-keyed
  direction tray. New `ModeGroupIcon.svelte` (globe / flag / star / sparkle emblems).
- **New `SessionType: 'full'`** ("Grand Tour"): the pure engine finishes when every country in the answer
  pool has been asked once. The draw bag is already without-replacement, so each country is asked exactly
  once, uncapped, with no lives. New `QuizSession.answerCount` getter exposes the pool size.
- **Play format card** for Grand Tour (globe icon, `fullHint` = "All {count} countries" using the live pool
  size), and the game store pins the true length into the run config so the HUD/summary totals are right.
- **Design token**: `--color-violet` / `--color-violet-weak` in `src/app.css` (Extra family + the badge).
- **Trilingual copy (EN/FR/DE)**: `modes.group.*`, `modes.groupHint.*`, `play.setup.pickDirection`,
  `play.setup.fullHint`, `sessionType.full` ("Grand Tour" in all three).

## Out of scope (deliberately)
- No new **game mode** — this only regroups the existing eight and adds a session *format*.
- Achievements are unchanged: the flawless-run achievement still keys on `type === 'fixed'`; a
  "flawless Grand Tour" achievement is left as **future work**.
- Daily Challenge / recommendations / targeted-practice keep their existing formats (`fixed`/`training`).
- The **region picker** and the live game/answer flow are untouched.

## Deliverables checklist
- [x] `SessionType` extended with `'full'`; `session.ts` finish condition + `answerCount` getter.
- [x] Game store sizes a full run's display total from `session.answerCount`.
- [x] `ModeGroupIcon.svelte` + category-first picker + direction tray in `Play.svelte`.
- [x] Grand Tour format card with region-reactive count.
- [x] `--color-violet` tokens; responsive + reduced-motion CSS for the new grids/tray.
- [x] EN/FR/DE strings (parity test passes).
- [x] Tests: domain `full` sessions (exactly-once, region filter, map-geometry sizing); Play route
      family-swap + Grand Tour start sized to the pool.
- [x] Verified in the real app (headless Chrome) in EN/FR/DE.

## Technical notes
- `full` reuses the existing without-replacement draw bag; `shouldFinish()` returns
  `results.length >= answers.length`. `livesRemaining` is `Infinity` (same branch as `fixed`).
- The setup **format-card hint** uses the region `poolSize` (exact for non-map modes; for map modes the
  live session may be a few countries shorter after the geometry filter — the HUD then reflects the true
  `answerCount`). This is the same approximation the existing pool hint already shows.

## Acceptance criteria
- Opening Play shows four family cards; selecting one reveals exactly its two directions and hides the
  others; the previously chosen direction stays valid.
- Picking **Grand Tour** + a region and pressing Start runs a session that asks about every country in
  scope once (HUD total = pool size, not the fixed default), then ends and routes to the summary.
- History/Summary label the session type as "Grand Tour" (localized).
- `npm run check`, `npm run lint`, `npm run test` are green; EN/FR/DE render correctly.

## Progress log
- **2026-07-11** — Prototyped both layouts (grouped-sections vs category-first) as faithful token-accurate
  screenshots; owner chose **category-first** + name **Grand Tour** + "build & register a PRD". Implemented
  the domain `full` type, category-first picker, Grand Tour card, tokens, and trilingual copy. Full suite
  green (497 tests); verified in the real app in EN/FR/DE via headless Chrome. Marked Done — pending
  merge → then archive.
