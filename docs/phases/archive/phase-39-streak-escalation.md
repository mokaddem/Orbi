# Phase 39 — Escalating streak jingles & milestone pop

**Part of:** [Geography Quiz — Main PRD](../../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
· **Track:** v2.3 — Streak celebration

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Make a growing streak *feel* like it's building. Today a correct answer plays a gentle two-note
`correct` cue, and only the **exact** answer that lands on a milestone (streak 3 / 5 / 10 / 15 / 20)
plays the celebratory `streak` arpeggio — one step higher each time — before immediately dropping
back to plain `correct`. This phase makes the celebration **sticky and escalating**: once you reach
a milestone, that milestone's (grander) jingle keeps playing for every correct answer until the next
milestone upgrades it — you never fall back to `correct` mid-streak. The **only** added visual is a
small one-shot animation on the streak indicator at the moment a milestone is reached.

Everything stays **synthesized at runtime** (Web Audio) — **no pre-generated audio, no new
dependencies**.

## The trigger (owner request — 2026-07-13)
> "Once you break a milestone, the sound for that milestone should continue playing — don't fall
> back to the 'correct' jingle. The only other change is a small UI animation on the streak
> indicator once you reach a milestone. Keep the discrete tiers and increase the drama once you
> reach it." — owner

## Decisions (locked with the owner — 2026-07-13)
- **Sticky tier.** After the first milestone (streak ≥ 3), every correct answer plays the current
  tier's `streak` jingle. Plain `correct` plays **only below the first milestone** (streak 1–2). A
  wrong answer resets the streak → the drama resets with it (next correct is `correct` again).
- **Keep the discrete tiers.** Milestone set stays `[3, 5, 10, 15, 20]` → tiers 0–4. Escalation is
  **stepwise per tier**, not continuous per-answer.
- **Escalate the drama per tier** using the synth levers — add layers / a low bass octave / a high
  sparkle / a fuller chord / richer timbre — authored **gently** (there is no volume slider), all
  programmatic. No files, no deps.
- **One added visual only:** a small pop on the streak indicator **at the milestone-reached moment**
  — not on ordinary correct answers. No other UI change.
- **Tuning (OQ1a):** implement the 5-tier sketch below, then **iterate by ear on the owner's
  sign-off** — exact notes/durations/gains are not frozen in this PRD.
- **Pop style (OQ2):** a single ~0.4s **scale-bump + brief accent-colour flash** on the flame +
  count, distinct from the subtle mount pop.
- **Escalation model (OQ1b) — decided by ear (2026-07-13): (B) layering + transposition.** The whole
  cue climbs a whole step per tier on top of the added layers. The losing `'layers'`-only variant and
  the `StreakVariant`/`STREAK_ESCALATION` plumbing were removed — `streakVoices` now always transposes.
- **Streaks past the top milestone (OQ3):** cap at the top tier (natural from the tier formula).

## Current state (so scope is clear)
- **Verdict cue** (`src/ui/routes/Play.svelte`, the `$effect` at ~L300): on correct it does
  `const m = STREAK_MILESTONES.indexOf(streak); if (m >= 0) play('streak', {level: m}); else
  play('correct')`. So `streak` fires **only** on the exact milestone answer, and `level` = the
  milestone index (0–4). `STREAK_MILESTONES = [3, 5, 10, 15, 20]`.
- **Streak cue authoring** (`src/ui/sound.ts`, `synthVoices('streak', level)`): a fixed 3-note major
  triad arpeggio `(0, 4, 7)` whose root climbs a whole step per level (`root = 72 + level*2`),
  triangle waves, `dur 0.16`, `gain 0.15`. Same shape at every tier — just transposed up.
- **`level` range is already 0–4**, so re-purposing it as the sticky tier needs no range change.
- **Streak indicator** (`Play.svelte` ~L515): a flame icon + count span, rendered when
  `s.streak > 1`, with an existing `streak-pop` keyframe (0.34s) that runs when the element first
  mounts — it does **not** re-fire per answer.
- **Reduce-motion is already global**: `:root[data-reduce-motion] *` in `app.css` collapses every
  animation to ~instant (plus the `@media (prefers-reduced-motion: reduce)` block in `Play.svelte`).
  Any new pop is neutralized automatically — no per-element gating needed.
- **Debounce**: `shouldDrop` drops an identical cue within 0.08s. `streak` now fires once per graded
  question (≥ `CORRECT_MS = 1500ms` apart), so repeated plays are safe — no change needed.

## In scope
- **Sticky-tier selection** in the verdict effect: play `streak` at the current tier for every
  correct answer at streak ≥ first milestone; `correct` only below it. Extract a tiny pure helper
  (`streakTier(streak): number` → `-1` below the first milestone, else `0..N-1`) so it's unit-testable.
- **Redesign `synthVoices('streak', level)`** into 5 escalating tiers via the levers above — each a
  richer voice set than the last, authored gently, each ≤ ~500ms so it fits inside `CORRECT_MS`, and
  **loudness-balanced** across tiers (add density/brightness, not raw volume — drop per-voice gain as
  voices stack so tier 4 doesn't blast).
- **Milestone-reached pop** on the streak indicator: a small one-shot animation that fires **only**
  when the streak lands on a milestone value, and **re-triggers** on each subsequent milestone
  (animation-restart via a keyed pulse counter or class toggle). Visually distinct from the ordinary
  mount `streak-pop`.

## Out of scope (deliberately)
- No pre-generated / bundled audio; **no new dependencies**.
- No change to `correct` / `wrong` authoring, cue timings, the master gain, or the Settings sound
  toggle.
- No change to scoring, streak counting, spaced repetition, history, or any domain logic.
- No new copy — the pop is purely visual, so **no EN/FR/DE strings** (parity test unaffected).
- No continuous per-answer escalation, no change to the milestone set, no in-HUD volume.

## Depends on
Phase 36 (sound service, `streak` cue, `level` param), Phase 33 (streak celebration beats +
reduce-motion foundation), Phase 2 (the verdict signal). Independent of Phase 38.

## Deliverables checklist
- [x] `streakTier(streak)` + `isStreakMilestone(streak)` pure helpers in new `src/ui/streak.ts`;
      sticky-tier wiring in `Play.svelte`'s verdict effect (`streak` for every correct at streak ≥ 3;
      `correct` only at streak 1–2); the milestone comment updated.
- [x] `synthVoices('streak', level)` (→ `streakVoices`) redesigned into 5 escalating, gentle,
      loudness-balanced tiers (triad → +octave → +bass/run → +sparkle/shimmer → +chord stab;
      3/4/6/8/12 voices), each ≤ ~0.65 s. A/B'd both escalation models; owner chose **layering +
      transposition** — finalised (loser + variant plumbing removed).
- [x] Milestone-reached pop on the streak indicator (`.at-milestone`, keyed on a `milestonePulse`) —
      fires only on a milestone crossing, re-triggers each milestone, distinct from the mount pop;
      the pulse is bumped via `untrack` to avoid a self-invalidating effect loop; auto-covered by
      global reduce-motion.
- [x] Tests: `src/ui/streak.test.ts` (tier boundaries 2→-1, 3→0, 4→0, 5→1, 9→1, 10→2, 20→4, 25→4;
      monotonic; milestone flags) + `src/ui/sound.test.ts` (streak voices grow `[3,4,6,8,12]`; clamp
      past top tier). Full suite green (571).
- [x] Verified in the real app (headless Chrome / puppeteer-core, deterministic correct-answer drive
      to streak 21): voices @ 3/5/10/15/20 = **3/4/6/8/12**; **no** fallback to `correct` after the
      first milestone (every correct at streak ≥ 3 fired ≥ 3 voices); the indicator pops **only** at
      3/5/10/15/20; **zero** console/page errors.
- [x] **Owner by-ear sign-off** via the A/B listening artifact → **layering + transposition** chosen;
      winner finalised, loser dropped, fast loop + headless re-verified green.
- [x] Merged to `main` (after Phase 38 landed) and archived this PRD.

## Technical notes
- **Sticky tier = "how many milestones passed".** `tier = STREAK_MILESTONES.filter(m => streak >= m).length - 1`.
  This naturally caps at the top tier (streak 25 → tier 4) and returns `-1` below the first
  milestone. `level` passed to the cue is now this tier (0–4) for **every** qualifying answer, not
  just the exact-milestone one.
- **Milestone-crossing predicate** stays the old test: `STREAK_MILESTONES.indexOf(streak) >= 0`.
  Because the streak increments by exactly 1 per correct answer, it lands on each milestone value
  exactly once — a clean "just reached tier N" signal for the pop, cleanly separated from the
  per-answer sound tier.
- **Tier design sketch (tunable by ear — see OQ1).** Build on the current triad arpeggio:
  - **Tier 0 (streak 3):** today's cue — 3-note major triad `(0,4,7)`, triangle, gentle.
  - **Tier 1 (streak 5):** + a resolving octave `(12)`; soft sine root-double underneath.
  - **Tier 2 (streak 10):** + a low bass root (sine, one octave down) for body; 4-note ascending run.
  - **Tier 3 (streak 15):** + a delayed high sparkle `(+19)`; a quiet detuned second layer for shine.
  - **Tier 4 (streak 20):** bass + run + a final sustained major-chord stab + sparkle — the peak.

  Escalation is carried by **density and brightness**, not loudness: keep per-voice gains low so
  every tier peaks near the same gentle level. Upward root transposition (the current `+level*2`) is
  now **optional** — layering can carry the drama without thinning out at tier 4 (OQ1).
- **Animation restart.** A persistent element won't re-run a CSS animation on its own. Use a keyed
  pulse (`{#key milestonePulse}` bumped when a milestone is crossed) or an off→on class toggle so the
  pop replays at each milestone. Keep it small (a firmer scale-bump / accent flash), distinct from the
  0.34s mount `streak-pop`.
- **No new deps, offline-safe by construction** — synthesis adds zero bytes and nothing to precache.

## Open Questions — resolved (2026-07-13)
- **OQ1a tuning** → **implement the sketch, iterate by ear on the owner's sign-off** (notes not
  frozen here).
