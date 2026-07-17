# Phase 48 — Review preview (see what you'll drill before a review)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** 🟡 In progress · **Progress:** 95%
· **Track:** v3.0 — Review preview

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Give the "time to review" flow **intent and legibility**. Two changes to the review entry path:

1. **Self-describing entry** — the "time to review" surfaces should say **what mode _and_ region**
   you're about to drill (today they show region + a count, but the **mode is hidden**), so tapping a
   review is a deliberate choice, not a surprise.
2. **A "review preview" screen (a revise-then-test study card)** — before dropping you into the
   questions, show a **`#/review`** screen that lets you *revise the material first*: the mode, the
   region, the count, and — for each country in the review — **the thing you're about to be tested on**
   (its flag for flag modes, its capital for capital modes, its location on the map for map modes),
   with a single **"Start review"** action into the game. It turns the review from "click → suddenly
   answering" into "**revise, then test**" — a deliberate study beat (glance at the material, then get
   quizzed on it).

Crucially this is **presentation + one screen**, not new learning logic: the region-scoped review
(Phase 26) already computes *exactly* the data a preview needs.

## The trigger (owner request — 2026-07-17)
From a review-flow discussion: *"when you want to practise when clicking on a 'time to review', the
button should show what mode/region is about to be practised, and when we click it, before switching
to the game interface, we should have a new 'review' interface that shows us what we'll be questioned
about."* Direction agreed in the discussion:
- The **review entry** should surface **mode + region** (not just region + count as today).
- A **new intermediate "review preview" screen** sits **before** the game and shows **what the review
  covers** ("what we'll be questioned about").
- Applies to the existing **"time to review"** surfaces — this is a refinement of the Phase 26 /
  Phase 14 review path, **not** a new game mode, format, or data.

## Current state (so scope is clear)
- **Two review entry surfaces, both hide the mode.** The primary one is
  `src/ui/components/ReviewByRegion.svelte` (Phase 26): a "Time to review" header
  (`home.review.title`) over one tappable **row per region**, most-urgent first (first row
  pre-selected `.primary`), each showing a region silhouette + localized region name + a count
  (`home.review.regionCount` = "{count} to review"), plus a "Review everything ({count})" footer row.
  **It never shows the mode.** The fallback is `src/ui/components/NextUpCard.svelte` (Phase 14):
  eyebrow "Next up", title "Time to review", reason "{count} to review in {region} — weakest first",
  CTA "Review" — region + count in prose, **still no mode**. Home shows `ReviewByRegion` whenever
  anything is due, else `NextUpCard`; `NextUpCard` is also repeated on the **Summary** screen.
- **The data a preview needs already exists.** `reviewByRegion(srItems, regionOf, options)`
  (`src/domain/review.ts`) returns `RegionReview[]` = `{ region, mode, iso2s, due, total }[]`,
  most-urgent first — i.e. **"these specific countries (`iso2s`, weakest-first, capped at 20) are due
  for this region + this dominant mode, with `due`/`total` counts."** Loaded via
  `loadRegionReviews(now)` (`src/ui/stores/persistence.ts`). The global "review everything" is
  `loadTrainingPlan()` → `TrainingPlan { mode, iso2s }`. So a preview screen renders **existing data**
  and only needs ISO→`Country` resolution (`getCountry`/`getCountries`, as `Practice.svelte` and
  `game.ts` already do). **No new domain logic.**
- **Clicking a review jumps straight into the game.** Every review trigger stages a `RunConfig` into
  the `pendingConfig` store and `push('/play')`; `Play.svelte`'s `onMount` sees the pending config and
  **immediately `play.start(...)`**, so the mode-picker setup screen never renders. The review's
  `RunConfig` is `{ mode, type: 'training', answerPoolIso: iso2s, fixedLength: iso2s.length, choices }`
  — no `filter`, an explicit answer pool, `type:'training'` (feeds SR normally). Built identically at
  `ReviewByRegion.svelte` (`startReview`) and `game.ts` (`recommendationToConfig`).
