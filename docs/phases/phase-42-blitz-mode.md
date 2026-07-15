# Phase 42 — Blitz mode (timed speed run + personal best)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
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
  surfaced on the setup card ("Best: 23"), celebrated in the Summary on a new best, and listed on the
  **Progress page** ("Blitz best" panel, top score per slot — the OQ6 chip, built as a panel).
- **Blitz Summary** — score, correct / answered, best in-run streak, and a **new-personal-best**
  celebration reusing the existing `finish`/`perfect` jingle + `StreakBurst`.
- **Decoupled from spaced-repetition** (owner decision, 2026-07-15) — Blitz **never writes SR
  state**, so a mistap under time pressure can't demote mastery (and fast correct taps can't inflate
  it). It still writes a `SessionRecord` (history + personal best); other formats are unchanged.
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
- [x] `SessionType` extended with `'blitz'`; engine treats blitz as uncapped with a **refilling**
      draw bag (the existing `drawAnswer` reshuffle+no-repeat already refills; blitz's `shouldFinish`
      just returns `false`) so only the clock ends the run — via a new public `QuizSession.end()`.
- [x] UI-owned session clock (starts 60 s, +1 s per correct, **capped at 90 s**) driven off
      `performance.now()` deltas; calls `play.endBlitz()` at zero; a low-time visual + synth tick.
- [x] Blitz **format card** on the Play setup screen (flame icon + hint / "Best: N"); the mode
      picker restricts to the five allowed quick-tap modes when Blitz is selected.
- [x] `computeBlitzBest(sessions, {mode, region, subregion})` pure helper (history-derived PB, keyed
      by slot) + surfacing on the setup card and in the Summary; new-best celebration (jingle + burst).
- [x] Blitz-specific Summary (points headline / score / accuracy / time / best streak / new-PB banner).
- [x] Synthesized `tick` + `timesup` cues in `sound.ts`, gated by the sound pref; reduce-motion aware
      (final-seconds pulse neutralised by the app-wide `data-reduce-motion` rule).
- [x] EN/FR/DE strings (`sessionType.blitz`, `play.blitz.*` clock/points/combo, setup + summary copy);
      parity green.
- [x] Tests: domain (`blitz.test.ts` — combo/points/run-seconds/remaining/PB-slot matching; session
      never-finishes + `end()`), store (`endBlitz` finishes; advance never does), component
      (`Summary.test.ts` — PB display + new-best banner) + headless full-run verify.
- [x] Verified in the real app (headless Chrome): setup card + mode restriction, live clock (+1 s,
      90 s cap), points/combo HUD, low-time state, finish → Summary → new-PB then standing-PB.

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
- **2026-07-15 — Owner follow-up: slow answers *decay* the combo by tier, they don't reset it.**
  Refines the entry below: resetting a slow-but-correct answer all the way to ×1 was too punishing —
  being right-but-slow should beat a rushed wrong guess, not tie it. Now a **wrong answer still wipes to
  ×1**, but sitting on a question **drops one combo tier per reaction window** (`BLITZ_COMBO_TIME_MS`,
  **2.3 s**) elapsed, floored at ×1 — so 5 s of dithering costs two tiers, not the whole combo, and the
  answer scores at the decayed tier. Domain: `replayCombo` climbs on a fast correct and demotes
  `blitzTiersLost(answerMs)` tiers on a slow one (landing at the foot of the new tier); new pure
  `blitzTiersLost` + `blitzDecayedCombo` helpers drive both scoring and the live HUD. The **reaction
  meter** now restarts each tier (drains → refills as a tier drops) and hides at ×1; the badge ticks
  down live x5→…→x1 as you wait. Tests reworked (tier decay, multi-tier, floor, rebuild); headless-Chrome
  drive confirmed the badge stepping down one tier per ~2.3 s with the meter refilling each tier.
