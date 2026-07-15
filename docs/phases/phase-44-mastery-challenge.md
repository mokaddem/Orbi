# Phase 44 — Mastery Challenge (capstone / "prove-it" run)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** 🚧 In progress · **Progress:** ~45% (domain, controller/persistence, i18n + capstone achievements)
· **Track:** v2.7 — Mastery capstone

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Add a **gated capstone challenge** that becomes available only once you've *already* mastered a
**family × region** (e.g. Flags × Europe), and that TRULY proves that mastery in a way a normal
4-choice round cannot. In the challenge you must correctly identify **every country in the region**,
one at a time, **without the 4-choice crutch** — the answer options are the *whole* region, not a
lucky sample of four. Each cleared country drops out of the queue, so a shrinking `42 / 54` progress
bar drives a satisfying "clear the board" run, and finishing (cleanly) earns a distinct capstone
reward above the existing continent badges.

This fills a real gap: today mastery is *built* (spaced repetition), *measured* (Phase 41 per-family
mastery %), and *rewarded* with monotonic badges — but it is never **tested end-to-end under a
prove-it constraint**. Every normal round samples ~4 distractors and a handful of countries; you can
"pass" a region having never once been asked about its hardest members.

## The trigger (owner request — 2026-07-14)
Owner idea, verbatim intent: *"add something like a 'mastery challenge' (name it differently if
better), that unlocks only when you've mastered a mode+region. In that mode, instead of 4 choices to
pick from, you have all of them available. For every successful guess, that country gets removed from
the pool."* Plus the open design ask: *"do you have other suggestions that would TRULY show you've
mastered a mode+region?"*

Discussion outcome that shaped this PRD:
- The core mechanic (full pool + clear-the-board) is sound and fits the codebase.
- **One flaw to fix:** if the *answer options* shrink as countries are cleared, the run gets *easier*
  toward the end (process of elimination — the final country is a 100% freebie), which undermines the
  "mastery" claim. Fix: the **queue** shrinks (visible progress + coverage), but the **answer options
  stay the full region** the whole run.
- Additional mastery dimensions surfaced for the owner to choose among (see Open Questions): **both
  directions** of the family (the most honest test, and how Phase 41 already defines mastery),
  **fluency** (a timer / personal best), an **error budget** (perfect run vs a small allowance), and
  **retention** (badge decay) — the last two are the strictest and are flagged rather than assumed.

## Current state (so scope is clear)
- **Mastery is already modelled per family × region.** `computeFamilyMastery`
  (`src/domain/mastery.ts:221`) over `FAMILIES` (`src/domain/modes.ts:53` — **Map** = map-highlight +
  map-locate, **Flags** = flag-to-country + country-to-flag, **Capitals** = the two capital
  directions) yields a `blended` % plus fully-mastered / in-progress / unseen tallies. A family is
  "mastered" only when **both** directions clear the bar (`mastery.ts:250`); `MASTERY_MIN_REPETITIONS
  = 2`; `isItemMastered` at `mastery.ts:79`. **This is the natural unlock signal** — no new "score"
  needs inventing.
- **A (region × family) → targeted drill already exists.** `regionFamilyPracticePool`
  (`src/domain/mastery.ts:357`) returns `{ mode, iso2s }` — the unmastered countries of a region×family
  in the weaker direction — wired to the Progress "Practise unmastered {family} in {region}" CTA
  (`Progress.svelte:69`). The challenge is a sibling: the *fully-mastered* set, run under prove-it
  rules.
- **Session formats are additive.** `SessionType = 'fixed' | 'survival' | 'full' | 'training'`
  (`src/domain/types.ts:41`). Phase 35 added `'full'` (Grand Tour = **every country in the region
  once**) — the closest existing thing to a clear-the-board run, and the exact precedent for adding a
  new format. The engine (`src/domain/session.ts`) is a without-replacement draw bag with a
  `shouldFinish()` and an `answerCount` getter.
