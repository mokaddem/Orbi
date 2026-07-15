# Phase 43 — Explorer rank & XP (progression spine)

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
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
- [x] Pure `src/domain/xp.ts`: `computeXp(...)` over monotonic signals → total XP + per-source
      breakdown; a pure **rank ladder** (data table) → current rank + progress to next. *(+`sessionXp`
      for the Summary "+N XP".)*
- [x] XP / rank UI: full rank badge + bar + breakdown on **Progress** (`RankPanel`); compact rank chip
      on **Home** (`RankChip`); "+N XP" on the **Summary**.
- [x] One-time **"Rank up!"** celebration (existing `achievement` jingle + `StreakBurst`), once per
      rank, non-retroactive (seeded on first run).
- [x] Persistence of the **last-celebrated rank** via the Phase 16 store pattern (new `progression`
      singleton store, DB v4→v5); cleared by `clearHistory`/`clearTraining` alongside achievements.
      *(No XP high-water mark — XP is derived append-only, so none is needed.)*
- [x] EN/FR/DE strings (rank names, XP / "+N XP" / "Rank up!" / breakdown labels) under a new `rank.*`
      namespace; parity test green.
- [x] Tests: XP per source, **monotonicity**, rank thresholds, once-only rank-up, reset behaviour
      (`xp.test.ts`, `persistence.test.ts`, `store.test.ts`); component (`RankPanel`/`RankChip`) +
      Summary "+N XP".
- [x] Verified in the real app (headless Chrome) — seeded profile renders rank/XP on Progress + Home;
      a simulated rank-up celebrates exactly once; EN/FR/DE (8/8 headless checks, zero console errors).

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
- **2026-07-15 — Merged to `main` & archived.** Rebased the branch onto `main` (which had since gained
  `dad3384` "show bonus time earned on Blitz rows"). One conflict, in `src/ui/routes/History.svelte`:
  both changes add a chip to each Recent-sessions row — resolved by keeping **both** (main's blitz
  bonus-time chip inside `.recent-sub`, and this phase's "+N XP" chip as the 5th grid column), and
  merging the shared `domain` import to pull in both `blitzEarnedSeconds` and `sessionXp`. Fast loop
  re-run green post-merge (**694 tests**, `check` 0/0, `lint` clean). Fast-forwarded `main`, archived
  this PRD, repointed the Status-Table link.
- **2026-07-15 — Built & verified (awaiting merge).** Clarifying round resolved with the owner, then
  implemented on explicit approval. **Open-question resolutions:**
  - **OQ1/OQ2 (sources + monotonic strategy):** owner picked **append-only only** — XP =
    `10·correct + 3·questions + 25·sessions + 20·longest-streak + 150·badges`. Mastery enters XP only
    via the sticky mastery *badges*, never the live rollup, so no play (incl. a lapse) can lower XP.
    No XP-number store; only the last-celebrated rank persists.
  - **OQ3/OQ4 (names + curve):** **10 themed titles**, escalating thresholds — Novice 0 · Scout 400 ·
    Wanderer 1 000 · Pathfinder 2 200 · Navigator 4 200 · Voyager 7 500 · Adventurer 12 500 ·
    Cartographer 20 000 · Globetrotter 30 000 · Legendary Explorer 45 000.
  - **OQ5 (retroactive):** grant XP for all past history, but **seed the last-celebrated rank to the
    computed rank on first run** so returning players see no retroactive celebration spam.
  - **OQ6 (placement):** **all three** — full `RankPanel` (badge + bar + source breakdown) on Progress,
    compact `RankChip` on Home, "+N XP" on Summary.
  - **OQ7 (achievements):** keep **both**; each earned badge grants **+150 XP** (the milestone→line bridge).
  - **OQ8 (Blitz):** blitz runs grant XP via the same per-correct rule — no special case.

  **What landed:** pure `src/domain/xp.ts` (`computeXp` + `RANKS`/`rankForXp` + `sessionXp`); a
  `progression` singleton IDB store (DB **v4→v5**, additive) holding only `{ lastCelebratedRank }`, with
  `get/save/clearProgression` on the port + both adapters; `loadRank(now, { commit })` in the persistence
  controller (first-run seed, commit-to-celebrate-once, display-only for Progress), cleared by both
  Settings resets; `RankPanel`/`RankChip` components; Summary "+N XP" + a one-time "Rank up!"
  (`achievement` jingle + `StreakBurst`, reduce-motion/sound-off aware) fired on Summary (primary) and
  Home (backstop, race-safe); a new trilingual `rank.*` i18n block. **Verification:** full suite green
  (**682 tests**, incl. new xp / persistence / store / component / Summary cases), `check` + `lint`
  clean, and a headless-Chrome drive (**8/8**, zero console errors) confirming rank/XP on Home +
  Progress from seeded history, a once-only rank-up, and EN/FR/DE rank names. Also fixed the local
  `eslint`/`prettier` configs to ignore `.claude/` (a locked sibling worktree was breaking
  `typescript-eslint`'s root detection).
- **2026-07-14 — PRD drafted** from the engagement brainstorm (owner picked Blitz + Explorer rank/XP
  off the idea menu and asked for a PRD each). Grounded in the current code: milestone-only progression
  today (`achievements.ts`; no XP/levels — Phase 16 deferred them), history + `computeStats` as the XP
  source, the pure-predicate + persisted-unlock-date + sticky/monotonic patterns from Phases 16/41, and
  the Progress page (Phase 30) as the home surface. Flagged **monotonicity** (live mastery can dip) as
  the key design constraint. **NOT built** — awaiting the clarifying round (OQ1–OQ8) and explicit build
  approval.
