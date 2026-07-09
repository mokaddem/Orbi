# Phase 22 — Map zoom & small-country visibility/selection

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** 🟡 In progress · **Progress:** ~70%
· **Track:** v1.3 content, languages & new modes

> **Owner decision (2026-07-09):** ship a first increment of **visible micro-state dots + a
> target-first reveal**, and **defer interactive pan/zoom** (OQ1–4) unless play shows it's still
> needed. The three reported problems are addressed at region/world framing; the remaining gap is a
> *comfortable* touch target in dense micro-state clusters on small phones, which only zoom/insets
> would fully close — left as the deferred follow-up.

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Make **every** country — including micro-states like Liechtenstein, Monaco, San Marino, Vatican City,
Andorra, Malta, Singapore — clearly **visible** and reliably **selectable** in the two map modes.
Today tiny countries are effectively impossible to see, and selecting them (or trusting that a
selection was correct) is unreliable. Add **zoom** (and/or a better mechanism) plus tighten
hit-detection and post-answer feedback so map play is fair for small countries.

## The trigger (owner report)
> "Liechtenstein was impossible to see, but the selection worked (not sure if clicking on Switzerland
> validated it though)."

> **(v1.4 addition — ⭐ prioritized quick win)** "When playing 'locate on the map', when you're wrong,
> instead of telling you which country you picked, it should tell you the country you were meant to
> find." — i.e. on a wrong answer the reveal should **lead with the target** (where the country you were
> asked to locate actually is), so the player *learns the location*, rather than drawing the eye to
> their wrong pick.

Three related problems: **(1) visibility** — the country can't be seen on the board; **(2) interaction
confidence** — in click-to-locate it's unclear whether the right country was picked, and whether
clicking a large neighbour (Switzerland) could falsely validate the tiny target (Liechtenstein); and
**(3) reveal focus** — a wrong answer should teach *where the correct country is*, not just mark the
wrong pick. Problem (3) is small and high-value and can ship on its own ahead of the zoom work (see the
"Legible reveal" deliverable) — the owner flagged it as the top-priority item in this phase.

## In scope
- Both map modes: `map-highlight` (see the prompt country) and `map-locate` (click the answer).
- Visibility of small countries, reliable/unambiguous selection, and clear reveal feedback.

## Current state (so scope is clear)
- **`WorldMap.svelte`** projects all countries **once** with `geoNaturalEarth1().fitExtent(...)` on a
  fixed 980×500 logical surface (scales responsively via `viewBox`). **There is no pan or zoom.**
- **`map-framing.ts`** (Phase 12) fits the projection to the active region filter via a robust
  MultiPoint over member centroids — good for region framing, but a micro-state stays tiny even when
  its region fills the board.
- **Micro-state handling already exists but is evidently insufficient on real screens:**
  - *map-highlight:* a "pointer ring" `marker` is drawn on the highlighted country with a **radius floor
    of 13px** (`WorldMap.svelte:113–119`) so even a microstate gets *some* ring. On a phone, scaled down
    from a 980px-wide surface, that ring is still small and easy to miss.
  - *map-locate:* transparent **"hit dots"** (`r=9`) are added for countries whose projected area is
    `< SMALL_AREA` (14px²), rendered above the country paths and sorted smallest-first so the tiniest
    wins overlaps (`WorldMap.svelte:57, 101–109, 159–174`). This should make Liechtenstein clickable —
    but a 9px radius on a downscaled board can fall below a comfortable touch target, and it's not
    visible, so the player has no idea where to aim or whether they hit it.
- **Answer reveal** tints the picked-wrong country red and the correct one green (`stateFor`), but if
  the country is a 2px speck the reveal is as invisible as the prompt — which is why the owner couldn't
  tell what got validated.
- **Not a data gap:** Liechtenstein *has* geometry (only Tuvalu is geometry-less and already excluded
  from map answers by `eligibleAnswers`). This is purely a rendering/interaction problem.