- **Options / distractors are capped small today.** `buildQuestion` (`src/domain/questions.ts:230`)
  builds `options = shuffle([answer, ...distractors])`; `DEFAULT_CHOICES = 4` (`questions.ts:13`);
  `choicesPerQuestion` pref is bounded 2–6. A "whole-region pool" is a **new** option-generation path.
  Note `map-locate` already has **no** options grid — you click the map (`hasOptions` false,
  `questions.ts:54`) — so it is *already* unaided; "full pool" only changes the pick-from-list modes.
- **Achievements are declarative + monotonic.** `ACHIEVEMENTS` catalog (`src/domain/achievements.ts:130`),
  `AchievementDef { id, region?, topic?, predicate }`, evaluated purely by `evaluateAchievements`
  (`achievements.ts:180`) over an `AchievementContext`; unlocks (`AchievementUnlock { id, unlockedAt }`)
  are **never revoked** (Phase 41 retargeted continent / `world-mastered` badges to fully-mastered).
  A capstone badge = one catalog entry + one i18n key per locale. **Badge *decay* would break the
  monotonic invariant** — a deliberate design decision, not a freebie (OQ8).
- **Challenge-lifecycle precedent exists.** The Daily Challenge (`src/domain/daily.ts`, singleton
  `DailyResult` + `dailyChallenge` IDB store, seeded RNG) is the template for a per-challenge "done /
  best" record if we persist one.
- **Regions:** 5 UN regions + 15 play sub-regions; **World = no region filter** (`RegionFilter` optional
  fields, `types.ts:44`). Region sizes range from Oceania 14 → **Africa 54** → **World 195** — the big
  ones drive the UX questions below.
- **Gaps:** no unlock/gating concept anywhere; no whole-region option pool; no per-run "cleared the
  board" / perfect-run record; no best-time; `bestStreak` is not persisted; no capstone badge or copy.

## In scope
- **A new gated challenge** per **family × region** (Map / Flags / Capitals × a region or sub-region),
  reusing the eight existing modes' rendering — a *format*, not a new game mode (like Grand Tour).
- **Unlock gate** — the challenge is **locked** until its family × region is mastered by the existing
  `computeFamilyMastery` definition (recommended, OQ2). Locked entry points show a clear "master this
  first" affordance rather than being hidden.
- **Clear-the-board queue** — every country in the region is asked **once**; a correct clear removes it
  from the *queue* (not the option pool); a prominent `cleared / total` progress bar. A missed country
  **recycles** to the back of the queue and must be cleared to finish (OQ5 sets the exact miss rule).
- **Full-region answer options (fixed)** — for pick-from-list modes the options are the **whole
  region**, held constant for the entire run (no elimination advantage). Map-locate stays click-only
  (already unaided). This overrides `choicesPerQuestion` for the challenge.
- **Both-directions option** — support interleaving both directions of the family in one run
  (recommended, OQ4), since Phase 41 mastery already means "both directions."
- **Pass / certify + capstone reward** — completing the board (within the error budget, OQ5) certifies
  the challenge; a **flawless run** (zero misses) earns a distinct higher tier. New monotonic
  achievement(s) in the catalog + celebration reusing the existing `finish`/`perfect` jingle +
  `StreakBurst`.
- **Large-pool UX** — a usable way to pick 1-of-N when N is large (Africa 54, World 195): e.g.
  type-ahead / searchable list, scrollable grid, or restricting the full-list mechanic to sub-regions
  while World/large regions use map-click or search (OQ6/OQ7).
- **Entry points** — surfaced where mastery already lives (Progress family/region breakdown; optionally
  a Home chip), plus a challenge card on the Play setup screen for unlocked family × regions.
- **i18n EN/FR/DE** — challenge name (OQ9), lock/unlock copy, progress ("{cleared} of {total} cleared"),
  pass/flawless copy, badge title/desc; `messages.test.ts` parity stays green.
- **Tests** — pure logic (unlock predicate, whole-region option builder, clear-the-board queue +
  recycle-on-miss + finish, pass/flawless grading) with injected RNG/clock; component (locked→unlocked,
  full pool renders, board clears, pass/flawless celebration); a headless real-app drive of a full
  clear on a small region.