- **2026-07-15 — Owner follow-up: the combo now also breaks on a slow answer.** Beyond a wrong
  answer, the combo resets to ×1 if the player **takes too long to pick** — a per-answer *reaction
  window* (`BLITZ_COMBO_TIME_MS`, **2.3 s** — owner: "faster is better" — measured from when the question
  is shown via the result's `answerMs`). A correct-but-slow tap still scores, but at ×1 (it *restarts*
  the combo). The scoring is authoritative in the domain: `computeBlitzPoints`/`blitzComboStreak` share
  a `replayCombo` that only extends the streak on a *fast* correct. The HUD shows this **live** two
  ways: a slim **reaction meter** (a reverse-progress bar under the badge) drains over the window and
  flushes red near empty, and the badge itself drops to ×1 the moment the window lapses (`comboExpired`
  off the UI-owned per-question timer) — so hesitation is felt, not just penalised on submit. Tests
  added; headless-Chrome drive confirmed the meter draining, the badge dropping to ×1 mid-question, and
  the slow tap scoring ×1.
- **2026-07-15 — Owner follow-up: Blitz combo made the centrepiece (UI + sound).** Four tweaks
  requested after review, all Blitz-only: (1) the **streak pill is hidden in Blitz** — redundant with
  the multiplier; (2) the **multiplier badge is redesigned** — always shown, larger, with a per-tier
  heat ramp (teal outline at ×1 → filled gold → hot coral), a growing glow and a pop on each step-up
  (`blitzComboStyle` + `comboPulse` in `Play.svelte`); (3) a **dedicated `blitz` synth cue** in
  `sound.ts` that escalates with the *live multiplier* replaces the shared `streak` celebration inside
  Blitz (no milestone burst in Blitz); (4) the **combo now climbs to ×5** — `blitzCombo` gains a band
  (x4 @ streak 7–8, **x5 @ 9+**), `BLITZ_MAX_COMBO = 5`. This **supersedes the x4 cap** recorded in
  OQ3 below. Tests updated (`blitz.test.ts`), `test`/`check`/`lint` green, headless-Chrome drive
  confirmed the badge escalating ×1→×5 with the streak pill gone and points correct (streak 9 = 2,500).
- **2026-07-15 — Owner follow-up: "Blitz best" now on the Progress page.** The OQ6 optional
  Home/Progress chip is built as a **Progress panel** ("Blitz best" / "Records Blitz" /
  "Blitz-Rekorde"): a new pure `computeBlitzBests(sessions)` returns the top score per
  (mode × region × sub-region) slot, sorted desc; Progress renders them as a list (mode glyph +
  localized mode/region label + points), top row emphasised. Reuses the history already loaded
  there — no new loader. Tested (`blitz.test.ts`) + headless-screenshot verified (EN/FR).
- **2026-07-15 — Owner follow-up: Blitz is decoupled from spaced-repetition.** A mistap under time
  pressure must not demote a country's mastery, so (owner decision) Blitz **never writes SR state at
  all** — neither a wrong answer (no demotion) nor a correct one (no promotion; this also stops fast
  correct taps inflating mastery, since SM-2 has no same-run guard). Implemented in `Play.svelte`
  via a `recordSR()` gate that skips `recordAnswer` when `config.type === 'blitz'` (the three answer
  paths route through it). Mastery is derived purely from SR items, so this fully protects it; Blitz
  still writes its `SessionRecord` (for history + the personal best) and other formats are unchanged.