- **Map framing already guards against answer-leak.** `focusIsosForConfig` (`game.ts`) frames a review
  to the **whole region(s)** the pooled countries belong to, **not** just the handful of due ones —
  deliberately, so a `map-locate` review doesn't give away where the target is. A preview that showed
  each due country's *location* would undo that guard (see Technical notes + OQ1).
- **Routing + handoff precedents to reuse.** Hash routing via `svelte-spa-router` (`src/ui/routes.ts`);
  adding a non-nav destination is a one-line entry (like `/summary`, `/practice`). The staged-handoff
  pattern is well-worn: `pendingConfig` (game), `pendingChallenge` (Grandmaster), `focusMastery` (a
  boolean handoff). `Practice.svelte` is the precedent for a **route** that builds a config and hands
  to `/play`; `GauntletOfferModal.svelte` is the precedent for a **modal** "confirm the stakes before
  launch" (question count / time estimate / lives → Accept/Decline).
- **Gaps:** the entry surfaces don't display the mode; there is **no** pre-game preview/confirmation for
  a review (or any normal/daily/practice launch — all launch directly); no `#/review` route or preview
  component; no shared "render a review's scope + covered countries" view.

## In scope
- **Mode on the entry.** `ReviewByRegion` rows (and the "review everything" footer) and the
  `NextUpCard` "due" variant show the **mode** alongside region + count — a mode label + a `ModeIcon`
  glyph (the mode glyphs already exist from the Play picker). Exact label/format in OQ4.
- **A "review preview" study-card screen** at **`#/review`** (route — OQ2 resolved) shown **between**
  the review click and the game. It renders: the **mode** (label + glyph), the **region** (name +
  silhouette), the **count** ("N to review", `due`-split per OQ6), and — the study card (OQ1 resolved:
  **revise-then-test**), titled **"Ready to review?"** — a **per-country list**, each row showing the
  country and **the material being tested**: its **flag** (flag modes), its **capital** (capital
  modes), or its **own small locator map** (map modes). Plus a primary **"Start review"** button (→ existing `pendingConfig` → `/play`) and a **back/cancel**
  affordance. Cold-start safe (handles a direct/refreshed `#/review` with no staged selection →
  friendly "nothing to review" state that offers Home).
- **Mode-aware study rendering (reusing existing assets).** Each review carries a **single** mode
  (`reviewByRegion` picks one dominant mode per region; `TrainingPlan` has one mode), so every row of
  the per-country list shows one revision style: a bundled **flag SVG** for flag modes, the **capital**
  string for capital modes, and a **small per-country locator map** for map modes — reusing the Atlas
  country **locator-map** component (Phase 31), not a bespoke renderer. The map reveal is the *intended*
  revision here, not a leak.
- **Route the existing review launches through the preview.** `ReviewByRegion` region rows, the
  "review everything" row, and Summary/Home `NextUpCard`'s "due" CTA stage the **selection** and
  `push('/review')` instead of `push('/play')`. The preview's "Start review" then does the current
  `pendingConfig.set(cfg); push('/play')` — so `Play.svelte` auto-start is **unchanged**. (Non-review
  launches — daily, practice, normal play — are untouched.)
