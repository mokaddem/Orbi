# Phase 19 — Region classification & bucketing rework

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
· **Track:** v1.3 content, languages & new modes

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Fix the **"weird" region buckets**. Playing a region-filtered game today can draw from a pool far
smaller than the question count — e.g. "Eastern Europe" has only **4** countries, so a 10-question
round just cycles the same handful. Investigate how we group countries (**geographic vs. political**)
and decide whether to keep the current scheme, **merge** small groups, adopt a different one, or add a
**minimum-pool guard**.

## In scope
- An investigation of the current sub-region scheme and its pool sizes.
- A decision on grouping strategy, and the change (data and/or runtime) that implements it.
- Re-verification of every feature that consumes region/sub-region granularity.

## Current state (so scope is clear)
- **The dataset stores an M49-style `region` (5) and a finer `subregion`, both from `world-countries`.**
  That source's sub-regions are **finer than classic UN M49** — Europe is split into **6**
  (Central / Eastern / Northern / Southeast / Southern / Western), including non-M49 labels like
  "Central Europe" and "Southeast Europe". Splitting off "Central Europe" is what shrinks "Eastern
  Europe" to 4.
- **Measured pool sizes (live dataset)** — **12 of ~24 sub-regions have < 8 countries:**
  - Europe: Eastern Europe **4**, Central Europe 6, Southeast Europe 8, Western Europe 8, Southern 9,
    Northern 10.
  - Americas: North America **3**, Central America 7 (Caribbean 13, South America 12).
  - Oceania: Australia & New Zealand **2**, Polynesia **3**, Melanesia 4, Micronesia 5.
  - Asia: Central Asia **5**, Eastern Asia **5**, Southern 9 (South-Eastern 11, Western 17).
  - Africa: Southern Africa **5**, Northern Africa 6 (Middle 10, Western 16, Eastern 17).
- **Why it repeats:** the session draws answers via `drawAnswerSequence` (`src/domain/questions.ts`),
  which reshuffles and re-draws from the (small) pool — so a 4-country sub-region yields lots of repeats
  in a 10-question game.
- **Consumers of region/sub-region granularity (all must be re-verified):**
  - Region filter in Play setup (Phase 5) — `getSubregions`, `getCountriesBySubregion`.
  - **Weak-spot recommendations use the *sub-region* as the unit** (Phase 14 —
    `computeRegionAccuracy`, weakest sub-region with ≥ 10 attempts).
  - **Mastery by region** (Phase 16) and its achievements ("master every country in region X").
  - **Daily Challenge** region selection (Phase 15).
  - Region/sub-region **i18n names** (`src/i18n/regions.ts`, and the DE map from Phase 17).
  - The **encyclopedia** (Phase 20) if built — it should reflect the final grouping.
  - `region-shapes.json` silhouettes are **per top-region only** (World + 5), so merging *sub-regions*
    needs no new shapes; changing top-level `region` would.

## Depends on
Phase 1 (data layer). **Foundational — recommended before Phase 20** (so the encyclopedia reflects the
final grouping) and Phases 14/16 should be re-verified afterwards. Otherwise independent.

## Scope / Deliverables
- [ ] **Investigation writeup** — the per-sub-region counts above, which buckets are too small, and a
      target **minimum pool size** (e.g. ≥ 8, so a 10-question game has variety). Record in the Progress
      log / a short note.
- [ ] **Chosen strategy (owner decision)** — one (or a mix) of:
      - *Keep* the granular `world-countries` scheme (do nothing to data) **+ a runtime minimum-pool
        guard** — picking a too-small sub-region auto-widens the answer pool (and distractors) to the
        parent region, so it never degenerates. Lowest-risk, no data change.
      - *Revert to classic M49* 4-way sub-regions (merge Central Europe → Eastern/Western, etc.).
      - *Merge* only the smallest buckets into neighbours (targeted).
      - *Custom "play regions"* tuned for quiz balance (a curated grouping layer over the raw data).
- [ ] **Implementation** — either a **data change** (derive/override `subregion` in `build-data.mjs`
      or a mapping layer) **or** a **runtime guard** in the pool/filter logic, per the chosen strategy.
      Keep domain logic pure and unit-testable.
- [ ] **i18n** — add/rename/remove region labels (EN/FR/DE) to match the new grouping; keep the
      English-key fallback; `regions.test.ts` + `messages.test.ts` green.
- [ ] **Re-verify dependents** — weak-spot recommendations (14), mastery/achievements (16), Daily (15),
      region filter (5), encyclopedia (20 if present) still behave and their tests pass.
- [ ] **Tests** — the guard/merge logic; that no filterable group falls below the target minimum (or is
      handled by the guard).

## Technical notes
- **Two philosophies, and they can combine.** A *data* regrouping changes what the player sees as
  regions (and ripples into names, mastery, recommendations). A *runtime minimum-pool guard* leaves the
  taxonomy intact but prevents tiny pools at play time — much smaller blast radius. The guard is a
  strong low-risk default; a data regroup is warranted only if the owner wants the *labels* to change.
- **Beware the mastery/achievement ripple** — merging or renaming regions changes the denominators and
  the set of "master region X" achievements (Phase 16). Decide how existing progress maps onto any new
  grouping (and whether historic `SessionRecord.regionFilter` values still resolve).
- **Distractor quality is a related lever** — even with small answer pools, `selectDistractors` already
  tiers sub-region → region → world, so options stay plausible; the guard mainly fixes *answer* variety.
- **Political sensitivity** — any regrouping of countries is a judgement call; keep it geographic and
  uncontroversial, and let the owner sign off on placements.

## Open Questions — to resolve with the owner
1. **Top-level regions** — keep the 5 M49 regions as-is? (Recommend yes; only sub-regions are the
   problem.)
2. **Strategy** — runtime minimum-pool guard (no data change), classic-M49 merge, targeted merges, or
   custom play-regions? (Recommend: **guard first**, regroup only if labels must change.)
3. **Target minimum pool size** — what's "enough" for a 10-question game (≥ 8? ≥ 10?)?
4. **Tiny sub-regions in the filter UI** — hide them as standalone options, or keep them but auto-widen
   the pool at play time?
5. **Reclassify `region` too, or only `subregion`?**
6. **Progress mapping** — how do existing mastery/achievements and history map onto any new grouping?

## Acceptance criteria
- No region/sub-region a player can select yields a degenerate pool for a standard game — either every
  filterable group meets the target minimum, or the minimum-pool guard demonstrably widens it.
- The chosen strategy is implemented with pure, unit-tested logic; region i18n matches the new grouping.
- All dependent features (Play filter, weak-spot recs, mastery/achievements, Daily, encyclopedia) still
  work and their tests pass.
- Fast loop green (`npm run test` / `check` / `lint`); manual headless-Chrome check on :5180 confirms a
  previously-tiny region now plays with real variety.

## Out of scope
- Changing the top-level continent model or the country **scope** (that's Phase 21).
- New per-sub-region map silhouettes (only needed if top-level regions change).
- Difficulty tuning beyond fixing pool sizes.

## Progress log
- **2026-07-09 — PRD drafted after the owner tried the app and found region buckets "weird" (e.g.
  Eastern Europe = 4 countries for a 10-question game). Confirmed against the live dataset: 12 of ~24
  sub-regions have < 8 countries (finer-than-M49 `world-countries` scheme). NOT built — awaiting the
  clarifying round and explicit build approval.**
