# Phase 7 — Spaced repetition & training

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%

## Goal
Make the app adaptive: update per-item spaced-repetition state (SM-2) as the player answers,
and build a **"train my mistakes"** session that focuses on the weakest/due items. This is
the core teaching feature from the spec.

## Depends on
Phases 2 (engine) and 6 (persistence, `srItems` store).

## Scope / Deliverables
- [x] **SM-2 scheduler** (pure, tested): map a `QuestionResult` (correct/incorrect, optionally
      speed) to a quality grade, and update `repetitions`, `easeFactor`, `intervalDays`,
      `dueAt`, and `lapses`. — `src/domain/sr.ts`
- [x] **Hook into the session engine** so every answered question updates the `SRItem` for its
      `itemKey` (`mode:iso2`) and persists it. — `game.answer()` returns the `QuestionResult`;
      `Play.svelte` feeds it to `recordAnswer()` (serialized SR writes in the persistence store).
- [x] **Training session builder:** select items that are **due** and/or have the most
      **lapses**, prioritizing the weakest, and assemble a `training` session from them.
      — `src/domain/training.ts` (`selectTrainingItems`, `dominantTrainingMode`) + an explicit
      `answerPool` on `QuizSession`.
- [x] **Training mode UI**: an entry point on Home, plus wiring the Summary screen's
      **"Train these"** shortcut (stubbed in Phase 3) to a training session over the just-missed
      items.
- [x] **Unit tests** for SM-2 state transitions and training-selection ordering (plus
      persistence-wiring and Home/Summary component tests).

## Technical notes
- Grade mapping suggestion: incorrect → low grade (reset repetitions, increment lapses);
  correct → grade scaled by speed. Keep it simple and documented.
- The spec's motivating example — repeatedly confusing Bulgaria/Romania — should emerge
  naturally: those items accrue lapses, become due quickly, and dominate training. Verify.

## Acceptance criteria
- Missed items resurface sooner (asserted by SM-2 unit tests and confirmed by manual play). ✅
  A wrong answer resets the item to **due now** (interval 0) and increments `lapses`, while a
  correct answer schedules it 1 → 6 → ×EF days out — so missed items always sort ahead.
- Training builds a session focused on due/high-lapse items; the "Train these" shortcut works. ✅
- SR state persists and reloads correctly. ✅ (stored in the existing `srItems` IndexedDB store,
  round-tripped by the persistence contract tests).

## Out of scope
- i18n polish (Phase 8), PWA (Phase 9).

## Progress log
- **2026-07-07 — Phase complete (100%).**
  - **SM-2 scheduler** — `src/domain/sr.ts`: `gradeAnswer` (wrong → 0; correct scaled by speed
    to 3/4/5) + `scheduleNext` implementing classic SM-2, with one deliberate tweak for a
    session-based (non-daily-review) app: a lapse sets the item **due immediately** (interval 0)
    rather than +1 day, so mistakes resurface within training right away. Ease floored at 1.3.
  - **Training selection** — `src/domain/training.ts`: `selectTrainingItems` returns due-or-lapsed
    items ordered weakest-first (due → lapses → overdue → lower ease → key), with optional
    `mode`/`limit`/`dueOnly`; `dominantTrainingMode` picks the mode to run when training globally.
  - **Session engine** — added an explicit `answerPool` to `QuizSession`/`SessionConfig`: a
    training session asks only about the weak countries while tiering distractors against the
    whole world. `training` sessions use the fixed-length end condition and the progress-bar HUD.
  - **Wiring** — `game.answer()` now returns the `QuestionResult`; `Play.svelte` feeds every
    answer to `recordAnswer()` in the persistence store, which serializes SR read-modify-write so
    concurrent answers on the same item don't lose updates. Added `loadTrainingItems` /
    `loadTrainingPlan`.
  - **UI** — Summary's **"Train these"** now starts a `training` session over the just-missed
    items (disabled when nothing was missed); Home gained a **"Train my mistakes (N)"** entry that
    builds a plan from persisted SR state (disabled with a hint when empty). Retry of a training
    session re-drills the same countries. EN/FR strings added.
  - **Verification** — `npm run test` 190 passing (22 files; new: `sr.test.ts`, `training.test.ts`,
    `Summary.test.ts`, `Home.test.ts`, plus session/game/persistence additions), `npm run check`
    0 errors, `npm run lint` clean, `npm run build` OK, dev-server (5180) smoke check OK.
    Playwright E2E not run — the repo has no Playwright setup yet (deferred to Phase 10 QA).
