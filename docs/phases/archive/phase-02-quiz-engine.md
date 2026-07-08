# Phase 2 — Core quiz engine

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%

## Goal
Implement the pure, framework-agnostic domain logic that generates questions, checks answers,
scores, and drives a play session. This is the testable heart of the app — no UI, no storage.

## Depends on
Phase 1 (data layer).

## Scope / Deliverables
- [x] **Question generator** for all four modes (`flag-to-country`, `country-to-flag`,
      `map-highlight`, `map-locate`) given a country pool and an optional region filter.
- [x] **Region-aware distractor selection:** default **4** options; draw distractors
      preferentially from the same **sub-region**, then region, then world; never duplicate;
      always include the correct answer. (map-locate has no options — the whole map is input.)
- [x] **Answer checking** and **scoring** (correct count, accuracy, streak).
- [x] **Session engine** as a state machine supporting:
  - `fixed` — N questions then end (default N = 10).
  - `survival` — continue until X mistakes (default X = 3 lives).
  - Per-question **timing** and overall duration; `next()`, `submit(answer)`, end detection,
    and a **summary** (score, accuracy, time, list of missed items).
- [x] **Unit tests** covering distractor rules (no dupes, filter honored, answer present),
      fixed vs. survival end conditions, scoring, and timing capture.

## Technical notes
- Keep everything deterministic-testable: inject the RNG (seedable) so distractor selection
  can be asserted in tests. (Note: `Math.random` is fine at runtime; just make it injectable.)
- Emit `QuestionResult` objects (`itemKey`, `countryIso2`, `correct`, `answerMs`) so Phases
  6 and 7 can persist history and update SR state without reshaping data.
- No DOM/Svelte imports in this layer.

## Acceptance criteria
- All unit tests pass.
- Generator honors the region filter and the distractor rules for every mode.
- Fixed and survival end conditions behave correctly; per-question time is captured.

## Out of scope
- Rendering (Phases 3–4), persistence (Phase 6), SR scheduling (Phase 7).

## Progress log
- **2026-07-06** — Implemented the pure domain layer; all deliverables and acceptance
  criteria met. No UI or storage touched (those are Phases 3–4 / 6–7).
  - **Modules (`src/domain/`, all framework-free):**
    - `types.ts` — `GameMode`, `SessionType`, `RegionFilter`, `Question`, `QuestionResult`
      (the persistence/SR bridge, shaped exactly as `main_PRD.md`), `SessionStatus`,
      `SessionState`, `SessionSummary`.
    - `rng.ts` — injectable `Rng` (`() => number`) with a seedable `mulberry32` for
      deterministic tests; `defaultRng = Math.random` at runtime; `shuffle`/`sample`/
      `randomInt` helpers (Fisher–Yates, non-mutating).
    - `questions.ts` — `filterCountries`, tiered `selectDistractors` (same sub-region →
      rest of region → rest of world; disjoint tiers ⇒ no dupes, answer excluded),
      `buildQuestion` (adds the answer + shuffles for option modes; no options for
      `map-locate`), `drawAnswerSequence` (shuffle-with-reshuffle, no back-to-back repeat
      across the bag boundary), batch `generateQuestions`, and `checkAnswer` (accepts a
      `Country`, alpha-2/alpha-3 string, or `null` = no answer).
    - `session.ts` — `QuizSession` state machine: `next()` / `submit()` / `summary()`,
      injected `rng` + `now` (clock), `fixed` (default 10) and `survival` (default 3 lives)
      end conditions, streak/best-streak, per-question `answerMs`, overall `durationMs`,
      and de-duplicated missed-country list. `createSession` factory mirrors the data
      layer's functional style. `index.ts` re-exports the public API.
  - **Design decisions / deviations:**
    - **Distractor scope.** The `filter` narrows only which countries are *asked*; distractors
      always tier against the **full** country list so a tiny sub-region filter can still fall
      back to region/world for a 4th option. Net effect: a region filter keeps every option
      inside the region (region tier fills first); a small sub-region filter keeps answers in
      the sub-region but options may spill outward — both verified by test.
    - **RNG injection** as specified — seedable in tests, `Math.random` at runtime.
    - **Clock injection** (`now`) added so timing is asserted deterministically; not called
      out in the PRD but needed to test the timing deliverable.
    - `training` is present in the `SessionType` union but not implemented here — it depends
      on SR state (Phase 7); the engine handles `fixed` + `survival` as scoped.
    - Constructing a session whose pool is empty after filtering **throws** (a caller bug),
      rather than silently producing a zero-question session.
  - **Tests (52 new, 77 total, all passing):** `rng.test.ts` (determinism, ranges, non-mutating
    shuffle/sample), `questions.test.ts` (tiered distractor rules incl. region→world fallback,
    no dupes/answer-present across 20 seeds, per-mode option counts, filter honored for answers,
    option spill behaviour, `checkAnswer` inputs — plus a real-dataset integration check that
    every European question and its options stay in Europe for all option modes), `session.test.ts`
    (idle→active→finished flow, fixed/survival end conditions incl. survival not ending on pool
    exhaustion, scoring/streaks, per-question + overall timing via injected clock, summary
    contents, and misuse guards).
  - **Verification:** `npm run test` (77 pass) · `npm run check` (0 errors) · `npm run lint`
    (clean, after `npm run format`). No browser/E2E: this phase adds no UI to drive (consistent
    with Phase 1); Playwright is introduced with the UI in Phases 3–4.
