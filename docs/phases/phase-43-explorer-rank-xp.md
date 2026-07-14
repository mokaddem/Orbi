# Phase 43 — Explorer rank & XP (progression spine)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
· **Track:** v2.6 — Momentum & progression

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Give the app a **continuous progression spine**: earn **XP** from play and convert it into a named
**Explorer rank** (tiers like Novice → … → Globetrotter), with a bar that visibly fills toward the
next rank. It sits *alongside* the existing milestone achievements — badges are binary "moments,"
XP/rank is the continuous line **between** them — so every session shows a "+N XP, I moved the needle"
payoff. Everything is **derived from already-persisted data** (history + SR / mastery); **no backend**.
This fills the gap the survey flagged: progression today is only mastery % + ~30 badges + streaks —
there is **no XP / level system** (Phase 16 explicitly deferred it).

## The trigger (owner request — 2026-07-14)
From an engagement brainstorm ("what could we add to make the app more engaging?"), the owner picked
**Explorer rank / XP** (and Blitz, Phase 42) off the idea menu and asked for **a PRD each**. Rank/XP
was pitched as: *fold existing activity into one climbing number + titles; achievements are milestones,
XP is the continuous line between them — the retention spine.*

## Current state (so scope is clear)
- **Progression today** = mastery % + ~30 badges + streaks (`src/domain/achievements.ts:130`,
  `src/domain/mastery.ts`, `src/domain/streak.ts`), shown on **Progress** (`src/ui/routes/Progress.svelte`,
  split out in Phase 30) and compactly on Home. Achievements are **milestones** (binary unlocks) — there
  is **no continuous number between them** and **no XP / levels**.
- **History** = `SessionRecord[]` with per-question `QuestionResult` (correct, `answerMs`).
  `computeStats()` (`src/domain/stats.ts`) already aggregates totals / accuracy / `byDay` — the raw
  material for XP is entirely present.
- **Achievements are pure predicates** over `{ stats, mastery, streak, sessions, now }`, evaluated on
  load; unlock dates are **persisted** in an `achievements` IDB store (DB v3) to drive a one-time
  "unlocked!" banner, and earned badges are **sticky** (Phase 16). Phase 41 made continent/`century`
  badges retarget to *fully-mastered* and be **monotonic, non-regressing**.
- **Mastery can dip.** A lapse demotes a country from "mastered" back to "learning" (Phase 16/41). So
  *live* mastery is **not** a safe XP source (XP must never go down) — see Technical notes.
- **Celebration primitives exist**: Phase 33 reactive beats, Phase 36 `achievement` jingle, and the
  `StreakBurst` particle overlay — reusable for a "rank up!" moment.
- **Placement**: the **Progress** page is the natural full-surface home; a compact chip fits on Home
  next to the mascot / streak; the **Summary** (`src/ui/routes/Summary.svelte`) is where a per-session
  "+N XP" belongs.
- **Gaps:** no XP model, no rank ladder, no XP persistence/celebration, no XP copy.

## In scope
- **Pure XP model** (`src/domain/xp.ts`): `computeXp(...)` over **monotonic / append-only** signals
  (see OQ1) — e.g. per session, per question, more per *correct* answer, streak-milestone bonus, per
  country **first-mastered**, per achievement unlocked, daily-challenge bonus. Returns total XP + a
  per-source breakdown; injected `now` where needed; deterministic and unit-tested.
- **Rank ladder** (pure data table → tiers): XP thresholds → named ranks, exposing "XP into current
  rank" and "XP to next." Curve (linear vs escalating) per OQ4.
- **XP / rank UI**: full **rank badge + XP progress bar + source breakdown** on **Progress**; a
  **compact rank chip on Home**; a **"+N XP"** line on the **Summary** after each session.
- **One-time "Rank up!" celebration** when the rank increases (reuse `achievement` jingle +
  `StreakBurst`), fired **once** per rank and **not retroactively** for pre-install history (OQ5).
- **Persistence** (minimal): store the **last-celebrated rank** (and, if chosen, an XP high-water
  mark) so rank-ups fire once and XP never regresses — reusing the Phase 16 store pattern.
- **i18n EN/FR/DE**: rank names, XP labels, "+N XP", "Rank up!", breakdown labels; parity green.
- **Tests**: XP per source, **monotonicity** (a mastery lapse never lowers XP), rank-threshold
  boundaries, once-only rank-up, reset semantics; component (bar / chip / celebration); headless verify.

## Out of scope (deliberately)
- **Online / shareable ranks or leaderboards** — Non-Goal (no backend, no social).
- No new game mode or format; **no change** to SR scheduling, the mastery definition, or existing
  achievements (XP only **reads** them).
- **No spendable currency / shop / cosmetics economy** — XP is a progress signal, not a currency
  (possible future work).
- No push notifications / reminders.

## Depends on
Phase 6 (history — the XP source), Phase 16 (mastery + achievements — XP reads both, and reuses its
"pure predicate over rollups + persisted unlock date + sticky/monotonic" pattern), Phase 41 (per-family
mastery — the newly-mastered signal), Phase 30 (the Progress page — the full-surface home). Independent
of Phase 42 (Blitz); if Blitz ships, its `SessionRecord`s feed XP automatically via the per-correct rule.

## Deliverables checklist
- [ ] Pure `src/domain/xp.ts`: `computeXp(...)` over monotonic signals → total XP + per-source
      breakdown; a pure **rank ladder** (data table) → current rank + progress to next.
- [ ] XP / rank UI: full rank badge + bar + breakdown on **Progress**; compact rank chip on **Home**;
      "+N XP" on the **Summary**.