- **Selection handoff store** — a small `pendingReview` writable (mirrors `pendingConfig` /
  `pendingChallenge`) carrying the chosen `RegionReview` (or the global `TrainingPlan` for "review
  everything"), so the preview can render scope without recomputing. Re-derivable via
  `loadRegionReviews()` on a cold `#/review` load if the store is empty (OQ5).
- **i18n EN/FR/DE** for all new copy (mode-on-entry labels, preview screen strings, the empty state);
  `messages.test.ts` parity stays green.
- **Tests** — component tests for: the entry now shows the mode; a review click lands on the preview
  (not straight into the game); "Start review" launches the **identical** run the direct path built
  today (same `RunConfig`); the cold/empty `#/review` state; and a headless real-app drive of
  click-review → preview → start → play → SR still updates.

## Out of scope (deliberately)
- **No new game mode, format, data, or SR/mastery/XP change.** `reviewByRegion` / `selectTrainingItems`
  / the SM-2 scheduler and the review `RunConfig` are unchanged; the preview is a pass-through.
- **No preview for non-review launches** — normal Play (still goes through its own setup picker), Daily
  Challenge, Practice, and the Grandmaster arena keep their current entry. (A general "pre-game
  preview" for all formats is a possible fast-follow, not this phase.)
- **No interactive flashcard trainer.** The study card is a **static revision surface** — glance at the
  material, then hit "Start review". It has **no** flip/self-grade/advance mechanic of its own; the
  actual testing + SR grading is the existing game. A true self-graded flashcard mode would be its own
  phase.
- **No change to what's selected for review** — which countries/mode a region review contains is Phase
  26's job; this phase only *shows* and *confirms* it.
- **No "skip the preview" preference** in v1 unless OQ7 says otherwise (keep the flow single and
  predictable first).

## Depends on
Phase 26 (region-scoped review — `reviewByRegion` supplies `{ region, mode, iso2s, due, total }`,
the whole basis of the preview), Phase 14 (recommendations / `NextUpCard` — the fallback review
entry), Phase 7 (spaced repetition — the due/trainable items being previewed), Phase 5 (region
filter — region resolution & names), Phase 2 (quiz engine — the run the preview launches), Phase 27
(Practice — the route-builds-config-then-hands-to-`/play` precedent), Phases 44/45 (Grandmaster —
the `GauntletOfferModal` "confirm before launch" precedent, if OQ2 picks a modal), Phase 8/17 (i18n).
Independent of Phase 46 (duels) and Phase 47 (physical geography), and of any unbuilt phase.

## Deliverables checklist
- [x] `ReviewByRegion` rows + "review everything" footer show the **mode** (label + `ModeIcon` glyph)
      alongside region + count.
- [x] `NextUpCard` "due" variant shows the **mode** alongside region + count.
- [x] `pendingReview` handoff store (chosen `RegionReview` | global `TrainingPlan`); review launches
      stage it and `push('/review')` instead of jumping to `/play`.
- [x] `#/review` route + `ReviewPreview` **study-card** screen ("Ready to review?"): a per-country
      list revising each covered country by the review's mode — **flag** / **capital** / **own small
      locator map** (reuse the Atlas locator-map component); "Start review" → `pendingConfig` →
      `/play`; back/cancel; cold-start/empty state.
- [x] The launched run is **byte-for-byte the same `RunConfig`** the direct path produces today
      (`{ mode, type:'training', answerPoolIso, fixedLength, choices }`) — no behaviour change once the
      game starts.
- [x] EN/FR/DE strings for the mode-on-entry labels, the preview screen, and the empty state;
      `messages.test.ts` parity green.
- [x] Tests: entry shows mode; review click → preview (not game); "Start review" builds the identical
      run; empty `#/review` state; headless full drive (click → preview → start → play → SR updates).
- [x] Verified in the real app (headless Chrome): the "time to review" entry names the mode; tapping it
      shows the preview with the right countries/mode/region/count; "Start review" plays the same run as
      before; SR/history behave exactly as today; back returns cleanly.

## Technical notes
- **No new domain work — this is a view over `reviewByRegion`.** The preview renders
  `RegionReview { region, mode, iso2s, due, total }` (region review) or `TrainingPlan { mode, iso2s }`
  ("review everything"), resolving `iso2s` → `Country[]` for display. Keep all selection logic in the
  domain layer untouched.
- **The launch must be identical to today.** The whole value is legibility, not a different session, so
  "Start review" must produce the exact `RunConfig` `startReview`/`recommendationToConfig` build now.
  A regression test asserting config equality is the cheapest guard.
- **The reveal is intentional (OQ1 → study card).** The map framing deliberately frames a
  `map-locate`/`map-highlight` review to the *whole region* so the game doesn't give the target away —
  but the study card's whole point is to *let you revise the answer first*, so on `#/review` we
  **deliberately** show each country's flag / capital / map location. Accepted tradeoff: revising right
  before the test softens that round's retrieval difficulty (see the SR note below).
- **SR ease after revision (OQ11 → feed unchanged).** Revising then immediately testing tends to
  produce easy/correct answers, which SM-2 rewards with a longer next interval — mild "ease inflation".
  Decision: **feed SR exactly as today** (revise-then-test is legitimate, the effect is small); revisit
  only if intervals visibly drift. No new grading branch.
- **Route confirmed (OQ2 → `#/review`).** A full route (`Practice.svelte` shape) reads as "a new
  interface before the game", works uniformly from Home *and* Summary, and has room for the study card;
  it's a **non-nav** destination (not in `navLinks` / `bottomTabs`), like `/summary` and `/practice`.
- **Map-mode study rendering (OQ10 → per-country locators).** For map modes each row gets its **own
  small locator map** pinpointing the country (reuse the Atlas locator-map component, Phase 31), rather
  than one shared region map. Cap at the review size (≤20) and lazy-render/virtualize if the many small
  maps prove heavy on mobile.
- **Handoff + cold start.** Follow the `pendingConfig` / `pendingChallenge` pattern: stage
  `pendingReview` on click, consume it in the preview's `onMount`. On a cold/refreshed `#/review` with
  an empty store, either re-derive via `loadRegionReviews()` (top region) or show a friendly "nothing
  staged to review — here's what's due" / Home escape (OQ5). Never dead-end.
- **Keep the entry compact.** Adding a mode glyph + label to each `ReviewByRegion` row must not bloat
  the row on mobile (the row is already icon + name + count); reuse the small `ModeIcon` and keep the
  label short (e.g. the mode's short name), consistent with the Play picker's mode chips.
- **One shared scope view.** The region-review preview and the "review everything" preview share the
  same component (mode + optional region + count + country list); "review everything" simply has no
  single region (it spans regions) — render it as the global plan.

## Open Questions — to resolve with the owner
> **Status (2026-07-17):** the clarifying round resolved every question — OQ1 / OQ2 / OQ8 / OQ10 / OQ11
> explicitly with the owner, and OQ3–OQ7 + OQ9 to their recommended defaults. The PRD is ready to
> implement **once the owner gives an explicit build go-ahead** (see the callout at the top).

1. ✅ **RESOLVED (2026-07-17) — Reveal depth → study card.** The preview is a **revise-then-test study
   card**: it shows the material to revise (each country's flag / capital / map location) before the
   test, not just a name list. Accepted that this pre-reveals the graded answer (see OQ11 for the SR
   consequence). *(Was: scope-only vs. study card.)*
2. ✅ **RESOLVED (2026-07-17) — Screen shape → dedicated `#/review` route.** A full route
   (`Practice.svelte` shape), not a modal — roomy for the study card, uniform from Home + Summary.
3. **Which entries route through the preview.** All review launches — `ReviewByRegion` region rows,
   the "review everything" row, **and** the `NextUpCard` "due" CTA on Home + Summary? (Rec: **all**, for
   one consistent review path.) Leave Daily / Practice / normal Play untouched (confirmed out of scope)?
4. **Mode-on-entry label.** Format for the entry rows — e.g. "Eastern Europe · **Flags** · 8 to review"
   (region + mode + count) with a mode glyph? Confirm the wording/order and whether the glyph alone
   suffices on the narrowest rows. (Rec: glyph + short mode name + region + count.)
5. **Cold-start `#/review`.** If someone opens/refreshes `#/review` with nothing staged, do we
   **re-derive** the top region review (so it still works) or show a **"nothing to review right now"**
   state that points Home? (Rec: re-derive the top region if anything is due, else the empty state.)
6. **Count detail.** Show a single "N to review", or split "**N due now** · M more soon" (the
   `due` vs `total` distinction `RegionReview` already carries)? (Rec: single "N to review"; keep the
   `due` split subtle or omit for v1.)
7. **Skip option.** Any "don't show the preview again / go straight in" preference, or is the preview
   always shown (one predictable flow)? (Rec: **always shown** in v1; add a skip pref later only if it
   nags.)
8. ✅ **RESOLVED (2026-07-17) — Naming → "Ready to review?"** (EN; FR/DE to follow). Track stays
   **v3.0 — Review preview**.
9. **Ordering within the country list.** Show the countries **weakest-first** (the drill order, which
   `iso2s` already is) or alphabetical (easier to scan)? (Rec: **weakest-first** — it mirrors the
   session and hints at what needs the most work; alphabetize only if it reads as random.)
10. ✅ **RESOLVED (2026-07-17) — Map-mode study rendering → per-country locators.** Each map-mode row
    gets its own small locator map (reuse the Atlas locator-map component, Phase 31), not one shared
    region map.
11. ✅ **RESOLVED (2026-07-17) — SR ease → feed unchanged.** Study-card reviews grade through SM-2
    exactly as today; no dampening or new grade path in v1 (revisit only if intervals drift).

## Acceptance criteria
- The "time to review" entry (both `ReviewByRegion` and the `NextUpCard` "due" card) **names the mode**
  as well as the region and count.
- Tapping a review opens the **`#/review` study-card screen** — **not** the game directly — showing the
  correct mode, region, count, and, for each covered country, the material to revise (flag / capital /
  map location, per its mode).
- **"Start review" launches the identical run** the direct path produced before (same `RunConfig`:
  `type:'training'`, same `answerPoolIso`, `fixedLength`, `choices`, `mode`); SR/history update exactly
  as today. **Back/cancel** returns cleanly with nothing started.
- A cold/refreshed `#/review` with no staged selection never dead-ends (re-derives or shows the empty
  state per OQ5).
- "Review everything" and the per-region reviews both route through the shared preview.
- EN/FR/DE parity holds (`messages.test.ts` green); the mode-on-entry, the preview render, the
  identical-`RunConfig` guard, and the empty state are covered by tests; fast loop green
  (`npm run test` / `check` / `lint`) + a headless click-review → preview → start → play drive.
- **No regression** to the review selection logic, the Play auto-start, or any non-review launch
  (Daily / Practice / normal Play unchanged).

## Progress log
- **2026-07-17 — PRD drafted** from the review-flow discussion ("the review button should show what
  mode/region, and a new review interface before the game should show what we'll be questioned about").
  An architecture scan confirmed the enabling data **already exists**: `reviewByRegion`
  (`src/domain/review.ts`) returns `{ region, mode, iso2s, due, total }` per region, so the feature is
  **presentation + one screen + a `pendingReview` handoff**, with **no** change to SR/mastery/XP,
  selection logic, or the launched `RunConfig`. Confirmed the current entry surfaces
  (`ReviewByRegion`, `NextUpCard`) **hide the mode** and that a review click **jumps straight into the
  game** (`pendingConfig` → `push('/play')` → `Play.svelte` auto-start), so the preview slots between
  the click and the play route, reusing the `Practice.svelte` route or `GauntletOfferModal` modal
  precedent. Flagged the **map-locate answer-leak** constraint that makes the reveal-depth question
  (OQ1) load-bearing. Open questions OQ1–OQ9 remain (reveal depth, route vs modal, which entries,
  mode label, cold-start, count detail, skip option, naming, list order). **NOT built — awaiting the
  clarifying round and explicit build approval** (see the callout at the top of the main PRD).
- **2026-07-17 — Clarifying round (part 1) with the owner.** Resolved the two product-shaping forks:
  **OQ1 → study card** (the preview is a *revise-then-test* card that shows each country's flag /
  capital / map location before the test, not just a name list) and **OQ2 → dedicated `#/review`
  route** (not a modal). This makes the reveal *intentional* and expands scope to **mode-aware revision
  rendering** (flag SVGs / capital strings / `WorldMap` highlight, single dominant mode per review).
  Two new questions opened by the study-card choice: **OQ10** (map-mode study rendering — one
  region-framed map vs. per-country locators) and **OQ11** (SR ease after revision — feed SM-2
  unchanged vs. dampen). OQ3–OQ9 carry their recommended defaults pending confirmation. **Still NOT
  built — awaiting the rest of the clarifying round and explicit build approval.**
- **2026-07-17 — Clarifying round (part 2) completed.** Resolved the remaining questions:
  **OQ10 → per-country locators** (each map-mode row shows its own small locator map, reusing the Atlas
  locator-map component from Phase 31, rather than one shared region map — which also unifies the study
  card into a single per-country list across all modes), **OQ11 → feed SR unchanged** (study-card
  reviews grade through SM-2 exactly as today; no dampening in v1), and **OQ8 → screen name "Ready to
  review?"**. OQ3–OQ7 and OQ9 confirmed at their recommended defaults (all review entries route through
  the preview; entry shows glyph + mode + region + count; cold-start re-derives the top region; single
  "N to review" count; no skip-preview pref; country list weakest-first). **All open questions are now
  resolved; the PRD is ready to implement — still awaiting an explicit build go-ahead from the owner
  before any code is written** (see the callout at the top of the main PRD).
- **2026-07-17 — Implemented (owner gave the explicit go-ahead).** Built on branch
  `worktree-phase-48-review-preview`:
  - **Store + config helper** (`src/ui/stores/game.ts`): a `pendingReview` handoff store +
    `ReviewSelection { mode, region, iso2s }` + `reviewSelectionToConfig()` — the launch config is
    byte-for-byte the training run the direct path built (guarded by a unit test).
  - **Self-describing entries**: `ReviewByRegion` rows + the "review everything" footer, and the
    `NextUpCard` "due" card, now show the mode (a `ModeIcon` glyph + the Map/Flags/Capitals family
    label) and route to `#/review` instead of jumping into the game.
  - **`#/review` "Ready to review?" study card** (`src/ui/routes/ReviewPreview.svelte`, registered in
    `routes.ts`): a per-country list revising each covered country by the review's mode — flag /
    capital / per-country locator map (reusing `AtlasMap`) — with scope chips (mode · region · count),
    "Start review" → identical run, back/cancel, cold-load re-derive (OQ5), and an empty state.
  - **i18n** `reviewPreview.*` in EN/FR/DE (`messages.test.ts` parity green).
  - **Tests**: updated `ReviewByRegion` / `NextUpCard` / `Home` route tests for the new routing; added
    a `ReviewPreview` component test (scope, list, identical-run launch, empty state) and a
    `reviewSelectionToConfig` guard. **Full loop green: check 0 errors/0 warnings · lint clean · 839
    tests pass.**
  - **Verified visually** via headless `google-chrome-stable --screenshot` (interactive CDP is blocked
    in this sandbox): the flags & capitals study cards read cleanly; the **map** per-country locators
    work but render as near-identical world thumbnails with a tiny dot for a region of neighbours (weak
    for adjacent countries) — flagged to the owner for a possible refinement (region-framed locators,
    or the OQ10 single-region-map alternative).
- **2026-07-17 — Map locator refined to region-framed (owner picked option B).** Shown the three cards
  as real screenshots, the owner chose **region-framed per-country locators** over the world-scale
  version. Added `projectRegion()` (`atlas-map.ts`) — the Natural Earth projection **fit to a region's
  member countries** — plus a small `RegionLocator.svelte` pure renderer; the study card computes one
  region projection per region (shared across its cards) and draws each tile zoomed to the region with
  the focus country in coral, so neighbours (France/Germany/Spain/Italy…) are each distinct.
  `projectRegion` unit-tested (members-only, empty-safe, fits/zooms). **Full loop green: check 0/0 ·
  lint clean · 842 tests.** Headless screenshot confirms the region-framed render. **Remaining ~5%:
  merge to the main integration branch, then reconcile the main-PRD Status Table (add the Phase 48 /
  v3.0 row — kept out of this worktree to avoid colliding with the owner's uncommitted v2.8/v2.9 edits)
  and archive this PRD.**
