# Phase 15 — Daily streak & Daily Challenge

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
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
- [x] **Streak computation (pure, unit-tested)** — `src/domain/streak.ts`: `computeStreak(dayKeys,
      todayKey)` returns `{ current, longest, playedToday }` from day-key strings (no `Date.now` in the
      pure fn; day math via `Date.UTC` on the parsed calendar date, TZ-independent). Strict grace
      (miss a day → reset). `localDayKey(ts)` derives the player's **local** day-key.
- [x] **Streak display on Home** — `StreakIndicator.svelte`: a compact flame pill showing the current
      streak and today's status ("played today ✓" / "keep it going" / "start a streak"). Card/token
      styling; the flame's idle pulse is dropped under `prefers-reduced-motion`.

### Daily Challenge
- [x] **Date → seed** — `dailySeed(dateKey)` in `src/domain/daily.ts`: FNV-1a hash → stable 32-bit
      seed for `mulberry32`. Unit-tested (stable across calls; consecutive days differ).
- [x] **Challenge definition** — `buildDailyChallenge(dateKey)`: **seeded rotating theme** — the seed
      picks the mode (of 4) and region theme (World or one of the 5 M49 regions). Fixed length 10 /
      4 choices (constants, not prefs) so the day's challenge is identical for everyone. `dailyToConfig`
      turns it into a `RunConfig` with a seeded `rng`, making questions/order/distractors reproducible.
- [x] **Entry point + "done today" state** — `DailyChallengeCard.svelte` on Home launches it and, once
      completed today, shows "Done for today ✓" + the score, plus a low-key "Play again". Completion is
      a **persisted `DailyResult` singleton** (`{date, completed, total, correct, mode}`) in a new
      `dailyChallenge` IDB store (DB v1→v2 migration); "done" = its date is today's local day-key.
- [x] **i18n** — EN/FR strings for streak (`home.streak.*`) and the Daily Challenge (`daily.*`).
      Parity enforced by `messages.test.ts` (green).
- [x] **Tests** — `streak.test.ts` (continues, breaks, longest, strict grace, month/year boundary,
      `localDayKey`), `daily.test.ts` (seed determinism, reproducible & day-varying challenge, valid
      themes), store contract round-trip for `DailyResult`, `StreakIndicator`/`DailyChallengeCard`
      component tests (render + stages a seeded `RunConfig` + flips to "done"), and a Home test asserting
      both indicators render. Plus a `summaryToRecord` regression test (region filter is plain-copied).

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

## Open Questions — resolved with the owner (2026-07-08)
1. **Streak day basis** — ✅ **Local** calendar day. `localDayKey` derives it; History's UTC `dayKey`
   is left untouched.
2. **Streak grace** — ✅ **Strict** (no freeze): a fully-missed day resets the streak to 0. The current
   run anchors at today (if played) else yesterday, so it isn't shown as broken mid-day.
3. **What counts toward a streak** — ✅ **Any finished session** (matches History's day buckets).
4. **Daily Challenge format** — ✅ **Seeded rotating theme**: the date seed picks the mode (of 4) and a
   region theme (World or one of the 5 M49 regions). Length 10 / 4 choices are fixed constants.
5. **"Done today" storage** — ✅ **Small persisted `DailyResult` singleton** (new `dailyChallenge` IDB
   store, DB v2). "Done today" = its date equals today's local day-key. **Replay** is allowed as
   practice; it overwrites the stored result (latest score) but never un-completes the day, and — being
   a normal session — still feeds SR + history each time.
6. **Does the Daily Challenge feed SR/history** — ✅ **Yes.** It's a normal session: `recordAnswer`
   updates SM-2 per question and `saveSession` writes it to history (verified: after the daily, the
   "Next up" card surfaced the missed items and "Train all my mistakes" appeared).
7. **Placement** — ✅ Compact streak pill under the tagline; Daily Challenge card directly below the
   Phase 14 "Next up" card.

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
- **2026-07-08 — Clarifying round done (answers recorded above: local day, any-finished-session,
  seeded rotating theme, persisted `DailyResult`, strict grace, feeds SR/history) and owner gave an
  explicit "go". Implemented and marked ✅ Done:**
  - **Pure domain:** `streak.ts` (`localDayKey`, `computeStreak`) and `daily.ts` (`dailySeed`,
    `buildDailyChallenge`, `DAILY_LENGTH`/`DAILY_CHOICES`), exported from `domain/index.ts`.
  - **Persistence:** `DailyResult` type + `getDailyResult`/`saveDailyResult`/`clearDailyResult` on the
    `QuizStore` port; new `dailyChallenge` IDB object store with **DB_VERSION 1→2** migration (existing
    stores preserved); memory-store parity; contract round-trip test. `clearHistory` also clears the
    daily result so the streak and "done today" stay coherent.
  - **Wiring:** `RunConfig.dailyDate` + `dailyToConfig` (seeded `rng`); `loadStreak`/`loadDailyState`/
    `saveDailyResult` in the persistence controller; `Play.svelte` records the `DailyResult` on finish.
  - **UI:** `StreakIndicator` + `DailyChallengeCard` on Home (recompute on mount → refresh after a
    session with no manual reload); EN/FR strings.
  - **Bug found & fixed during verification:** daily/recommendation configs carry a filter sourced from
    a Svelte `$state` proxy; IndexedDB's structured clone rejected it (`DataCloneError`), silently
    dropping the session (so the streak never advanced). Fixed at the persistence choke point —
    `summaryToRecord` now plain-copies `regionFilter` — which also fixes the same latent bug for Phase
    14 weak-spot sessions. Guarded by a regression test.
  - **Verification:** `npm run test` (271), `npm run check`, `npm run lint` all green; manual
    end-to-end browser check on 5180 (Home empty → play today's daily map-locate/Africa → streak flips
    to "1-day streak · Played today ✓", card shows "Done for today ✓ · 8/10", SR/history fed; EN + FR).