- [ ] One-time **"Rank up!"** celebration (existing jingle + burst), once per rank, non-retroactive.
- [ ] Persistence of the **last-celebrated rank** (+ optional XP high-water mark) via the Phase 16
      store pattern; cleared by the existing Settings resets alongside achievements.
- [ ] EN/FR/DE strings (rank names, XP / "+N XP" / "Rank up!" / breakdown labels); parity green.
- [ ] Tests: XP per source, **monotonicity**, rank thresholds, once-only rank-up, reset behaviour;
      component (bar / chip / celebration); headless real-app verify.
- [ ] Verified in the real app (headless Chrome) — seeded profile renders rank/XP on Progress + Home;
      a simulated rank-up celebrates exactly once; EN/FR/DE.

## Technical notes
- **Monotonicity is the crux.** A progression bar must never go *down*, but live mastery can dip (a
  lapse demotes — Phase 16/41). So XP must come from **append-only** signals: sessions / questions /
  correct answers in history (removed only by a reset), sticky badges (Phase 16), and **first-mastered**
  events (count a country's *first* crossing of the bar, not its live state). Recommend deriving XP
  from these append-only sources (naturally monotonic, **no new store for the number**) and persisting
  only the **last-celebrated rank** for the once-only "rank up!".
- **Reset semantics.** Settings' `clearHistory` / `clearTraining` already clear the achievements store
  (Phase 16). History-derived XP naturally drops to zero on a history reset — consistent and expected;
  a persisted XP high-water mark (if used) must be cleared alongside, like the badge store.
- **Same pure pattern as achievements.** `computeXp` should be a pure function over already-computed
  rollups (`stats`, `mastery`, `achievements`, `sessions`) so it is cheap on load and trivially
  testable — mirroring `evaluateAchievements`.
- **Rank curve.** Escalating thresholds (each rank costs more) age better than linear; keep the top
  rank reachable-but-aspirational. Keep the ladder a **pure data table** so it is swappable/testable
  (like the milestone table in Phase 39).
- **Retro-fit on first launch.** Existing players get XP for all past history at once — likely a big
  initial number and several would-be rank-ups. **Seed the last-celebrated rank to the computed rank
  on first run** so there is no retroactive celebration spam (OQ5). New play from there celebrates
  normally.
- **Celebration reuse.** Rank-up = existing `achievement` jingle + `StreakBurst`; sound-off and
  reduce-motion are respected automatically by those primitives.

## Open Questions — to resolve with the owner
1. **XP sources & weights** — which signals grant XP, and how much? Candidates: per session, per
   question, more per **correct**, streak-milestone bonus, per **first-mastered** country, per
   achievement, daily-challenge bonus. (Rec: weight **correct answers** and **first-masteries** most —
   they map to learning — plus a small per-session and streak bonus.)
2. **Monotonic strategy** — derive XP from **append-only** signals only (rec), or persist an XP
   high-water mark? (Rec: derive from history + sticky badges; persist only the last-celebrated rank.)
3. **Rank names & count** — **themed** explorer titles (Novice → … → Globetrotter) needing EN/FR/DE,
   or numeric "Level N"? How many tiers? (Rec: ~8–10 **themed** titles, trilingual — more characterful
   and on-brand for Orbi.)
4. **Rank curve** — linear or **escalating** thresholds? Where is the ceiling? (Rec: escalating; top
   rank reachable by a dedicated learner but aspirational.)
5. **Retroactive XP on first launch** — grant XP for all past history (rec — it is earned) but
   **suppress** retroactive rank-up celebrations (seed the last-celebrated rank on first run)?
   (Rec: yes to both.)
6. **Placement** — full rank + bar + breakdown on **Progress**, compact chip on **Home**, and "+N XP"
   on the **Summary**? (Rec: all three.)
7. **Relationship to achievements** — keep **both** (badges = milestones, XP = continuous), and do
   badges *grant* XP? (Rec: keep both; badges grant a bonus XP chunk.)
8. **Blitz interaction (if Phase 42 ships)** — do blitz runs grant XP like other sessions? (Rec: yes,
   via the same per-correct rule — no special case.)

## Acceptance criteria
- A rank + XP bar renders on **Progress** from real history / mastery, with a breakdown of XP sources;
  a compact rank chip shows on **Home**; the **Summary** shows the "+N XP" earned that session.
- XP is **monotonic** — no sequence of play (including a mastery lapse) ever lowers total XP.
- Crossing a rank threshold fires a **one-time** "Rank up!" celebration; it does **not** fire
  retroactively for pre-install history.
- XP / rank computation is **pure** and unit-tested (per-source XP, monotonicity, rank-threshold
  boundaries, once-only rank-up); reset semantics behave (a history reset zeroes derived XP
  consistently).
- Sound-off / reduce-motion respected; existing achievements, mastery, and SR are unchanged (XP only
  reads them); EN/FR/DE parity holds.
- Fast loop green (`npm run test` / `check` / `lint`) + a headless real-app check (seeded profile →
  Progress + Home render rank/XP; a simulated rank-up celebrates once).

## Progress log
- **2026-07-14 — PRD drafted** from the engagement brainstorm (owner picked Blitz + Explorer rank/XP
  off the idea menu and asked for a PRD each). Grounded in the current code: milestone-only progression
  today (`achievements.ts`; no XP/levels — Phase 16 deferred them), history + `computeStats` as the XP
  source, the pure-predicate + persisted-unlock-date + sticky/monotonic patterns from Phases 16/41, and
  the Progress page (Phase 30) as the home surface. Flagged **monotonicity** (live mastery can dip) as
  the key design constraint. **NOT built** — awaiting the clarifying round (OQ1–OQ8) and explicit build
  approval.
