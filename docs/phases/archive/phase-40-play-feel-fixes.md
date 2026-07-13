# Phase 40 — Play-feel fixes: mobile tap-snap · survival clear-win · highlight ring · mainland anchor

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
· **Track:** v2.4 — Post-play fixes (mobile map, survival, map anchoring)

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Fix four issues the owner hit while playing (mostly on mobile). All are presentation / interaction
polish plus one small, pure end-condition — **no new data, no new quiz modes**:

1. **Mobile micro-state tap** — on the 2-D map (`map-locate`), tapping a tiny country's aim-dot
   selects its big neighbour instead (Vatican → Italy), because a fingertip is far larger than the
   dot and there's no hover to confirm the target. Make micro-state dots **magnetic**.
2. **Survival never ends when a region is mastered** — with no wrong answers, lives never drop and
   the draw bag reshuffles forever. Give survival a **"region cleared" win**.
3. **Highlight ring clutters large countries** — the `map-highlight` pointer ring is great on a
   micro-state but noise on a big country. **Draw it only for micro-states** (matching the reveal
   ring's existing convention).
4. **`map-highlight` anchors France to its centre of mass, not the mainland** — the flat map still
   uses the full-geometry centroid, so France's marker/auto-zoom drift toward the Bay of Biscay
   (French Guiana + overseas territories drag it). **Port the globe's mainland (largest-polygon)
   anchor** (Phase 38) to the flat map.

## The trigger (owner request — 2026-07-13)
> "Few stuff I noticed while playing on mobile: (1) selecting a small country on the 2-D map
> (Vatican) selected Italy instead even though I clicked the dot — maybe add a proximity/snap on
> mobile since hover isn't shown. (2) In survival, if you master a region it never ends — add a way
> to mark it completed after a while. (3) The circle around a highlighted country is great for a
> small country but not for a big one — remove it for large countries. (4) We already discussed the
> centroid for the map; when showing France it showed the centre of mass instead of the mainland —
> fix it for the 'find highlighted country' mode." — owner

## Decisions (locked with the owner — 2026-07-13)
- **Survival end model → clear-the-region win.** Survival ends in a **win** once every country in the
  selected answer pool has been answered **correctly at least once** ("region mastered"). It still
  ends early (loss) if lives reach 0. Small regions finish quickly; the whole world is a genuine
  achievement. (Chosen over a fixed question cap and over an optional "keep going?" prompt.)
- **Tracking → this phase PRD (v2.4).** The round is formalised as one phase covering all four items,
  per the project's phase-by-phase process.
- Items **1, 3, 4** are the flat-map component (`WorldMap.svelte`) — the globe (`GlobeMap`) already
  removed its glow ring and anchors to the mainland (Phase 38), so this brings the flat map to parity.

## Current state (so scope is clear)
- **`map-locate` picking** (`src/ui/components/WorldMap.svelte`): each country is a `<path onclick={()
  => pick(c.iso2)}>`. Micro-states (`area < SMALL_AREA = 14`) also get a visible **aim-dot** in the
  `hit-dots` group, painted *above* the paths, each with its own `onclick`. A tap that lands on open
  water hits the full-board `.ocean-hit` `<rect>`, whose d3 click handler calls
  `nearestCountryWithinCap(x, y, rendered, SNAP_CAP = 44)` (`map-hit.ts`, already unit-tested) to snap
  to the nearest country centroid within a logical-unit cap. **There is no proximity from a direct
  country-path hit** — so a fingertip on Italy's path fires Italy's `onclick` before the intended
  Vatican dot is ever considered. `pointer(event, zoomLayer)` (d3-selection) inverse-transforms a tap
  through the current zoom to the 980×500 logical surface; the caps are in those logical units.
- **Survival end** (`src/domain/session.ts`, `shouldFinish`): `if (type === 'survival') return
  livesRemaining <= 0`. `drawAnswer()` reshuffles `this.answers` when the bag empties, so a flawless
  survival run loops forever. `this.answers` is the deduped, mode-eligible answer pool; `answerCount`
  already exposes its size. There is a **Quit** button (`Play.svelte` ~L535) but no *win*.
- **Highlight ring** (`WorldMap.svelte` ~L185 `marker`, drawn ~L483): computed for **every**
  `highlightIso` and rendered unconditionally. By contrast the **reveal ring** (~L203 `revealMarker`)
  already carries a `micro = item.area < SMALL_AREA` flag and only draws its ring when `micro` — the
  exact convention this phase applies to the highlight ring.
- **Centroid / framing** (`WorldMap.svelte` `rendered` `$derived.by`, ~L142): per country it stores
  `cx, cy = path.centroid(f)` (full geometry), `bounds = path.bounds(f)`, `area = path.area(f)`.
  These feed the highlight `marker`, the reveal/picked markers, the ocean-snap targets, and the
  `map-highlight` auto-zoom (`boundsTransform(item.bounds)`). **Verified numerically:** for France the
  full centroid projects to **(480, 118)** — out in the Bay of Biscay — while the largest-polygon
  (mainland) centroid is **(496, 103)**, correctly inland; full bounds are **306×222px** (spanning
  overseas territory) vs mainland **30×26px**, so the auto-zoom barely zooms in.
- **The globe already solved item 4** (`src/ui/components/globe-geo.ts`): `largestPolygonCentroid(geom)`
  returns the centroid of a country's **largest-area polygon** (via `polygonsOf` + `geoArea`), falling
  back to `geoCentroid` for single-polygon / degenerate cases. Unit-tested in `globe-geo.test.ts`.
- **Reduce-motion is global** (`app.css` `:root[data-reduce-motion] *` + the `@media
  (prefers-reduced-motion: reduce)` block in `WorldMap.svelte`) — no per-element gating needed.
- **Trilingual copy** lives in `src/i18n/` (EN/FR/DE); a parity test enforces all three stay in sync.

## In scope
### 1. Micro-state tap magnet (`WorldMap.svelte`, `map-locate`)
- Route **every** interactive tap through one resolver, `resolvePick(event, fallbackIso | null)`:
  1. `[x, y] = pointer(event, zoomLayer)`.
  2. **Nearest micro-state aim-dot** within `DOT_SNAP_CAP` (reuse `nearestCountryWithinCap` over the
     `hitDots` centroids) → pick it. Micro wins even when the finger is over a big neighbour.
  3. Else the directly-hit `fallbackIso` (a country path) → pick it.
  4. Else nearest country within `SNAP_CAP` (the existing ocean snap) → pick it, or no-op past the cap.
- Wire country `<path onclick>` → `resolvePick(e, c.iso2)`; the `.ocean-hit` handler → `resolvePick(e,
  null)`; the dot's own `onclick` routes through too (a precise dot tap is unchanged).
- `DOT_SNAP_CAP` defaults to a **moderate** logical radius (start ~30 units) — tunable after a real
  phone test (OQ1). Pinch-zoom (Phase 37) remains the precise fallback for a dense cluster.
- **Grading stays exact:** the resolver always yields a single ISO the caller grades; a
  neighbour/ocean tap never falsely validates the target.

### 2. Survival "region cleared" win (`src/domain/session.ts`)
- Track a `Set<string>` of **distinct iso2 answered correctly** (add `question.answer.iso2` on a
  correct `submit`). A country missed then later gotten right still counts (≥1 correct).
- `shouldFinish` (survival): finish when `livesRemaining <= 0` **or** the cleared set covers the whole
  answer pool (`cleared.size >= this.answers.length`).
- Surface the win: add `cleared?: boolean` to `SessionSummary` (true when survival ended by clearing,
  i.e. finished with lives left). The Summary screen shows a small **"Region cleared!"** line;
  existing sound logic already gives a flawless clear the `perfect` jingle and any other finish the
  `finish` jingle — no change needed there.
- **Survival HUD progress** (`Play.svelte`): show a small **"mastered X / N"** indicator (X = distinct
  correct from `s.results`, N = the session's `answerCount`) so the goal is visible and the finish
  never feels random. New EN/FR/DE strings for the HUD label and the Summary "cleared" line.

### 3. Highlight ring only for micro-states (`WorldMap.svelte`)
- Add `micro = item.area < SMALL_AREA` to the `marker` derivation and render `<circle class="marker">`
  **only when `marker.micro`**. A large highlighted country keeps its highlight fill + auto-zoom
  framing; the ring earns its place only where the fill is too small to see (matching `revealMarker`).

### 4. Flat-map mainland anchor (`WorldMap.svelte` + shared helper)
- Extract `largestPolygon(geom): Feature<Polygon> | null` (the largest-area polygon) into
  `globe-geo.ts`, and refactor `largestPolygonCentroid` to use it (behaviour-preserving).
- In `WorldMap`'s `rendered`, anchor `cx, cy = path.centroid(largest)` and `bounds =
  path.bounds(largest)` to the country's **largest polygon** (fallback to full geometry when there's
  no usable polygon). Keep `area = path.area(f)` on the **full** geometry so the set of countries that
  get an aim-dot / the "micro" gate is unchanged.
- This corrects the highlight marker position, the `map-highlight` auto-zoom framing, the
  reveal/picked marker anchors, and the ocean-snap centroids — all onto the mainland, matching the
  globe.

## Out of scope (deliberately)
- No new datasets, country-scope changes, or new quiz modes.
- No change to flag modes, capitals/languages/industries modes, SR scheduling, history, or scoring
  (beyond the survival end condition, which is a pure `shouldFinish` addition).
- No change to the globe beyond the behaviour-preserving `largestPolygon` extraction it already
  effectively contains.
- No new sound cues; reuse the existing `perfect` / `finish` end-of-session jingles.
- No interactive-map keyboard selection (still out of scope, as in Phases 22/37).

## Depends on
Phase 4 (map modes), Phase 22 (micro-state aim-dots), Phase 37 (nearest-country snap, `map-hit.ts`,
d3-zoom, `pointer`), Phase 38 (globe mainland anchor `largestPolygonCentroid` / `polygonsOf`),
Phase 2 (session state machine). Items are independent of one another and can land incrementally.

## Deliverables checklist
- [x] **Tap magnet:** `resolvePick(event, fallbackIso | null)` in `WorldMap.svelte` prioritising the
      nearest micro-state dot within `DOT_SNAP_CAP` (30 logical units); country paths, dots, and the
      ocean rect all route through it; grading unchanged. `DOT_SNAP_CAP` default 30 — still tunable on
      a real phone (OQ1).
- [x] **Survival clear-win:** distinct-correct tracking (`cleared` Set) + clear condition in
      `session.ts`; `cleared` on `SessionSummary`; survival HUD "Mastered X / N" (via `answerCount` on
      the play view); Summary "Region cleared!" badge; EN/FR/DE strings added (parity test green).
- [x] **Highlight ring:** `marker.micro` gate — ring drawn only for micro-states.
- [x] **Mainland anchor:** `largestPolygon` extracted in `globe-geo.ts` (+ `largestPolygonCentroid`
      refactored onto it); `WorldMap` `rendered` anchors `cx/cy`/`bounds` to the largest polygon;
      `area` stays full-geometry.
- [x] **Tests:** `session.test.ts` (survival clears when the whole pool is answered correctly; not
      before; wrong-then-right still clears on the last life; lives-0 still wins the race; fixed/full
      leave the clear-win off). `globe-geo.test.ts` (`largestPolygon` picks the biggest polygon;
      refactor keeps `largestPolygonCentroid` output). `WorldMap.test.ts` (large highlight → no ring;
      micro highlight → ring; the existing routing tests now exercise `resolvePick`). `map-hit` reuse
      needs no new unit (covered). Full suite **579 green**.
- [x] **Verified in the real app** (headless Chrome via CDP, real `WorldMap` + real geometry): a tap
      landing **on Italy's path** near the Vatican aim-dot (offset 11.6px > dot 6.6px, within the
      21.9px cap) selects **Vatican**, while a deep-Germany tap selects **Germany** (no over-grab); a
      3-country survival ends with **"Region cleared!"** (`cleared: true`, 3/3) and the HUD shows
      **"Mastered 1 / 3"**; a large highlighted country (**France**) shows **no ring** while a
      micro-state (**Andorra**) does; **France's** anchor is the mainland (mainland centroid `496,138`
      inland vs full `480,154`; bounds `31×27` vs full `315×228`). **Zero console errors / exceptions.**
- [x] `npm run check` / `npm run lint` clean; merged to `main` and this PRD archived.

## Technical notes
- **One resolver, three entry points.** `resolvePick` centralises the priority order (micro-dot →
  direct hit → ocean snap). Because it re-uses `pointer(event, zoomLayer)` and logical-unit caps, it
  behaves identically at every zoom level and viewport size. The dot magnet is the *only* new caps;
  the ocean `SNAP_CAP` is unchanged.
- **Why a fixed logical cap is fine.** `pointer` inverse-transforms through the zoom, so `DOT_SNAP_CAP`
  is a fixed logical distance at any zoom. On a phone at world zoom it covers few screen px (tight, so
  it won't over-grab a distant micro-state); zoomed in it covers more screen px (looser, matching the
  larger on-screen dot spacing) — the desired behaviour. Pinch-zoom stays the escape hatch for dense
  clusters (Vatican + San Marino near Italy).
- **Survival clear = mastery, not perfection.** Tracking *distinct correct* (a `Set`) means a country
  missed once (costing a life) but later gotten right still counts toward the clear — you can clear a
  region on your last life. `cleared.size >= answers.length` naturally caps and can't overshoot
  (questions only ever draw from `answers`). `cleared` on the summary is simply "survival finished
  with lives remaining".
- **Mainland anchor scope.** Switching `cx/cy`/`bounds` to the largest polygon is the same fix the
  globe already ships; keeping `area` on the full geometry preserves the "which countries are micro"
  decision, so item 4 doesn't accidentally change which countries get an aim-dot (item 1's magnet
  pool). Most countries are single-polygon, so only far-flung territories (France, Norway/Svalbard,
  USA, Portugal, Spain, Netherlands…) move — always toward the recognisable mainland.
- **No new deps, offline-safe by construction** — all four are local geometry / state changes.

## Open Questions — to resolve with the owner
- **OQ1 — `DOT_SNAP_CAP` aggressiveness.** Start ~30 logical units and **tune on a real phone** after
  the first build (bigger = easier micro-state taps but risks grabbing a micro-state when you meant
  its neighbour). Default proposed; confirm or adjust by feel. *(Resolved default: ~30, tune by feel.)*
- **OQ2 — highlight-ring threshold.** Use the same `SMALL_AREA = 14` (micro-only) as the reveal ring
  for consistency, or a slightly larger threshold so "small-ish" countries keep a ring? *(Proposed:
  reuse `SMALL_AREA`; tunable.)*
- **OQ3 — survival HUD detail.** Show "mastered X / N" text, or a slim progress bar toward the clear,
  or nothing (just the win at the end)? *(Proposed: compact "mastered X / N" text next to lives.)*

## Acceptance criteria
- On a phone-sized viewport, a tap that lands *near* a micro-state's aim-dot (even over the big
  neighbour) selects the **micro-state**; a clearly-central tap on the big country still selects it;
  grading is exact and an ocean tap past the cap is still a no-op.
- A survival run over a small region **ends in a win** ("Region cleared!") once every country has been
  answered correctly at least once; it still **ends in a loss** if lives reach 0 first; a flawless
  clear plays `perfect`, an imperfect clear plays `finish`.
- In `map-highlight`, a **large** country shows **no ring** (fill + auto-zoom only) while a
  **micro-state** still shows one.
- **France** (and other far-flung countries) in `map-highlight` anchors its marker + auto-zoom to the
  **mainland**, not the centre of mass; locate reveal/pick labels point at the mainland too.
- Fast loop green (`npm run test` / `check` / `lint`); EN/FR/DE parity holds; verified in the real app
  per the deliverables; zero console errors.

## Progress log
- **2026-07-13 — Follow-up: micro-state *highlight* now uses the filled aim-dot, not a ring.**
  Owner reported that a speck like Vatican is invisible when highlighted in **map-highlight** ("which
  country is highlighted?") and asked for the same dot the locate mode already draws. This supersedes
  this phase's "hollow ring for highlighted micro-states" choice (the ring left the country an
  unseeable dot inside an empty circle). `WorldMap.svelte`: the `marker` derived now yields just
  `{cx, cy, micro}` and the block draws `<circle class="dot highlight-dot" r={DOT_R/zoomK}>` (same
  fill/edge + constant screen size as locate); `.marker` CSS removed. `GlobeMap.svelte`:
  `updateMicroDots` relaxed so a highlighted micro-state shows its single dot at full opacity (was
  gated to `!highlightIso`). `check`/`lint` clean. Verified headless (flat map): a forced
  map-highlight on `VA` renders exactly one `.highlight-dot` at Vatican with zero console errors.
- **2026-07-13 — Built & verified (all four items).** Owner gave explicit go with the proposed OQ
  defaults. Implemented:
  - **Tap magnet** — `resolvePick(event, fallbackIso)` in `WorldMap.svelte` (micro-dot within
    `DOT_SNAP_CAP=30` → direct hit → ocean `SNAP_CAP` snap); country paths, aim-dots, and the
    `.ocean-hit` rect all route through it. Grading unchanged.
  - **Survival clear-win** — `cleared` Set of distinct-correct iso2 + clear condition in `session.ts`
    (`livesRemaining <= 0 || cleared.size >= answers.length`); `cleared` flag on `SessionSummary`;
    `answerCount` surfaced on the play view; HUD "Mastered X / N"; Summary "Region cleared!" badge;
    EN/FR/DE strings (`play.progress.mastered`, `summary.regionCleared`).
  - **Highlight ring** — `marker.micro` gate; ring rendered only when `marker.micro`.
  - **Mainland anchor** — `largestPolygon()` extracted into `globe-geo.ts` (`largestPolygonCentroid`
    refactored onto it); `WorldMap` `rendered` anchors `cx/cy`/`bounds` to the largest polygon while
    `area` stays full-geometry.
  **Resolved OQs:** OQ1 `DOT_SNAP_CAP=30` (still tune by feel on a phone); OQ2 reused `SMALL_AREA=14`
  for the ring gate; OQ3 compact "Mastered X / N" text next to lives.
  **Verification:** `npm run check` 0 errors, `npm run lint` clean, Vitest **579 green** (updated the
  obsolete "survival loops forever on correct answers" test to the clear-win). Headless-Chrome/CDP
  drive against the real component + geometry confirmed all four in-browser with **zero console
  errors** (near-miss-over-Italy → Vatican; Germany control → Germany; survival "Region cleared!" 3/3
  + HUD "Mastered 1 / 3"; France large highlight → no ring, Andorra → ring; France anchored on the
  mainland). **Merged to `main` + archived.**
- **2026-07-13 — PRD drafted** from the owner's post-play feedback (four items). Clarifying round
  already run with the owner: **survival = clear-the-region win** and **track as this v2.4 phase PRD**.
  Grounded in the current code: `WorldMap.svelte` picking (`pick`, `hitDots`, `.ocean-hit` +
  `nearestCountryWithinCap`), the `marker` vs `revealMarker` ring convention, and the `rendered`
  centroid/bounds; `session.ts` `shouldFinish` survival branch; the globe's `largestPolygonCentroid`
  (`globe-geo.ts`). Numerically confirmed France's flat-map centroid drift (full 480,118 vs mainland
  496,103). Remaining OQ1–OQ3 are tuning defaults. **NOT built — awaiting explicit build approval.**