- **OQ1b escalation model** → **undecided by design**: build **both** (A) layering-only and (B)
  layering + transposition, and let the owner A/B them on sign-off, keeping the winner.
- **OQ2 pop style** → **a ~0.4s scale-bump + brief accent-colour flash** on the flame + count.
- **OQ3 streaks past the top milestone** → **cap at the top tier.**

## Acceptance criteria
- After reaching a milestone, **every** subsequent correct answer keeps playing that tier's jingle
  (never `correct`) until the next milestone upgrades it or a wrong answer resets the streak.
- Each higher tier is **audibly grander** than the last, yet none is jarring — loudness stays gentle
  and each cue ends well within `CORRECT_MS`.
- The streak indicator plays a small pop **only** at the moment a milestone is reached — not on
  ordinary correct answers.
- Sound **off** → completely silent; **reduce-motion** → no pop; scoring / SR / history unchanged.
- Fast loop green (`npm run test` / `check` / `lint`); no EN/FR/DE copy change; verified in the real
  app per the deliverable above.

## Progress log
- **2026-07-13 — Merged to main + archived (✅ Done).** Fast-forwarded `phase-39-streak-escalation`
  into `main` (no merge commit), immediately after Phase 38, and moved this PRD to
  `docs/phases/archive/`. Phase 39 closed.
