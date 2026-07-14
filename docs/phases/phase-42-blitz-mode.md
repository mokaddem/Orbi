# Phase 42 — Blitz mode (timed speed run + personal best)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
· **Track:** v2.6 — Momentum & progression

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Add a **time-pressure session format** — **Blitz** — that reframes the existing content as a fast,
addictive "one more run": a countdown clock, answer as many countries as you can before time runs
out, and beat your own **local personal best**. It reuses all eight existing modes and the current
score/streak HUD; the only new axis is *time*. This directly fills the one engagement gap the
codebase survey flagged — there is **no time-pressure / countdown format today** (only `fixed`,
`survival`, `full`, `training`, all count/lives/pool-bounded).

## The trigger (owner request — 2026-07-14)
From an engagement brainstorm ("what could we add to make the app more engaging? more animation,
sounds, game modes, other ideas?"), the owner picked **Blitz** (and Explorer rank/XP, Phase 43) off
the idea menu and asked for **a PRD each**. Blitz was pitched as: *a new session format with a
countdown clock — answer as many as you can in 60/90s, correct answers reuse the existing score/streak
HUD, and a local personal best gives self-competition without any backend.*

## Current state (so scope is clear)
- **`SessionType = 'fixed' | 'survival' | 'full' | 'training'`** (`src/domain/types.ts:41`). Adding
  `'blitz'` is the same kind of additive change Phase 35 made for `'full'` (Grand Tour).
- **Session engine** (`src/domain/session.ts`): a without-replacement draw bag, `shouldFinish()`
  (count / lives / pool-exhaustion), and an `answerCount` getter (added in Phase 35). Every existing
  finish condition is **count-based** — a **time-based** finish is genuinely new.
- **Per-answer timing already exists** (`answerMs` on `QuestionResult`) and feeds SR grading + the
  "avg time" stat + the "speedy" badge — but there is **no session-level clock**. The visual
  countdown bar in `Play.svelte` is the per-question auto-advance *dwell*, not a session timer.
- **Session-format UI** lives on the Play setup screen (`src/ui/routes/Play.svelte:485`) with format
  cards for Fixed / Survival / Grand Tour — the natural place for a Blitz card. Survival's
  "region cleared" win (`Play.svelte:594`) is a recent precedent for a new end condition.
- **Sound** (`src/ui/sound.ts`) is synthesized (Web Audio) for `correct`/`wrong`/`streak` with a
  single on/off pref (`src/data/persistence/types.ts:124`) — a soft "tick" / "time's-up" cue fits the
  synth approach with **no new audio files** (Phase 36/39 precedent). No volume slider.
- **Persistence** (`src/data/persistence/`): history is a `sessions` store of `SessionRecord`s
  carrying `total`/`correct`/`durationMs`/`mode`/`type`/`regionFilter`. Rollups like mastery and the
  weekly recap are **derived from this history** (no bespoke store) — the model a personal best should
  follow. Achievements added an IDB store at DB v3.
- **Gaps:** no session clock, no time-based finish, no bag refill (a small region's pool is exhausted
  before a 60s clock would end), no "personal best" concept, no blitz copy.

## In scope
- **New `SessionType: 'blitz'`** — a time-boxed session over the selected region + mode. The pure
  engine treats blitz as **uncapped with a refilling draw bag** (so the *clock*, never the pool, ends
  the run); the UI owns the clock and calls `finish()` at zero (see Technical notes for why time stays
  out of the engine).
- **Session clock** — a prominent visible countdown (default 60 s — confirm in OQ1). A low-time
  visual + aural cue in the final seconds. Optional time dynamics (correct = +time / wrong = penalty)
  per OQ2.
- **Blitz format card** on the Play setup screen (icon + hint, e.g. "Beat the clock · 60 s"), sitting
  beside Fixed / Survival / Grand Tour.
- **Personal best** per (mode × region [× sub-region]) — **derived from history** (recommended, OQ4),
  surfaced on the setup card ("Best: 23"), and celebrated in the Summary on a new best.
- **Blitz Summary** — score, correct / answered, best in-run streak, and a **new-personal-best**
  celebration reusing the existing `finish`/`perfect` jingle + `StreakBurst`.
- **Sound** — a gentle synthesized per-second tick in the final ~5 s + a distinct "time's-up" cue,
  gated by the existing sound pref; reduce-motion / sound-off respected. **No new audio files.**
- **i18n EN/FR/DE** — `sessionType.blitz`, setup hint, clock / "Time's up!" / personal-best labels;
  parity test (`messages.test.ts`) stays green.
- **Tests** — pure timer/finish/bag-refill logic and history-derived personal-best computation
  (deterministic, injected clock); component (clock counts down, time's-up ends the run, PB surfaces);
  a headless real-app drive of a full blitz run.

## Out of scope (deliberately)
- **Online / global leaderboards** — Non-Goal (no backend, no social). Personal best is **local only**.
- **No new game mode** — Blitz reuses the existing eight modes; it is a *format*, like Grand Tour.
- No change to `fixed` / `survival` / `full` / `training` finish logic, SR scheduling, mastery, or the
  region picker.
- Daily Challenge stays `fixed`; recommendations and Targeted Practice keep their formats (a blitz
  entry point there is possible **future work**).
- No volume slider, no in-run difficulty selector.

## Depends on
Phase 2 (core quiz engine — `SessionType`, draw bag, `shouldFinish`), Phase 35 (the session-format
precedent — `full` was added the same way, incl. `answerCount`), Phase 6 (history persistence — the
source for a **derived** personal best). Phase 36 for the synthesized clock cues. Independent of
Phase 43 (Explorer rank); if built first, blitz `SessionRecord`s feed XP automatically.

## Deliverables checklist
- [ ] `SessionType` extended with `'blitz'`; engine treats blitz as uncapped with a **refilling**
      draw bag (reshuffle + continue when the pool is exhausted) so only the clock ends the run.
- [ ] UI-owned session clock (default 60 s) driven off `performance.now()` deltas; calls `finish()`
      at zero; a low-time visual + synthesized aural cue.
- [ ] Blitz **format card** on the Play setup screen (icon + region-reactive hint).
- [ ] `computeBlitzBest(sessions, {mode, region, subregion})` pure helper (history-derived PB) +
      surfacing on the setup card and in the Summary; new-best celebration (existing jingle + burst).
- [ ] Blitz-specific Summary (score / correct / answered / best streak / new-PB banner).
- [ ] Synthesized tick + time's-up cues in `sound.ts`, gated by the sound pref; reduce-motion aware.
- [ ] EN/FR/DE strings (`sessionType.blitz`, clock / time's-up / personal-best copy); parity green.
- [ ] Tests: domain (time-based finish via injected clock, bag refill/loop, PB from history) +
      component (clock countdown, time's-up ends run, PB display) + headless full-run verify.
- [ ] Verified in the real app (headless Chrome) across a couple of modes + regions, EN/FR/DE.

## Technical notes
- **Keep time out of the pure engine.** The domain is deterministic and count-based today; per-answer
  time is measured in the *UI*, not the engine. Recommend the UI own a `performance.now()`-based clock
  and call `finish()` at zero, with the engine's only blitz change being "uncapped run + refilling
  bag." (Alternative: give the session a `deadlineAt` + injected `now` — more invasive, and pushes
  wall-clock into the pure layer. Prefer the UI-owned clock.)
- **Draw-bag refill is required.** A 60 s blitz on a 10-country sub-region would exhaust the
  without-replacement bag long before the clock. Blitz must **reshuffle and continue** (effectively
  draw-with-replacement across reshuffles) behind the `blitz` branch, so the clock is the sole end
  condition. Avoid repeating the just-answered country back-to-back across a reshuffle boundary.
- **Personal best, derived from history (recommended).** `computeBlitzBest` = max score (or `correct`)
  among matching blitz `SessionRecord`s — a pure function over already-persisted history, needing
  **no new store**, offline, and consistent with how mastery/recap derive from history. If a *points*
  score (not raw `correct`) is introduced, persist it on the `SessionRecord` (or map it onto
  `correct`).
- **Clock accuracy & determinism.** Drive the display off elapsed `performance.now()` deltas (not
  tick counting) so it stays honest under jank; **inject the clock** into any testable helper for
  deterministic tests (same pattern as `now`-injected mastery/recap/streak).
- **HUD / advance cadence.** Reuse the score + streak HUD; add a prominent session clock and make sure
  it doesn't fight the existing per-question dwell bar. Blitz likely wants to **advance immediately on
  answer** (minimal dwell) to reward speed — confirm in OQ5.
- **Sound is synthesized** (a quiet tick + a "time's-up" cue), authored gently (no volume slider;
  Phase 36/39 precedent). Zero new bytes, nothing extra to precache — offline-safe by construction.

## Open Questions — to resolve with the owner
1. **Clock duration** — fixed 60 s, or a choice (30 / 60 / 90)? (Rec: fixed **60 s** for MVP; promote
   to a pref later if wanted.)
2. **Time dynamics** — flat countdown, or **correct = +time bonus** and/or **wrong = −time**? (Rec:
   flat countdown for MVP; optionally a small **+1 s** on correct as juice; **no** wrong-penalty to
   keep it friendly.)
3. **Scoring** — raw **correct count** as the score, or a **points** score with a streak/speed
   multiplier? (Rec: MVP = correct count for clarity and reuse; add a combo multiplier as a
   fast-follow only if the run feels flat.)
4. **Personal-best scope & storage** — best per (mode × region), also × sub-region, or one global
   best? Derive from history or persist explicitly? (Rec: **derive from history**; key by
   mode + region, and by sub-region when one is selected.)
5. **Between-question cadence** — does the clock keep running during the answer reveal, and does blitz
   **auto-advance immediately** on answer (vs the current dwell)? (Rec: clock runs continuously;
   advance immediately/near-immediately to reward speed.)
6. **Where the PB shows** — setup card + Summary only, or also a Home/Progress chip? (Rec: setup card
   + Summary for MVP; a Home "Blitz best" chip is optional.)
7. **Blitz achievements** — add any (e.g. "answer 20 in a Blitz", "Blitz PB ≥ 30")? (Rec: 1–2 light
   ones, or defer to Phase 43's rank/XP work.)
8. **Which modes** — all eight, or restrict (does `map-locate` feel right under a clock)? (Rec: allow
   **all eight** — `map-locate` grades instantly since Phase 37, so it fits.)

## Acceptance criteria
- Selecting **Blitz** + a region + a mode and pressing Start runs a time-boxed session; a visible
  clock counts down; the run ends **exactly when the clock hits zero** (not on pool exhaustion — the
  pool reshuffles and continues).
- Score / correct is tracked live; on finish the Summary shows the result and **celebrates a new
  personal best** when beaten (existing jingle + burst).
- The personal best is correct — it reflects the best matching blitz result from real history and
  updates after a better run.
- Sound **off** → no tick / no time's-up; **reduce-motion** respected; scoring / SR / history and all
  other formats unchanged.
- EN/FR/DE parity holds; the pure timer/finish/bag-refill/PB logic is unit-tested with a deterministic
  injected clock; fast loop green (`npm run test` / `check` / `lint`) + a headless real-app drive of a
  full blitz run.

## Progress log
- **2026-07-14 — PRD drafted** from the engagement brainstorm (owner picked Blitz + Explorer rank/XP
  off the idea menu and asked for a PRD each). Grounded in the current code: `SessionType`
  (`src/domain/types.ts:41`), the session-format pattern from Phase 35 (`full` + `answerCount`),
  history-derived rollups (mastery / recap) as the model for a personal best, and the synthesized
  sound service (Phase 36/39). Confirmed no backend needed and no new game mode. **NOT built** —
  awaiting the clarifying round (OQ1–OQ8) and explicit build approval.
