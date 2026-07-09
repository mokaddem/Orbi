# Phase 14 — Smart "Next up" recommendations

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
· **Track:** v1.2 retention & engagement

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Turn the app from a menu into something that **tells the player what to do next**. Add a single
**"Next up"** recommendation card (on **Home**, and after a game on **Summary**) that picks the
highest-value action from the player's own state and launches it in one tap, with a short *why*.

The insight: the app already computes *what to review and when* (SM-2 `dueAt` per item) and *where
the player is weak* (per-country miss data in history) — but that intelligence only powers one binary
"Train my mistakes" button today. This phase surfaces it as an always-present, reasoned suggestion.

### In scope — the recommendation types (agreed with owner)
1. **Next up** — the card itself: one recommended action, chosen by priority, one tap to start.
2. **Due for review** — surface items whose SR review is due (`dueAt <= now`), weakest first.
3. **Weak spot** — surface the region / sub-region with the lowest recent accuracy.

(The other brainstormed types — blind-spot/never-played, on-a-roll expansion — are **out of scope**
here; see [Out of scope](#out-of-scope). A neutral fallback for the fresh/no-data case is still
needed so the card is never empty — see Open Questions.)

## Current state (so scope is clear)
- **Home** (`src/ui/routes/Home.svelte`) shows Play + a single "Train my mistakes" button that calls
  `loadTrainingPlan()` and is disabled when there's nothing to train. No reasoning, no alternatives.
- **Summary** (`src/ui/routes/Summary.svelte`) offers Retry / Train missed / New game — all about the
  *just-finished* session, nothing forward-looking.
- **Domain already provides most signals:**
  - `selectTrainingItems()` / `loadTrainingItems()` (`src/domain/training.ts`,
    `src/ui/stores/persistence.ts`) return due + missed SR items, weakest first, with a `due` flag and
    optional `dueOnly`/`mode`/`limit`. This is the **due-for-review** signal, ready to use.
  - `computeStats()` (`src/domain/stats.ts`) rolls history into `mostMissed` (per-country) and
    per-day activity — but **not** per-region accuracy yet.
- **Gap:** there is no per-region accuracy rollup. `SessionRecord.regionFilter` records what was
  *played*, not per-country region; each `QuestionResult` carries `countryIso2`, so region accuracy
  must be computed by joining results to `getCountry(iso2).region` / `.subregion`
  (`src/data/countries.ts`). This is a new pure helper.
- **Launching is solved:** every recommendation resolves to a `RunConfig` set on `pendingConfig`
  (`src/ui/stores/game.ts`) then `push('/play')` — exactly how Home's train button and Summary's
  retry already work (training uses `answerPoolIso`; region play uses `filter`).

## Depends on
Persistence + history (Phase 6) and SR/training (Phase 7). Independent of Phases 15–16 (may ship in
any order), but **recommended first** — it's the centerpiece the other two reinforce.

## Scope / Deliverables
- [x] **Recommendation engine (pure, unit-tested)** — a new `src/domain/recommend.ts` that takes
      SR items + session records + `now` and returns an **ordered list** of typed recommendations,
      each with: a `kind` (`due` | `weak-spot` | fallback), a display payload (count / region key /
      accuracy), a *reason* key for i18n, and enough to build a `RunConfig`. Priority order and the
      thresholds are owner decisions (see Open Questions). Pure and deterministic given `now`.
- [x] **Per-region accuracy helper** — extend `stats.ts` (or a sibling) with a rollup of accuracy by
      region and sub-region (join `QuestionResult.countryIso2` → country region), with a minimum
      sample-size guard so a single wrong answer doesn't crown a "weakest region". Unit-tested.
      _(Built as `computeRegionAccuracy(records, regionOf)` in `stats.ts`; the sample-size floor is
      applied by the engine, not the rollup, so the raw rollup stays reusable and easy to test.)_
- [x] **"Next up" card component** — a reusable component rendering the top recommendation: icon,
      title, one-line reason, and a primary "Start" action; optionally a compact "more suggestions"
      affordance if we show >1 (Open Questions). Reuses existing card styling
      (`--color-surface`, `--shadow-card`, `ModeIcon`/`RegionIcon`). _(Single card, no
      "more suggestions" list — decision Q2.)_
- [x] **Wire into Home** — show the card above/near Play; keep or fold in the existing "Train my
      mistakes" button per the owner's call (the recommendation may supersede it). _(Card is the hero;
      the old train button became a compact "Train all my mistakes (N)" link + an "Or start a custom
      game" link — decision Q6.)_
- [x] **Wire into Summary** — show a forward-looking "Next up" alongside the existing session actions.
      _(Card sits under the missed list, above Retry / Train-these / New-game.)_
- [x] **Launch flow** — starting a recommendation sets `pendingConfig` and routes to `/play`, reusing
      the training (`answerPoolIso`) or region (`filter`) config paths already in `game.ts`.
      _(`recommendationToConfig(rec, prefs)` in `game.ts`; `fresh-start` stages `null` → Play setup.)_
- [x] **i18n** — EN/FR strings for card titles, each reason type, and the fallback. Parity enforced by
      `src/i18n/messages.test.ts`. _(New `recommend.*` namespace + `home.trainAll`/`home.playCustom`.)_
- [x] **Tests** — unit tests for the engine (each `kind`, priority, thresholds, empty/fresh fallback,
      tie-breaks) and the region-accuracy helper; a component test that the card renders the expected
      recommendation and that its action stages the right `RunConfig`. _(`recommend.test.ts`,
      `stats.test.ts`, `NextUpCard.test.ts`; `Home.test.ts` updated to the new card + train-link.)_

## Technical notes
- **Keep the brain pure.** All selection/priority logic lives in `src/domain/recommend.ts` with `now`
  injected (mirrors `selectTrainingItems`), so it's fully unit-testable with seeded data and no clock.
  The UI store (`persistence.ts`) exposes a thin `loadRecommendations()` that feeds it stored SR items
  + sessions, like `loadTrainingPlan()` does today.
- **Due-for-review** should reuse `selectTrainingItems(..., { dueOnly: true })` for the due set and can
  fall back to `dueOnly: false` (missed-but-not-due) when nothing is strictly due — decide the exact
  rule with the owner.
- **Weak spot** needs the new region-accuracy rollup + a sample-size floor (e.g. ≥ N attempts in that
  region) so it's meaningful; it launches a normal `fixed` session with that `RegionFilter`.
- **Never empty:** on a brand-new profile (no SR, no history) the card must still say something useful
  (e.g. "Start with Europe" or "Play your first round") — the fallback is a deliberate design choice.
- One session runs one mode; a due-review recommendation follows the existing "dominant mode" approach
  (`dominantTrainingMode`) or lets the recommendation carry its own mode. Decide with the owner.

## Open Questions — to resolve with the owner
1. **Priority order** when multiple apply — is it always **due-for-review → weak-spot → fallback**, or
   should a large due backlog outrank everything? (Recommendation: due first, then weak-spot.)
2. **How many recommendations to show** — just the single top card, or top-1 with a small "other
   ideas" list? (Recommendation: single card on Home + Summary; keep it decisive.)
3. **"Due" rule** — strictly `dueAt <= now` only, or fall back to missed-but-not-yet-due when nothing
   is due? Minimum count to bother surfacing it (e.g. ≥ 1, or ≥ 5)?
4. **Weak-spot granularity & threshold** — region or sub-region? Minimum attempts before a region can
   be "weakest" (e.g. ≥ 10)? Accuracy ceiling to qualify as "weak" (e.g. < 70%)?
5. **Fallback content** for a fresh/empty profile — a fixed suggestion (e.g. Europe), a random region,
   or just "Play your first round"?
6. **Relationship to the existing "Train my mistakes" button** — replace it with the card, keep both,
   or have the card *be* the new training entry point?
7. **Placement/prominence** on Home and Summary (above Play? beside it?).

## Acceptance criteria
- Home and Summary show a "Next up" card that reflects the player's real state and, in one tap, starts
  the recommended session with the correct mode/filter/pool.
- The recommendation engine is pure and covered by unit tests for every `kind`, the priority order,
  thresholds, tie-breaks, and the fresh-profile fallback (card is never empty).
- Per-region accuracy helper is unit-tested, including its sample-size guard.
- EN/FR parity holds (`messages.test.ts` green).
- All owner questions above are answered and reflected in the implementation.
- Fast loop green (`npm run test` / `npm run check` / `npm run lint`); manual browser check on 5180.

## Out of scope
- Blind-spot ("you've never played X") and on-a-roll ("ready for a harder region?") recommendation
  types — deferred; can be added to the engine later without rework.
- Push notifications / re-engagement reminders (were part of the brainstorm's Option B; not in this
  track).
- Adaptive difficulty ramp (choices 4→3, scope widening) — Deferred/Future in the main PRD.

## Progress log
- **2026-07-08 — PRD drafted from the retention brainstorm (owner picked: Next up + Due-for-review +
  Weak-spot). NOT built — awaiting the clarifying round and explicit build approval.**
- **2026-07-08 — Clarifying round resolved with owner; answers below. Then built and verified with
  explicit approval ("Proceed with implem!").**
  - **Q1 Priority:** due-for-review → weak-spot → fresh-start (the list always ends with fresh-start
    so the card is never empty).
  - **Q2 How many:** a single decisive card on Home + Summary; no "other ideas" list.
  - **Q3 "Due" rule:** the card's *due* kind is **strictly `dueAt <= now`, min ≥ 1**. Missed-but-not-
    yet-due items are intentionally left to the "train all my mistakes" link, so weak-spot gets a turn
    once reviews are caught up.
  - **Q4 Weak-spot:** weakest **sub-region**, needs **≥ 10 attempts** there and **< 70%** accuracy
    (`DEFAULT_WEAK_SPOT_MIN_ATTEMPTS` / `DEFAULT_WEAK_SPOT_MAX_ACCURACY`). Session mode = the mode
    most-attempted in that sub-region.
  - **Q5 Fallback:** *Play your first round* — the fresh-start card routes to the normal Play setup
    screen (no forced region); copy is neutral ("Ready to play") so it also fits the caught-up case.
  - **Q6 Train button:** *card + link* — the card is the hero; the old "Train my mistakes" button is
    now a compact "Train all my mistakes (N)" link (full backlog via `loadTrainingPlan`) beside an
    "Or start a custom game" link.
  - **Q7 Placement:** Home — card is the hero above the secondary links; Summary — card under the
    missed list, above the session-specific Retry / Train-these / New-game actions.
  - **Built:** `domain/recommend.ts` (+ `recommend.test.ts`), `computeRegionAccuracy` in `stats.ts`
    (+ tests), `loadRecommendations()` in `persistence.ts`, `recommendationToConfig()` in `game.ts`,
    `components/NextUpCard.svelte` (+ test), Home & Summary wiring, `recommend.*` i18n (EN/FR).
  - **Verified:** `npm run test` (all suites green), `npm run check`, `npm run lint` all pass; manual
    headless-Chrome check on :5180 exercised all three card kinds (fresh-start, weak-spot 33%, due),
    the priority order, the train-all link, a one-tap launch into a 5-question training session, and
    the Summary card placement.**
