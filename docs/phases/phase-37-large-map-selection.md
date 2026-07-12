# Phase 37 — Easy, confident country selection on large maps

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
· **Track:** v2.1 — Feel & fairness

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> — above all the **ranking decision** — with the owner (Sami), present the plan, and get an
> **explicit "go"** before writing any implementation. Record answers in the Progress log. (See the
> callout at the top of the main PRD.)

## Goal
Make selecting the correct country in **`map-locate`** easy, confident, and *fun* when the board shows
a **large continent or the whole world**. Today, at that framing, most countries are only a few pixels
wide: they're hard to see, harder to tap accurately (especially on a phone), and the player is never
sure they hit the intended one. This phase **investigates multiple alternatives, ranks them for a
playful app**, and — once the owner picks — implements the winning mechanism.

## The trigger (owner request)
> "When playing on large continent or worse the world, it's extremely difficult to select the correct
> country. Investigate multiple alternatives to solve this issue, and rank them based on [how] well
> they would fare for that playful app." — owner

## Current state (so scope is clear)
- **`WorldMap.svelte`** projects every country **once** onto a fixed **980×500** logical surface via
  `fitExtent`, then scales responsively through the SVG `viewBox`. **There is no pan or zoom.** On a
  phone that 980-px-wide board is squeezed into ~360 px, so a mid-size country is a small tap target
  and a small one is a speck.
- **`map-framing.ts`** fits the projection to the active region filter (over member centroids), so
  region play is already tighter than world play — but "World" and big continents (Africa, Asia) still
  render dozens of small countries at once. `focusIsosForConfig` (`game.ts`) deliberately frames to the
  **whole region**, never just the asked country, so the framing never gives the answer away.
- **Phase 22 already did the micro-state pass**: `map-locate` draws **visible filled hit-dots** for
  countries under `SMALL_AREA` (14 px²), painted above the paths (so a click resolves to the tiny
  target, never its big neighbour), with a hover swell to 1.6×; the reveal leads with a green ring +
  name label on the target. **Phase 22 explicitly deferred interactive pan/zoom to "its own future
  phase"** and left its OQ1–4 (primary mechanism, highlight auto-zoom, confirm-to-answer, touch-target
  floor/a11y) open. **This is that phase**, widened from "micro-states" to "any country on a large
  board."
- Grading is confirmed correct (Phase 22): `onpick` reports the exact ISO of the clicked element and
  `play.answer` grades that — a neighbour click never falsely validates the target. So this is a
  **visibility + aim + confidence** problem, not a correctness bug.
- Selection difficulty is specific to **`map-locate`** (the map *is* the answer surface).
  `map-highlight` answers via the `ChoiceGrid`, so its only large-board issue is *seeing* the ringed
  prompt country — a smaller, separate concern (see OQ4).

## Alternatives investigated & ranked (the core of this phase)
Ranked for a **playful, offline, touch-and-desktop** study game. Criteria: **friction/speed** (a game
should feel snappy, not fiddly), **touch fit**, **forgiveness** (fun, not punishing mis-taps),
**preserves learning** (must not hand over the answer — the point is to *know where the country is*),
and **cost** (implementation complexity + deps, staying "lean and self-contained").

| Rank | Alternative | Friction | Touch fit | Forgiving | Preserves learning | Cost | Playful fit |
|---|---|---|---|---|---|---|---|
| **1** | **Nearest-country snap + confirm pin** — tap anywhere; the tap resolves to the *nearest country by centroid* (extend the existing dot idea to a full Voronoi-style hit layer), drop a **pin**, then a **Confirm** commits | High (one tap + confirm) | ★★★ | ★★★ | ✅ still must aim at the right area | Low–med (centroids already computed) | **Best** |
| **2** | **Pinch / scroll pan + zoom** (d3-zoom transform on `<g class="countries">`) with a "fit region / reset" control | Med (zoom every question) | ★★ | ★★ | ✅ | Med (gestures, +`d3-zoom`) | Strong, but utilitarian |
| **3** | **Magnifier / loupe** — press-and-hold shows a zoomed bubble around the finger for precise placement (iOS-cursor style) | Med | ★★★ | ★★ | ✅ | Med–high | Delightful on touch; weaker on desktop |
| **4** | **Confirm-to-answer only** (tap places pin → Confirm), no snap/zoom | Low | ★ (small targets remain) | ★★ | ✅ | Low | Cheap confidence win; doesn't fix aim alone |
| **5** | **Tap-to-zoom drill-down** — first tap zooms into that area, second tap picks | Med (2 taps always) | ★★ | ★★ | ✅ | Low–med | OK; a step per question drags |
| **6** | **Disambiguation list on an ambiguous tap** — a tap near several small countries pops a short chooser | Med | ★★ | ★★ | ⚠️ mild leak (names its neighbours) | Med | Interrupts flow |
| **7** | **Per-question auto-zoom framing** — frame tighter around the target each question | Low | ★★ | ★★★ | ❌ **gives the answer away** in locate | Low | Reject for locate |
| **8** | **Force region-only framing** (never allow World/large in locate) | Low | ★★ | ★★ | ✅ | Trivial | Rejects the mode the owner *wants* to play |