- **2026-07-13 — Owner chose the escalation model; finalised.** Owner A/B'd the listening artifact and
  picked **layering + transposition** (the cue climbs a whole step per tier atop the added layers).
  Removed the losing `'layers'` variant and the `StreakVariant`/`STREAK_ESCALATION` plumbing;
  `streakVoices` now always transposes. Fast loop green (571); `check`/`lint` clean; headless drive to
  streak 21 re-verified (voices 3/4/6/8/12, no `correct` fallback, milestone-only pops, zero errors).
  **Ready to merge** after Phase 38.
- **2026-07-13 — Built & verified (🟡 awaiting by-ear sign-off).** New pure `src/ui/streak.ts`
  (`STREAK_MILESTONES`, sticky `streakTier`, `isStreakMilestone`). `Play.svelte` verdict effect now
  plays the sticky `streak` tier for every correct answer at streak ≥ 3 (plain `correct` only at
  1–2) and bumps a `milestonePulse` (via `untrack`) that keys the indicator's `.at-milestone`
  scale-bump + accent-flash pop. `sound.ts` `streakVoices` builds 5 escalating tiers (3/4/6/8/12
  voices) in both `STREAK_ESCALATION` variants. Tests: `streak.test.ts` + updated `sound.test.ts`
  (suite 571 green); `check` + `lint` clean. **Caught & fixed** an `effect_update_depth_exceeded`
  loop (a tracked `+= 1` read+write) during headless verification. Headless drive (deterministic
  correct answers to streak 21) confirmed the tier voice counts, no `correct` fallback after the
  first milestone, and milestone-only pops, with no console errors. Built an A/B listening artifact
  (faithful synth port) for the owner to pick the variant and flag any tier to tune. **Not merged** —
  awaiting sign-off; then finalise the winning variant and merge.
- **2026-07-13 — Clarifying round complete; OQs resolved.** Owner locked: implement the tier sketch
  and **tune by ear on sign-off** (OQ1a); **build both escalation variants** — layering-only and
  layering+transposition — to A/B by ear (OQ1b); milestone pop = **scale-bump + accent flash**
  (OQ2); **cap at the top tier** past streak 20 (OQ3). Decisions + deliverables updated. **Still NOT
  built — awaiting explicit build approval.**
- **2026-07-13 — PRD drafted** from the owner's request to make streak jingles sticky and escalating
  with a milestone-only UI pop. Grounded in the current code: the verdict effect
  (`Play.svelte` ~L300) plays `streak` only on the exact milestone answer today; `synthVoices('streak')`
  (`sound.ts`) is a fixed triad transposed per level; the streak indicator (~L515) has a mount-only
  `streak-pop`; reduce-motion is already global (`app.css`). Confirmed fully programmatic — **no
  pre-generated audio, no new deps**. **NOT built** — awaiting the clarifying round (OQ1–OQ3) and
  explicit build approval.