## Out of scope (deliberately)
- **Online / global leaderboards** — Non-Goal (no backend, no social). Any best/time is **local only**.
- **No new game mode** — the challenge reuses the existing modes; it is a *format*.
- **Extra-knowledge modes (Languages / Industries)** — the multi-select / single-select attribute modes
  are structurally unlike identity modes; the challenge covers the **core families (Map / Flags /
  Capitals)** only. (A later extension is possible.)
- **Free-text typing** as the recall input — bilingual/trilingual country-name spelling is messy;
  full-pool selection is the pragmatic "unaided" mechanic. (Typing could be a future variant.)
- **Changes to SR scheduling, the mastery computation, or normal fixed/survival/full/training runs.**
- **Badge decay / expiry** is *out* unless OQ8 explicitly opts in — it breaks the monotonic-unlock
  invariant and needs its own design.

## Depends on
Phase 41 (per-family mastery — the unlock signal + the region×family pool), Phase 16 (achievements /
badges — the capstone reward, monotonic unlocks), Phase 2 (core quiz engine — `SessionType`, draw bag,
`shouldFinish`, `answerCount`), Phase 35 (the session-format + Grand-Tour "every country once"
precedent), Phase 5 (region / sub-region filter). Phase 7 (SR) and Phase 36/39 (sound cues) are
supporting. Independent of Phases 42 (Blitz) and 43 (Explorer rank) — if 43 ships, a clean/flawless
challenge is a natural XP event.

## Deliverables checklist
- [ ] Unlock predicate — a pure `isChallengeUnlocked(familyMastery, {family, region, subregion})`
      (family × region mastered per Phase 41), + a locked/unlocked entry-point affordance.
- [ ] Challenge run model — a new format (recommended `SessionType: 'challenge'`, additive like `full`)
      that draws **every** country in the region once, **recycles a missed country** to the queue's
      back, and finishes only when the board is cleared; `cleared / total` progress exposed.
- [ ] Whole-region option builder — a `questions.ts` path that produces **fixed, full-region** options
      for pick-from-list modes (bypassing `choicesPerQuestion` / `selectDistractors`); map-locate
      unchanged (click-only). No elimination shrink of options.
- [ ] Both-directions interleave for the run (if OQ4 = both).
- [ ] Pass / flawless grading + capstone achievement(s) in `ACHIEVEMENTS`, celebrated on finish
      (existing jingle + `StreakBurst`); optional per-challenge best record (Daily-Challenge-style) per OQ.
- [ ] Large-pool selection UX for big regions (type-ahead / searchable list / map-click fallback) per OQ6/7.
- [ ] Entry points: Progress (family × region breakdown) + Play setup challenge card (+ optional Home chip).
- [x] EN/FR/DE strings (name, lock/unlock, progress, pass/flawless, badge); `messages.test.ts` parity green. *(stage ③a — `challenge.*` + `sessionType.challenge`)*
- [ ] Tests: domain (unlock predicate, full-region options, clear-the-board queue + recycle + finish,
      pass/flawless) with injected RNG/clock; component (lock→unlock, full pool, board clear,
      celebration); headless full-clear drive on a small region.
- [ ] Verified in the real app (headless Chrome) across ≥2 families + regions, EN/FR/DE.

## Technical notes
- **Separate the two pools (the key fix).** The *queue* of countries-still-to-clear shrinks (drives the
  progress bar + guarantees coverage); the *answer options* are the full region and **do not shrink**.
  Implement as: a fixed `answerPool` (all region ISO2s) reused every question, and a mutable
  work-queue that removes on clear and re-enqueues on miss. This keeps late-game questions as hard as
  early ones.