## Depends on
Phase 4 (map modes) and Phase 12 (map readability & region framing — `map-framing.ts`, the marker /
hit-dot machinery this phase revisits). Related to Phase 11 (input & answer-flow UX). Independent of the
new game modes (23–25); placed **right before** them so the map is solid before more modes lean on it.

## Scope / Deliverables
- [x] **Chosen mechanism (owner decision)** — **visible micro-state dots** (the owner's idea), *not*
      pan/zoom. The existing transparent locate-mode hit-dots (`< 14px²` countries) are now drawn as
      **filled dots** (`.dot`, `--color-accent-strong` + white edge) so micro-states are visible and
      have an aim point at the current zoom. Pan/zoom, auto-focus, and insets are **deferred** (see the
      owner-decision note above) — kept as options if play shows the dots aren't enough for dense
      clusters.
- [x] **Reliable, unambiguous selection (map-locate)** — the dot is painted above country paths and is
      the tap target, so a click resolves to the tiny target where the dot is and to the **neighbour**
      everywhere else; confirmed (code + `WorldMap.test.ts`) that a neighbour click **never** validates
      the target. *(Partial: a comfortable ~44px effective target in dense clusters on small phones
      still needs zoom/insets — the deferred part.)*
- [x] **Legible reveal, target-first (⭐)** — after an answer in `map-locate`, the reveal now **leads
      with the correct target**: a green **ring + on-map name label** (with a leader, side-flipping and
      vertically clamped to stay on the board) marks *where* the country is, the wrong pick is kept as a
      **muted** secondary tint (was bright red), and other micro-state dots dim. Threaded via a new
      `revealLabel` prop (`Play` → `MapBoard` → `WorldMap`), fed by `$localizedName(question.answer)`.
- [x] **Responsive & touch-first** — SVG scales via `viewBox` (unchanged); the ring's fade-in respects
      `prefers-reduced-motion` (added to the existing reduced-motion block).
- [x] **Performance & offline** — single projection pass kept; **no new deps** (dots/ring are plain
      SVG); map code still lazy-loaded via `MapBoard`; no flag-session regression.
- [x] **Tests** — `WorldMap.test.ts`: target ring + name label on reveal, micro-state dots visible in
      locate play, and a neighbour click never validates a micro-state target. Existing
      `WorldMap`/`map-framing` tests still green (374 total).

## Technical notes
- **Prefer transforming the projected group over re-projecting.** The projection is computed once and
  memoized; a zoom/pan should apply an SVG/`d3-zoom` transform to the `<g class="countries">` (and the
  markers/hit-dots), so switching questions and zooming stay cheap.
- **Verify the LI/CH case specifically.** Determine whether there is an actual false-validation bug
  (neighbour click grading as correct) or "only" a legibility problem — the fix differs. The hit-dot is
  painted above country paths, so in principle LI's dot wins where it overlaps CH; confirm on a real
  touch device and at region/world framing.
- **A "fit region / reset" affordance** matters once free zoom exists, so a lost player can recover the
  default framing (which `map-framing.ts` already computes).
- Keep the marker/hit-dot fallbacks as a floor even if zoom lands — zoom helps deliberate inspection,
  but the target should be visible/selectable without requiring the player to zoom every question.

## Open Questions — to resolve with the owner
1. **Primary mechanism** — free pan/zoom, auto-focus on the target, inset/loupe for clusters, or a
   combination? (Recommendation: interactive pinch/scroll **zoom + pan** with a reset control, **plus**
   keep/raise the micro-state tap target and improve reveal legibility — zoom alone won't fix
   confidence.)
2. **map-highlight auto-zoom** — automatically zoom to the highlighted country each question, or keep
   the ring and let the player zoom manually?
3. **Confirm-to-answer in map-locate** — tap to place a pin, then confirm (prevents mis-taps and
   answers the "did it validate?" worry), or keep instant single-tap?
4. **Touch-target minimum & a11y** — target size floor; any keyboard/zoom accessibility expectations
   (a11y is otherwise Deferred in the main PRD)?
5. **Is there a real hit-detection bug** in the LI/CH case, or purely visibility? (Drives whether
   grading logic needs a fix vs. just rendering.)
6. **Reveal focus (v1.4, ⭐)** — on a wrong answer, how should the target be led with: a labelled ring
   on the correct country, a brief auto-pan/zoom to it, an always-shown name label, or a combination?
   And should the wrong pick still be shown (secondary) or dropped entirely? (Recommendation: label +
   ring on the target, keep the wrong pick as a muted secondary tint. Ship this ahead of the zoom work.)

## Acceptance criteria
- Every in-scope country, including micro-states, is **visible** and **selectable** in both map modes on
  desktop and mobile.
- In `map-locate`, selecting a country is unambiguous: a neighbour click never falsely validates the
  target, and the tiny target is reachable with a comfortable tap.
- After answering, the player can clearly see which country they picked and which was correct, even for
  micro-states.
- Fast loop green (`npm run test` / `check` / `lint`); a manual headless-Chrome check on :5180 that
  exercises Liechtenstein (highlight + locate) at world and region framing.

## Out of scope
- New map projections or a 3D/interactive globe.
- Non-map modes (flag/text) and the new game modes (23–25).
- Full accessibility overhaul (still Deferred in the main PRD) — this phase only avoids introducing a11y
  regressions and sets a reasonable touch-target floor.

## Progress log
- **2026-07-09 — PRD drafted after the owner hit the problem in play (Liechtenstein invisible; unsure
  whether clicking neighbouring Switzerland validated the answer in locate mode). Grounded in the
  current map implementation (`WorldMap.svelte` one-shot projection with 13px marker floor + `r=9`
  hit-dots for `<14px²` countries; `map-framing.ts` region fit; no pan/zoom). NOT built — awaiting the
  clarifying round and explicit build approval.**
- **2026-07-09 (v1.4 feedback) — folded in the owner's "reveal the target, not my pick" ask as a new
  target-first **Legible reveal** deliverable + Open Question 6, and flagged it as the phase's
  **top-priority quick win** (shippable on its own, no zoom needed). Confirmed the text feedback already
  names the correct country (`play.feedback.reveal`); the gap is on-map emphasis of the target. Still
  NOT built — awaiting approval.**
- **2026-07-09 — Clarifying round + build (increment 1).** Traced the grading path and resolved
  **OQ5 from code:** there is **no false-validation bug** — `onpick` reports the exact ISO of the
  clicked element and `play.answer` grades that; LI's hit-dot sits above CH, so a CH-body click reports
  CH. The owner's uncertainty was an invisible dot working with no visual confirmation → purely a
  visibility/confidence problem. Owner's steer on **OQ1**: instead of pan/zoom, **make the existing
  hit-dot visible** ("wouldn't that solve it?") — yes, far cheaper and offline. Decisions: **dots +
  target-first reveal now, defer zoom**; picked the visual fork from a throwaway prototype (framed on
  the Alps, real projection): **filled dot** for play (over ring/halo) and **green ring + name label**
  for the reveal (**OQ6**; wrong pick kept muted). OQ2/3/4 deferred with the zoom work. Built in
  `WorldMap.svelte` (+ `revealLabel` threaded through `MapBoard`/`Play`). Fast loop green (check 0
  errors / 374 tests / lint) and a headless-Chrome pass on :5180 of the real components in all three
  states (locate play; wrong reveal; correct reveal) — dots visible, target ring+label leads, wrong
  pick muted. Prototype/verify harnesses removed. **Zoom/insets + comfortable dense-cluster touch
  target remain deferred** (OQ1–4) pending whether play shows they're needed.**
