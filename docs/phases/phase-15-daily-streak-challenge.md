# Phase 15 — Daily streak & Daily Challenge

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
· **Track:** v1.2 retention & engagement

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Give the player a **reason to open the app every day**, using two lightweight, offline, backend-free
mechanics:

1. **Daily streak** — a consecutive-days-played counter shown on Home, with today's status
   ("played today ✓" vs "keep your streak going").
2. **Daily Challenge** — a **date-seeded** quiz that is the *same for that calendar day* every time
   it's opened, with a "done today" state once completed. A fresh, novel round each day.

## Current state (so scope is clear)
- **History rollup** (`computeStats`, `src/domain/stats.ts`) already buckets activity by calendar day:
  `byDay: { date: 'YYYY-MM-DD', sessions, questions, correct }`, and `dayKey(ts)` derives the day key.
  **Note:** `dayKey` uses **UTC** (`toISOString().slice(0,10)`). A user-facing "played today" streak
  probably wants the **local** day — see Open Questions.
- **Seedable RNG exists** (`src/domain/rng.ts`): `mulberry32(seed)` is deterministic, and
  `shuffle`/`sample`/`randomInt` take an `Rng`. A daily challenge just needs a stable integer seed
  derived from the date (e.g. hash of `YYYY-MM-DD`), then it flows through the existing
  question-generation / session machinery unchanged.
- **Sessions launch** via `pendingConfig` (`RunConfig`) + `push('/play')` (`src/ui/stores/game.ts`).
  `RunConfig` already accepts an injectable `rng` (used today only in tests) — the Daily Challenge is
  the first *production* use of a seeded RNG.
- **Gap:** there is no persisted "streak" and no record of whether the Daily Challenge is done today.
  Streak can be **derived** from `byDay`; "challenge done today" needs either a marker on the session
  record or a tiny persisted flag — see Open Questions.

## Depends on
Persistence + history (Phase 6) for the streak; SR/training (Phase 7) not required. Uses the seedable
RNG (Phase 2). Independent of Phases 14 and 16 (any order).

## Scope / Deliverables
### Daily streak
- [ ] **Streak computation (pure, unit-tested)** — a `src/domain/streak.ts` (or an addition to
      `stats.ts`) that, given the set of active day-keys and "today", returns `{ current, longest,
      playedToday }`. Consecutive-day logic with an explicit "today" injected (no `Date.now` in the
      pure fn), including the grace rule from Open Questions.
- [ ] **Streak display on Home** — a small, friendly indicator (flame/counter) showing the current
      streak and today's status; encourages finishing a round to keep it. Uses existing card/token
      styling; respects `prefers-reduced-motion` for any flourish.

### Daily Challenge
- [ ] **Date → seed** — a pure helper turning a `YYYY-MM-DD` string into a stable 32-bit seed for
      `mulberry32`, so the same day always yields the same challenge. Unit-tested (stable across
      calls; different days differ).
- [ ] **Challenge definition** — decide what the daily challenge *is* (mode, length, region theme) —
      fixed format or itself seeded/rotating (see Open Questions) — and build its `RunConfig` with the
      seeded `rng` so questions, order, and distractors are reproducible for the day.
- [ ] **Entry point + "done today" state** — a Daily Challenge card on Home that launches it and, once
      completed today, shows a completed state (and the day's result). Persist/derive completion per
      Open Questions.
- [ ] **i18n** — EN/FR strings for streak labels ("day streak", "played today", "keep it up") and the
      Daily Challenge (title, theme label, done state). Parity enforced by `messages.test.ts`.
- [ ] **Tests** — unit tests for streak logic (continues, breaks, longest, grace, timezone boundary)
      and the date→seed helper (determinism, reproducible challenge); a component test that the Home
      indicators render and the Daily Challenge stages a seeded `RunConfig` and flips to "done".

## Technical notes
- **Keep clocks out of pure code.** Streak and seed helpers take the date/day-key as an argument; the
  UI supplies it. This mirrors the repo's `now`/`rng` injection pattern and keeps tests deterministic
  (the codebase's workflow scripts even forbid `Date.now()` — the same discipline applies here).
- **Timezone:** `stats.dayKey` is UTC. For a habit streak, **local** calendar day is usually what the
  player expects. Introducing a local day-key means being explicit about it (and consistent between
  the streak and the challenge's date seed). Confirm with the owner.
- **"Done today" source of truth** — options: (a) **derive** from history by tagging the daily-challenge
  session (needs a marker; `SessionRecord` has no free-form field today), or (b) a **tiny persisted
  record** (e.g. a `dailyChallenge` singleton `{ date, completed, score }`), which also lets us show
  today's result and guard against replays. Option (b) likely needs a new object store or a reuse of
  the prefs pattern — decide with the owner. Reproducibility means a replay yields the same questions
  regardless.
- The Daily Challenge is a normal session; the only new thing is passing a **seeded `rng`** into
  `RunConfig`. No changes to the session engine are expected.

## Open Questions — to resolve with the owner
1. **Streak day basis** — **local** calendar day (recommended) or UTC (matches `dayKey` today)?
2. **Streak grace** — does a streak break at the first fully-missed day, or is there a 1-day grace /
   "freeze"? (Recommendation: strict — missing a day resets to 0; keep it honest and simple.)
3. **What counts toward a streak** — any finished session, or must the player answer ≥ N questions /
   finish the Daily Challenge? (Recommendation: any finished session.)
4. **Daily Challenge format** — fixed (e.g. `flag-to-country`, 10 questions, whole world), or a
   **rotating theme** seeded by the date (e.g. today = a random region, one of the four modes)?
   (Recommendation: seeded rotating theme — more novelty, same infra.)
5. **"Done today" storage** — derive-from-history (needs a session marker) vs a small persisted
   `dailyChallenge` record (enables showing today's score and preventing re-scoring)? What happens on
   replay — allowed for practice but not re-counted?
6. **Does the Daily Challenge feed SR/history** like any other session? (Recommendation: yes — it's
   real practice; it should update SR and appear in history.)
7. **Placement** on Home relative to Play and the Phase 14 "Next up" card (if that ships too).

## Acceptance criteria
- Home shows a current daily streak and today's status, computed from real play history, updating
  after a session without a manual reload.
- Streak logic is pure and unit-tested for continuation, breakage, longest, the agreed grace rule, and
  the day-boundary (timezone) case.
- A Daily Challenge is launchable, is **identical for a given calendar day** (seeded), shows a "done
  today" state after completion, and its date→seed helper is unit-tested for determinism.
- EN/FR parity holds (`messages.test.ts` green).
- All owner questions above are answered and reflected in the implementation.
- Fast loop green (`npm run test` / `npm run check` / `npm run lint`); manual browser check on 5180.

## Out of scope
- Push notifications / reminders to come back (not in this track).
- Leaderboards or sharing the daily result (Non-Goal: no social/online features).
- Streak "freezes" as a purchasable/earnable item — at most a simple grace rule if the owner wants one.

## Progress log
- **2026-07-08 — PRD drafted from the retention brainstorm (owner picked: daily streak + Daily
  Challenge). NOT built — awaiting the clarifying round and explicit build approval.**