- **Reuse the launch plumbing, add a format.** Adding `'challenge'` to `SessionType` mirrors Phase 35's
  `'full'`. The engine already supports a bounded pool + `shouldFinish`; the new bits are "options =
  whole region" and "recycle on miss until the distinct-cleared set == region." A distinct-correct
  `Set` (already used by Phase 40's survival "region cleared" win) is the finish signal.
- **Unlock from existing mastery — no new store needed for gating.** The gate is a pure function of
  `computeFamilyMastery`'s result; nothing extra persists just to unlock. Only a *pass/flawless best*
  (if we keep one, OQ) needs storage — model it on `DailyResult` (a small record) or derive it from
  history `SessionRecord`s tagged with the challenge format (preferred: derive, like Blitz's PB and the
  mastery/recap rollups).
- **map-locate is already the unaided ideal.** For the Map family the challenge is essentially "locate
  every country in the region by clicking" — no option grid, snap grading already instant since
  Phase 37. Full-pool selection only matters for Flags/Capitals (pick a name/flag/capital from all).
- **Big pools need real UX thought.** A 54- or 195-item option grid is unusable as plain buttons.
  Prefer a **type-ahead search** (filter the region's names) or a scrollable list for large N, and/or
  cap the full-list mechanic to sub-regions while World/large regions lean on map-click or search
  (owner picks in OQ6/OQ7). Whatever we pick, the "no 4-choice crutch" property must hold.
- **Determinism for tests.** Inject `Rng` (and a clock if a timed variant lands) so the queue order,
  recycle behaviour, and finish condition are unit-testable exactly like the rest of the domain.
- **Badge monotonicity.** Continent / world badges are monotonic and were retargeted to fully-mastered
  in Phase 41. A capstone badge fits that model. A *decaying* "needs refresh" badge (OQ8) would be the
  first non-monotonic reward and needs its own small design (state, copy, re-earn) — hence flagged, not
  assumed.

## Open Questions — to resolve with the owner
1. **Flavor / strictness** — which shape?
   - **(Rec) Final Exam** — clear the whole region, full-pool options, misses recycle, certify at a
     small error budget; a flawless run earns the gold tier.
   - **The Gauntlet** — one life: a single miss ends the run; must clear all N in one perfect pass
     (purest "prove it", harshest on Africa 54 / World 195).
   - **Speed run** — clear-the-board against a timer / beat your personal best (adds fluency + replay).
   (Rec: **Final Exam** as the baseline; a timed variant can be a fast-follow.)
2. **Unlock gate** — gate on the **existing family × region mastery** (Phase 41 "both directions
   mastered") — Rec — or a looser gate ("played this family×region N times", or a `blended` % threshold)?
3. **Direction** — run **both** directions of the family interleaved (Rec — matches how mastery is
   defined) or a single chosen direction (closer to the literal "mode+region" ask)?
4. **Error budget / certify rule** — perfect run only, or allow misses (recycle) and certify at, e.g.,
   ≥95% first-try? And is the **flawless** (zero-miss) run a separate higher tier/badge? (Rec: allow
   misses to *finish*; certify at a high first-try bar; flawless = distinct gold tier.)
5. **Miss handling** — on a wrong pick, does the country **recycle to the back of the queue** (Rec) and
   must be cleared, or is it just marked missed and the run continues once through?
6. **Large-region option UX** — type-ahead **search box**, scrollable full grid, or restrict full-list
   to **sub-regions** (≤~25) and use map-click / search for big regions? (Rec: search box; map family
   uses click regardless.)
7. **World / whole-region scope** — is the challenge offered for **World (195)** at all, or capped at
   region / sub-region granularity? (Rec: offer region + sub-region; treat World as a later "grandmaster"
   tier if wanted.)
8. **Reward & retention** — a single capstone badge per family × region (monotonic, Rec), plus a
   flawless tier? And do we want **retention** (a "needs refresh" state that expires after N weeks and
   must be re-earned) — powerful but **breaks monotonic badges** and needs its own design (Rec: **defer**
   decay; ship monotonic capstone first)?
9. **Naming** — "Mastery Challenge" (owner's term), or **"Final Exam"**, **"Grandmaster Run"**,
   **"Capstone"**, **"Certification"**? (Rec: pick one; it drives the i18n keys + badge copy.)
10. **Timed / personal-best angle** — include a best-time or best-streak record (local, derived from
    history) now, or keep the MVP pure pass/fail? (Rec: MVP pass/fail; add timed variant as a fast-follow.)

## Acceptance criteria
- A family × region challenge is **locked** until that family × region is mastered (Phase 41), then
  becomes available with a clear entry point; locked entries explain how to unlock.
- Starting an unlocked challenge runs a **clear-the-board** session over the whole region: every country
  is asked, the **answer options are the full region and do not shrink**, a `cleared / total` bar
  advances, and (per OQ5) a missed country must still be cleared to finish.
- The run **finishes exactly when every country is cleared** (not on a fixed count); on finish the
  Summary shows the result and **certifies mastery**, with a distinct **flawless** celebration + badge
  when the run had zero misses.
- Any capstone badge is awarded correctly and **not revoked** (monotonic), consistent with Phase 41's
  continent/world badges.
- Large regions are actually playable (the chosen large-pool UX works for Africa 54 / World 195 within
  scope), and the "no 4-choice crutch" property holds throughout.
- Sound off → no cues; reduce-motion respected; **SR scheduling, mastery computation, and
  fixed/survival/full/training runs are unchanged**.
- EN/FR/DE parity holds; the pure unlock/options/queue/finish/grading logic is unit-tested with injected
  RNG (and clock if timed); fast loop green (`npm run test` / `check` / `lint`) + a headless full-clear
  drive of a small region.

## Progress log
- **2026-07-15 — Clarifying round resolved; domain build started (on explicit owner approval).**
  Open-question resolutions (owner picks):
  - **OQ1 (flavor/strictness) → The Gauntlet (one life).** A single miss ends the run; a clean
    sweep = pass. This settles **OQ5 (no recycle — one life)** and **OQ4 (no error budget — a perfect
    pass is required)**. Since every finish is flawless-by-definition, there is **one** capstone tier,
    not a separate gold tier.
  - **OQ3/OQ4 (direction) → both, interleaved** — matches Phase 41's "both directions ⇒ mastered".
    Each country is asked in both of the family's directions (2N question-slots).
  - **OQ6/OQ7 (large pools + World) → continents only; World excluded.** Only the 5 UN continents
    (Africa/Asia/Europe/Americas/Oceania) — no sub-region runs, no World (too long to complete). Runs
    are ~28 (Oceania) to ~108 (Africa) one-life questions. A type-ahead **search list** handles the
    1-of-N pick for name/capital directions; a searchable **flag grid** for country→flag; map-locate
    stays map-click.
  - **OQ2 (unlock gate) → existing Phase 41 mastery** — a family × continent is unlocked once that
    continent's family is fully mastered (both directions of every applicable country). Pure function
    of `computeFamilyMastery`; no new store to gate.
  - **OQ8 (reward/retention) → single monotonic capstone badge** per family × continent (3 × 5 = 15);
    **no decay** (defer — it would break the never-revoked invariant). A "Grand Slam: all 15" meta is a
    possible later add.
  - **OQ9 (naming) → "Grandmaster Run"** (internal `SessionType: 'challenge'`).
  - **OQ10 (timed/PB) → MVP pass/fail, no timer.** A timed variant is a possible fast-follow.

  **Domain layer landed** (`src/domain/challenge.ts` + `challenge.test.ts`): `'challenge'` added to
  `SessionType`; `isChallengeUnlocked(mastery, family, region)` (pure over `computeFamilyMastery`);
  `buildChallengeQueue` (2N both-direction, mode-eligible slots, shuffled via injected RNG);
  `buildChallengeQuestion` (fixed full-continent options that never shrink — `map-locate` gets none,
  `country-to-capital` gets attribute options); and a one-life `ChallengeSession` driver (clear-the-board,
  fail-fast on a miss, pass = clean sweep) — deterministic given injected `rng`/`now`, `QuizSession`
  left untouched.

  **Controller + persistence bridge landed** (`src/ui/stores/challenge.ts` + `challenge.test.ts`):
  a dedicated `challenge` store mirroring `play` (start / answer / advance / summary / reset) but
  driving `ChallengeSession` — kept **separate** so the normal `play`/`QuizSession` path is untouched;
  plus `challengeSessionSummary` (domain), which adapts a run's `ChallengeSummary` to a standard
  `SessionSummary` (`type: 'challenge'`, representative `mode`, `regionFilter`, the fatal miss as the
  lone `missed`) so a finished run persists through the **existing** `saveSession` → `SessionRecord`
  path with no persistence changes (feeding XP / stats / history automatically; `passed` recovered as
  `type==='challenge' && correct===total`). Handoff writables `lastChallengeSummary` / `pendingChallenge`
  added. Fast loop: **726 tests**, `check` 0/0, `lint` clean.

  **Decision (owner, 2026-07-15): a Grandmaster Run does NOT feed spaced-repetition.** It is a
  read-only *test* over mastery, not a training drill — so the stage-③ Play wiring records the finished
  run to **history** (for XP / badges / stats via `saveSession`) but must **not** call `recordAnswer`.
  This guarantees the single fatal miss can never create an SR lapse that demotes the very country/
  mastery the challenge required to unlock. (`SessionType: 'challenge'` records are already excluded
  from SR by construction — nothing writes SR for them once `recordAnswer` is skipped.)

  Still to do (stage ③+): the visual Play shell (full-region **search-list** + **flag-grid** pickers,
  `cleared/total` HUD, one-life feedback, pass/fail Summary) wired to `saveSession` **only** (no
  `recordAnswer`) on finish; entry points (Progress family × continent + a Play challenge card,
  locked→unlocked); the 15 monotonic capstone achievements; EN/FR/DE `challenge.*` copy; headless verify.
- **2026-07-15 — Stage ③ started; two remaining UI forks resolved with the owner.**
  - **Entry points → Progress only.** No Play-setup card / Home chip: the Grandmaster Run launches from
    the World Mastery breakdown, where a fully-mastered family × continent row's "prove it" launch
    replaces the practise shortcut. (Keeps `Play.svelte` untouched, matching the separate-store design.)
  - **Capstone reward → folded into the World Mastery panel** (not a separate badges grid), design
    **A + C** from a faithful glance-prototype (owner pick): *quiet in-place gilded cells* (a certified
    family bar gilds gold + crown) **plus** a *"Grandmaster · X/15" prestige counter* as the panel
    headline, gilding fully at 15/15. The 15 capstones live here, not in the achievements grid.
  - **Stage ③a landed** (i18n + rewards domain): `masteryFamilyOf(mode)` (`modes.ts`); the 15 monotonic
    `grandmaster-{family}-{continent}` capstones in `ACHIEVEMENTS` (`capstone`/`family` flags,
    `grandmasterId`, `GRANDMASTER_TOTAL = 15`), unlocked purely by a clean-sweep `type:'challenge'`
    `SessionRecord` for that family × continent (fail/quit never certify); a top-level `challenge.*`
    EN/FR/DE section (run name, prove-it/prestige, one-life HUD, search-list, pass/fail Summary, and a
    **composed** badge title/desc from existing family/region labels — no 90 hand-written strings) plus
    `sessionType.challenge`. Fast loop: **736 tests**, `check` 0/0, `lint` clean.

  Still to do (stages ③b–③e): the `/challenge` Play shell + `ChallengeSearchList` + finish wiring;
  the Summary pass/fail branch; the Progress A+C reward (prestige bar + gilded cells + prove-it launch);
  headless verify + PRD/status close-out.
- **2026-07-14 — PRD drafted** from an owner idea ("a mastery challenge that unlocks after you've
  mastered a mode+region: no 4 choices — the whole region is the pool — and each correct guess removes
  that country") plus a design discussion. Grounded in the current code: per-family mastery as the
  unlock signal (`computeFamilyMastery`, `regionFamilyPracticePool` — `src/domain/mastery.ts`), the
  additive session-format pattern (`SessionType`, `src/domain/types.ts:41`; Grand Tour `full` from
  Phase 35), the small-cap option/distractor path (`src/domain/questions.ts`), monotonic achievements
  (`src/domain/achievements.ts`), and the Daily-Challenge lifecycle precedent (`src/domain/daily.ts`).
  Captured the key design fix (queue shrinks, **options don't**, to avoid end-game elimination) and the
  mastery dimensions (both-directions, error budget, fluency, retention) as Open Questions. **NOT
  built** — awaiting the clarifying round (OQ1–OQ10) and explicit build approval.
