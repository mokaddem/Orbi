# Phase 26 — Region-scoped review ("time to review" by region)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
· **Track:** v1.4 post-play feedback

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Stop **review sessions from being polluted by regions the player never intended to study**. Today
"train my mistakes" / the due-review recommendation pools *every* weak item worldwide into one round,
so mistakes from a region the player only ever brushed against (e.g. a one-off "World" game) drown out
the region they're actively working on. Make review **region-aware**: let the player choose (or be
offered) *which region to review*, so a Europe-focused learner reviews Europe — not a backlog of
Africa items they failed once and never trained.

## The trigger (owner report)
> "The 'time to review' mode should propose which region to train on. I tried the World one and got
> asked a lot of stuff from Africa. Since I haven't trained on those, I failed all of them and they
> 'pollute' the one I actually want to review (I'm currently practising EU). So either propose per
> region, or find a clever way to do the review."

Two coupled effects: **(1)** playing an unfiltered "World" round seeds SM-2 lapses across *all* regions
at once; **(2)** the review flow then has no way to focus — it drills the global weakest-first pool, so
the freshly-failed foreign region dominates the queue and buries the region the player cares about.

## In scope
- The **due-review** path (SM-2 items due now) and the **"train all my mistakes"** path.
- A way to **scope review to a region** (chosen by the player and/or proposed by the app).
- Keeping the recommendation card / Home entry points coherent with the new region dimension.

## Current state (so scope is clear)
- **Review has no region dimension.** `selectTrainingItems` (`src/domain/training.ts`) filters SR items
  by `mode`, `dueOnly`, and `limit` only — there is **no region option**. `dominantTrainingMode` picks
  the single mode with the most trainable items.
- **The due recommendation is global.** `recommend()` (`src/domain/recommend.ts`) builds a `due`
  recommendation from the whole SR pool (weakest-first, capped at `DEFAULT_DUE_LIMIT = 20`), committing
  to one dominant mode. There is no "review region X" recommendation — the only region-aware suggestion
  is `weak-spot` (a *fresh fixed* session on the weakest sub-region by recent accuracy, **not** an SR
  review of that region).
- **"Train all" is global too.** `loadTrainingPlan()` (`src/ui/stores/persistence.ts`) returns
  `{ mode, iso2s }` for the dominant mode across *all* mistakes; Home's `trainAll()` launches exactly
  that pool.
- **Region resolution already exists.** `regionOf` (persistence store) maps an `iso2` →
  `{ region, subregion }` from the bundled dataset, and `computeRegionAccuracy` (`src/domain/stats.ts`)
  already groups history by sub-region. So grouping SR items by region is cheap and needs no new data.
- **SR keys carry the country, not the region.** `itemKey = ${mode}:${iso2}`; the region is derived via
  `regionOf(iso2)`. Filtering a training pool by region is a pure post-filter on the resolved region.

## Depends on
Phase 7 (spaced repetition / `training.ts`), Phase 14 (recommendations / `recommend.ts`), and the Home
entry points (Phase 14/16). **Strongly related to Phase 19 (region bucketing)** — the *unit* of "a
region to review" (top-level M49 region vs. finer sub-region) should agree with whatever Phase 19
settles; note the dependency and pick a unit that survives 19. Independent of the new modes (27) and
map work (22, 28).

## Scope / Deliverables
- [ ] **Region-aware selection (domain, pure).** Extend training-item selection so a review pool can be
      narrowed to a region (e.g. add an optional `region`/`regionOf` filter to `SelectTrainingOptions`,
      or a small helper that groups `selectTrainingItems` output by resolved region). Keep it pure and
      unit-tested; do not bake `regionOf` into the domain in a way that couples it to the dataset (inject
      it, mirroring `recommend`).
- [ ] **Per-region review offer (the "propose which region" ask).** Surface review **grouped by
      region** — e.g. one entry per region with a due/missed count ("Europe — 12 to review"), ordered
      most-due-first, each launching a training session scoped to that region. Decide the surface with
      the owner (Next-up card variants, a dedicated "Review" screen/section, or a region picker on the
      existing train-all button) — see Open Questions.
- [ ] **Region-scoped launch.** Reuse the existing `answerPoolIso` training mechanism in
      `game.ts` — a region-scoped review is just `selectTrainingItems(...)` filtered to that region's
      ISO codes. No engine change beyond selection.
- [ ] **Keep a "review everything" escape hatch** so the global behaviour is still one tap for players
      who want it.
- [ ] **i18n** — any new strings (region-review titles, counts) in EN/FR/DE with parity.
- [ ] **Tests** — region filtering of the training pool; the per-region counts; that a region-scoped
      session only asks about that region's items; recommendation ordering with the region dimension.

## Technical notes
- **This is mostly a *selection + surfacing* change, not an engine change.** The session engine already
  accepts an explicit `answerPoolIso`; the work is (a) computing region-scoped pools purely and (b)
  presenting the choice. Resist widening the engine.
- **Don't confuse the two region-aware ideas.** `weak-spot` (Phase 14) proposes a *fresh* round on a
  weak sub-region; this phase is about *SR review* (due/missed items) scoped to a region. They can
  coexist — decide whether region-scoped review becomes a new `RecommendationKind` (e.g. `due-region`)
  or lives outside the single "Next up" card.
- **Root-cause option worth discussing:** the pollution partly comes from *unfiltered "World" play*
  seeding lapses everywhere. A lighter complementary fix is to make it easy to review by region even
  when mistakes were made in World mode — which this phase delivers — rather than changing how World
  play records mistakes. Only revisit mistake-recording if the owner wants it (out of scope by default).
- **Unit of region:** default to the **top-level M49 region** (5 continents) for the review offer — it
  matches the player's mental model ("I'm doing EU") and avoids the tiny-bucket problem Phase 19
  tackles. Confirm with the owner.

## Open Questions — to resolve with the owner
1. **Surface** — how should the region choice appear? (a) per-region cards/chips with due counts on
   Home or a dedicated Review section; (b) a region dropdown on the existing "train all" button; (c) a
   new `due-region` "Next up" recommendation. (Recommendation: **(a)** a compact per-region review list,
   most-due-first, with a global "review everything" fallback.)
2. **Unit of region** — review by **top-level region** (5 continents) or by **sub-region**?
   (Recommendation: top-level region; revisit after Phase 19.)
3. **Auto-propose vs. always-choose** — should the app pre-select the region with the most due items
   (one tap) but let the player switch, or always make them pick?
4. **Mode within a region** — keep the current "dominant mode" auto-pick per region, or let the player
   choose the mode too?
5. **Interaction with `weak-spot`** — keep both the fresh weak-spot suggestion and region-scoped SR
   review, or unify them?
6. **Scope vs. Phase 19** — build now against the current sub-region scheme, or sequence after Phase 19
   so the region unit is final?

## Acceptance criteria
- The player can review a **chosen region's** due/missed items without foreign-region items entering the
  session, and can still choose to review everything.
- Region-scoped review pools are computed by **pure, unit-tested** logic; a region-scoped session
  demonstrably asks only about that region.
- The Home/recommendation entry points present the region choice coherently (no dead ends, counts
  correct), EN/FR/DE parity holds.
- Fast loop green (`npm run test` / `check` / `lint`); a manual headless-Chrome check on :5180 confirms
  that after failing several Africa items in a World round, the player can review **Europe only**.

## Out of scope
- Changing how unfiltered "World" play records mistakes into SM-2 (unless the owner explicitly opts in).
- The region **bucketing/merge** decision itself (Phase 19).
- New quiz modes (27) and any map-rendering changes (22, 28).

## Progress log
- **2026-07-09 — PRD drafted from the owner's post-play feedback ("time to review should propose which
  region; World play polluted my EU review with failed Africa items"). Grounded in `training.ts`
  (no region option), `recommend.ts` (global `due` rec, capped at 20), and `loadTrainingPlan` (global
  pool) — the `answerPoolIso` + `regionOf` machinery to scope review already exists. NOT built —
  awaiting the clarifying round and explicit build approval.**
</content>
</invoke>