- **2026-07-15 — ✅ Built, tested & verified.** Implemented per the decisions below.
  - **Domain:** `SessionType += 'blitz'`; `QuizSession.shouldFinish()` returns `false` for blitz
    (the existing `drawAnswer` reshuffle already refills a small pool with no back-to-back repeat)
    and a new public `end()` drops any pending question. New pure `src/domain/blitz.ts`:
    `blitzCombo` (x1/x2/x3/x4), `computeBlitzPoints` (replays the streak), `blitzRunSeconds`
    (60 + correct, cap 90), `blitzRemainingMs`, and `computeBlitzBest` + `blitzSlotMatches`
    (history-derived PB keyed by mode × region × sub-region). Exported from the domain barrel.
  - **Persistence:** optional `points?` cached on blitz `SessionRecord`s (`summaryToRecord`);
    `computeBlitzBest` falls back to replaying `questions` when absent.
  - **UI:** `play.endBlitz()` store action + `lastBlitzResult` handoff store. Play setup gains the
    Blitz card (best via `computeBlitzBest`) and restricts the family/direction picker to the five
    allowed modes (`selectType` snaps to Flags→Flag-Country off an excluded mode). In-run: a UI-owned
    `performance.now()` clock (interval), a 90 s-scaled time bar with a 60 s start tick + MAX cap
    label + low-time state, points + live combo chip in the HUD, near-instant auto-advance
    (`BLITZ_DWELL_MS`), and the per-question dwell bar hidden. Summary shows a points hero + PB line
    or the "New personal best!" banner with a `StreakBurst`.
  - **Sound:** synth `tick` (final-5 s heartbeat) + `timesup` (descending fall), gated by the sound
    pref; the jingle (`perfect` on a new best, else `finish`) plays a beat after time's-up.
  - **i18n:** `sessionType.blitz`, `play.setup.blitz*`, `play.blitz.*`, `summary.points/personalBest/
    newBest` in EN/FR/DE; parity test green.
  - **Verification:** `npm run test` (641 pass, 66 files), `check`, `lint` all green. Headless-Chrome drive of
    two real runs on 5180 confirmed: mode restriction (map=highlight only, no Extra family), the
    live clock extending +1 s/correct (64 s mid-run), 1,200 pts ×3 combo HUD, low-time state, and
    finish → Summary showing "New personal best!" (2,400 pts, 1:09) then a weaker replay showing the
    standing "Personal best: 2,400" — with the setup card then reading "Best: 2,400". No console errors.
  - **Out of MVP (as scoped):** no achievements (OQ7 → Phase 43), no leaderboard, no volume slider.
- **2026-07-15 — Clarified & approved; implementation started.** Owner answers to OQ1–OQ8:
  - **OQ1 Clock:** fixed **60 s** start.
  - **OQ2 Time dynamics:** **+1 s on each correct**, no wrong-penalty. **NEW: hard cap** — a run
    never exceeds **90 s** total (deadline = start + `min(60 + correctCount, 90)` s; earned time
    stops mattering after ~30 correct). UI shows **both** remaining time and the 90 s cap.
  - **OQ3 Scoring:** **points** (not raw count). Base **100** per correct × a **streak combo**
    multiplier: x1 @ streak 1–2, x2 @ 3–4, x3 @ 5–6, x4 @ 7+ (cap); a wrong answer resets the combo
    to x1. → persist a `points` field on the blitz `SessionRecord`.
  - **OQ4 Personal best:** **derive from history** (no new store); best **points** keyed by
    `mode × region (× sub-region when one is selected)`.
  - **OQ5 Cadence:** clock runs continuously through the reveal; Blitz **auto-advances immediately**
    on answer (no dwell) to reward speed.
  - **OQ6 PB placement:** setup card + Summary new-best celebration only (no Home/Progress chip).
  - **OQ7 Achievements:** **deferred to Phase 43** (Explorer rank/XP) — combo/points feed XP there.
  - **OQ8 Modes:** **5 allowed** — `flag-to-country`, `country-to-flag`, `map-highlight`,
    `capital-to-country`, `country-to-capital`. **Excluded:** `country-to-languages` (multi-select,
    slow), `map-locate` (slower than tap), `country-to-industry` (nichier). Setup hides Blitz for
    excluded modes (or the picker restricts modes when Blitz is chosen).
- **2026-07-14 — PRD drafted** from the engagement brainstorm (owner picked Blitz + Explorer rank/XP
  off the idea menu and asked for a PRD each). Grounded in the current code: `SessionType`
  (`src/domain/types.ts:41`), the session-format pattern from Phase 35 (`full` + `answerCount`),
  history-derived rollups (mastery / recap) as the model for a personal best, and the synthesized
  sound service (Phase 36/39). Confirmed no backend needed and no new game mode. **NOT built** —
  awaiting the clarifying round (OQ1–OQ8) and explicit build approval.