**Recommendation:** build **#1 (nearest-country snap + a confirm pin)** as the core mechanism, and
optionally layer **#2 (pinch/scroll zoom + fit-region reset)** on top for players who want to inspect
dense areas. Rationale: #1 removes the pixel-perfect-aim problem entirely while staying forgiving,
fast, and tactile — the most "game-like" fix — and it *keeps the learning intact* because you still
have to aim at the correct part of the map. The **confirm pin** directly answers the Phase 22
confidence gap ("did my tap register on the right country?"). Zoom (#2) is powerful and familiar but
adds friction to every question and reads as a map tool rather than a game move, so it's better as an
opt-in layer than the primary fix. #7/#8 are rejected because they leak the answer or delete the
challenge.

> A **radius cap** on the nearest-country snap is worth considering (OQ5): snapping from *anywhere* on
> the ocean to the nearest country could make World play trivially easy. Capping the snap distance (or
> only snapping within a country's neighbourhood) keeps it forgiving without becoming a giveaway.

## In scope
- **`map-locate` selection** on large scopes (World and large continents) on **touch and desktop**.
- Whatever mechanism the owner picks from the ranking (recommended: nearest-snap + confirm pin, with
  optional zoom) — plus the interaction changes it implies in `WorldMap.svelte` and the
  `onMapPick` → answer flow in `Play.svelte`.
- A **reset / fit-region** affordance if zoom lands, so a lost player recovers the default framing
  (`map-framing.ts` already computes it).
- Keeping the Phase 22 micro-state dots and target-first reveal working (or folding them into the new
  mechanism).

## Out of scope (deliberately)
- **`map-highlight`** beyond a possible small legibility tweak (OQ4) — its answer is a `ChoiceGrid`,
  not a map click.
- Non-map modes (flags / capitals / attributes).
- A 3D / interactive globe, or new projections (Phase 28 already added the projection picker).
- A full accessibility overhaul (still Deferred in the main PRD) — this phase must not *regress* a11y
  and should set a reasonable touch-target floor (~44 px effective), but keyboard-driven map selection
  is not a deliverable here.

## Depends on
Phase 4 (map modes), Phase 12 (`map-framing.ts`, marker/hit-dot machinery), Phase 22 (micro-state dots
+ target-first reveal — this phase continues its deferred zoom/selection work), and Phase 28 (map
projection — the chosen mechanism must work across all four projections). Independent of Phase 36.

## Deliverables checklist (shaped for the recommended combo — **finalise after OQ1**)
- [ ] Chosen mechanism implemented in `WorldMap.svelte` (recommended: nearest-country hit resolution +
      a pin + a Confirm control), keeping the single projection pass.
- [ ] `Play.svelte` `map-locate` flow updated from instant single-tap to **place-pin → confirm** (or
      the picked mechanism's flow), without regressing grading correctness.
- [ ] If zoom lands: `d3-zoom` transform on `<g class="countries">` (+ dots/markers), a fit-region /
      reset control, and pan/zoom that don't fire stray picks.
- [ ] Touch-target floor (~44 px effective) verified in dense areas on a small phone width.
- [ ] Reduced-motion honoured for any zoom/pin animation (extend the existing block).
- [ ] Micro-state dots + target-first reveal still correct under the new mechanism.
- [ ] No new heavy deps / no offline regression; map code stays lazy-loaded via `MapBoard`.
- [ ] Tests: nearest-country resolution picks the intended country (incl. an ocean/near-border tap and
      a micro-state in a cluster); confirm-before-commit; a neighbour tap still never validates the
      target; existing `WorldMap` / `map-framing` tests stay green.
- [ ] Verified in the real app (headless Chrome on :5180) at **World** and **large-continent** framing,
      touch-width and desktop, across projections — exercising a small country in a dense cluster.

## Technical notes
- **Nearest-country (#1)** can reuse what's already there: `rendered` computes each country's projected
  `centroid` (`cx`,`cy`) and `area`. A tap → nearest eligible centroid (optionally within a radius cap)
  is a cheap point-loop; a proper **Voronoi** hit layer (`d3-delaunay`) is the robust version if the
  centroid heuristic misbehaves near long/curved coastlines. Keep the painted dots as the *visible*
  aim points for the smallest countries.
- **Zoom (#2)**, per Phase 22's note, should **transform the projected `<g>`** (and the
  markers/dots/labels) via `d3-zoom` rather than re-projecting — switching questions and zooming both
  stay cheap because the projection stays memoized. `d3-zoom` is small and in the same family as the
  existing `d3-geo`.
- **Confirm-to-answer** changes `map-locate` from the current instant single-tap: `onMapPick` would
  *stage* a pin instead of calling `play.answer` immediately, and a Confirm button (or a second tap on
  the pin) commits. This is also the cleanest answer to the Phase 22 "did it register?" doubt. Guard
  that the staged pin clears on question change (like the multi-select `selected` effect).
- **Grading stays exact.** Phase 22 proved no false-validation; keep that property — resolve the pin to
  a single ISO and grade *that*, and confirm a neighbour/ocean tap resolves as intended.
- **Framing must keep hiding the answer.** Any auto-zoom or tighter framing per question is rejected
  precisely because `focusIsosForConfig` already avoids leaking the target; don't reintroduce a leak.
- **All four projections + reduced-motion + offline** must keep working; no new network dependency.

## Open Questions — to resolve with the owner
1. **Which mechanism (the ranking decision)?** Recommended: **#1 nearest-snap + confirm pin**, with
   **#2 zoom** as an optional layer. Confirm the pick (and whether to include zoom now or defer it
   again).
2. **Confirm vs. instant.** Adopt place-pin → **Confirm** (removes mis-tap anxiety, one extra tap), or
   keep instant single-tap for speed? (Recommendation: **confirm** — it's the confidence fix the owner
   implicitly asked for; the extra tap is cheap.)
3. **Should `map-highlight` also get help** seeing the ringed prompt country on a large board (e.g. a
   gentle auto-zoom to the highlight, since there's no answer to leak there), or is the existing
   13-px-floor pointer ring enough? (Recommendation: a small optional highlight-zoom, low priority.)
4. **Touch-target floor & a11y expectations** — target ~44 px effective; any keyboard/zoom a11y beyond
   "no regression"? (a11y is otherwise Deferred in the main PRD.)
5. **Does nearest-snap risk making World play *too easy*?** Cap the snap radius / only snap within a
   neighbourhood, or snap from anywhere? (Recommendation: a **radius cap** so you still must aim near
   the right country.)
6. **Keep World/large scopes as-is**, or also nudge players toward region-sized boards (e.g. a hint) —
   without removing the large scopes the owner wants? (Recommendation: keep the scopes; fix selection,
   don't restrict the mode.)

## Acceptance criteria
- On a **World** or **large-continent** board, on both a phone-width and a desktop viewport, the player
  can select the intended country **quickly and confidently**, including a small country in a dense
  cluster, with a clear indication of what will be committed before it's graded.
- A near-border / ocean / neighbour tap resolves to the intended country per the chosen mechanism and
  **never falsely validates** a different country (Phase 22 property preserved).
- Micro-state dots and the target-first reveal still work under the new mechanism.
- Works across all four projections and **offline**; reduced-motion honoured; no new heavy dependency.
- Fast loop green (`npm run test` / `check` / `lint`); a manual headless-Chrome pass on :5180 at World
  and region framing.

## Progress log
- **2026-07-11 — PRD drafted** from the owner's report that selecting a country on large continents /
  the world is extremely difficult, with a request to investigate and rank alternatives. Grounded in
  the current map implementation (`WorldMap.svelte` single fixed 980×500 projection, no pan/zoom;
  `map-framing.ts` region fit; Phase 22 visible micro-state dots + target-first reveal; Phase 22
  explicitly **deferred interactive zoom to a future phase** — this one). Investigated eight
  alternatives and ranked them for a playful app; **recommended nearest-country snap + a confirm pin,
  with pinch/scroll zoom as an optional layer**, rejecting per-question auto-zoom and forced
  region-only framing (they leak the answer or delete the challenge). **NOT built** — awaiting the
  clarifying round (above all the ranking decision) and explicit build approval.
</content>
