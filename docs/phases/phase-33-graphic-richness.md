# Phase 33 — Graphic richness & delight (mascot, motion & illustration)

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
· **Track:** v1.7 character & delight

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Give the app **character and delight**: use the mascot (**Orbi**) more expressively, add a few **new
poses**, bring things gently to life with **subtle, reduced-motion-aware animation**, let Orbi **react to
what just happened**, and add small **illustrative moments** where a bare screen could charm. This is the
deliberate "step above" that Phase 31 (an enrichment sweep over *existing static* assets) explicitly left
out — it stays within the established house style and palette; it does **not** rebrand or re-lay-out.

## The trigger (owner request)
> "Why not use the mascot in more places? We could use it more, add more pictures and maybe add an
> animated mascot." … "This is a game where graphics are still minimal so far — we could go a step above."
> (Raised during the Phase 31 sweep; the owner chose to keep Phase 31 restrained — mascot only on the
> NotFound page — and spin this out as its own phase, drafted *after* Phase 31 shipped.)

## In scope
- A small, reusable **motion foundation** for the mascot and a couple of key beats, honouring
  `prefers-reduced-motion` (the app already gates all its animations this way).
- A few **new mascot poses** in the existing house style, for emotional beats the current six don't cover.
- A **reactive mascot**: pose (and optional micro-animation) chosen from context — how a session went, a
  streak milestone, an achievement unlock.
- **Wider, tasteful placement** of the mascot at meaningful moments, with explicit restraint so it
  delights rather than clutters.
- A small number of **illustrative "moments"** (spot scenes) built from the mascot + existing bundled
  shapes/flags/silhouettes — no net-new heavy artwork, no new asset pipeline.

## Current state (so scope is clear)
- **`Mascot.svelte` (Phase 18):** one inline-SVG character, **6 static poses** — `wave`, `celebrate`,
  `relaxed`, `sleepy`, `thinking`, `daily`. Duotone (turquoise land on a sea-tint body), the line in
  `currentColor`, every fill a CSS var derived from the Phase-12 palette; `aria-hidden` by default with an
  optional `label`; `size` prop. **No animation today** — poses are still frames.
- **Where Orbi appears now (post-Phase-31):** Home (`wave` hero, `relaxed` caught-up), Summary (`thinking`
  empty, `celebrate` perfect), History & Progress (`sleepy` empty), Daily card (`daily`), NotFound
  (`thinking`). Mostly empty/hero states — no reaction to results, no motion.
- **Motion foundation already exists:** the app uses CSS `@keyframes` in ~13 components/routes
  (`streak-pop`, `feedback-in`, `countdown`, hover lifts, …) and **already respects
  `prefers-reduced-motion`** everywhere. So this phase extends an established motion language rather than
  inventing one, and adds **no animation library** (CSS/SVG only — keep dependencies minimal).
- **Identity:** the app is named **Orbi** and the mascot *is* the brand (Phase 29). This phase deepens
  that identity; it does not change it.
- **Asset rule (unchanged):** everything is bundled inline vector, offline, no CDN, no runtime fetch.

## Depends on
Phase 18 (mascot + icon registry), Phase 12 (visual system / palette), Phase 29 (Orbi identity). Reactive
beats hook into Phase 16 (achievements / rewards / mastery) and Phase 15 (streak). Best sequenced **after
Phase 31** (visual sweep) and **Phase 32** (answer explanations) so it decorates the final structure and
the final reveal surface once.

## Scope / Deliverables
- [x] **Motion foundation (first deliverable)** — `Mascot.svelte` gained an `animate` prop
      (`none` | `idle` | `bounce-in` | `cheer` | `wiggle`), CSS/SVG transforms only (breathe + blink,
      entrance, celebratory bounce + confetti burst, proud wiggle). The idle loop pauses off-screen via a
      lightweight `IntersectionObserver`. **Fully disabled under `prefers-reduced-motion`** (and the in-app
      toggle) — the mascot renders as its exact static pose. Owner chose **Expressive** intensity (OQ 1).
- [x] **New poses** — drew **`proud`** (star + confident stance), **`encouraging`** (warm closed-eye
      smile + thumbs-up), **`cheer`** (arms up + richer confetti), in the house style over the shared globe
      base. Extended `MascotPose` + `Mascot.test`. Count/set per OQ 2.
- [x] **Reactive mascot** — pure `src/domain/mascot.ts`: `pickSummaryReaction` (cheer→proud→celebrate→
      encouraging by accuracy), `isStreakMilestone`, `pickStreakReaction`; unit-tested. Wired into Summary.
- [x] **Expressive placement** — Summary (reactive pose + motion + tone headline), Progress
      achievement-unlock banner (proud + wiggle), Home streak-milestone beat (proud + wiggle), Home hero
      (idle). **Withhold rule:** mid-game (Play) stays calm/text-only; one animated beat per surface (OQ 5).
- [x] **Illustrative moments** — richer perfect-score scene on Summary (cheer + confetti + a fanned row of
      the played flags) and a shared `MascotScene` (idle Orbi on a soft accent halo) warming the empty
      Summary / History / Progress slates. Existing assets only, no new pipeline (OQ 4).
- [x] **Consistency, a11y & perf** — one motion language (shared keyframes in `Mascot.svelte`); decorative
      (`aria-hidden`) unless labelled; transform/opacity only (no layout shift); every animation off under
      `prefers-reduced-motion`; offline; palette-driven. In-app **"Reduce animation"** toggle added to
      Settings (OQ 6) → sets `data-reduce-motion` on the root; one global `app.css` rule neutralises all
      animation app-wide.
- [x] **Tests / checks** — unit-tested the pure helpers (`mascot.test.ts`) and new poses / `animate`
      wiring (`Mascot.test.ts`); `npm run test` (492), `check`, `lint` all green. Headless-Chrome captures
      of Home, Settings (toggle), Summary (empty / perfect-with-flag-fan / weak-encouraging), Progress
      (unlock banner) **plus a reduced-motion capture** proving the static fallback. Verified the in-app
      toggle sets the root attribute and collapses the hero's animation to ~0.001s. No bundle jump.

## Technical notes
- **Extend, don't fork.** Add motion/poses to the existing `Mascot.svelte`; keep it a single character
  component. Keep the pose→context mapping **pure and framework-free** so it's unit-testable (mirrors how
  the SR scheduler, recommender, and recap are structured).
- **Reduced motion is a hard requirement, not a nicety.** The static poses already look finished — under
  `prefers-reduced-motion` the mascot must render exactly as today (a still frame), so motion is purely
  additive.
- **Animate cheaply.** transform/opacity CSS keyframes (and SMIL/CSS on the inline SVG where it helps) —
  no runtime tween library, no per-frame JS. Watch for animations that force layout or run forever
  off-screen (pause when not visible).
- **Restraint is a feature.** More motion clutters as easily as it delights; mid-game especially should
  stay calm so it doesn't distract from answering. The audit-style "leave it still" notes matter.
- **Bundle awareness.** New poses are small inline SVG; illustrative scenes should reuse existing shapes
  rather than shipping large new art. No CDN, no runtime fetch.

## Open Questions — to resolve with the owner
1. **Motion intensity** — subtle-only (idle breathe/blink + a gentle entrance), or more expressive
   (bounces, celebratory bursts on wins)? Where is motion welcome vs. where should Orbi stay still?
2. **New poses** — which emotional beats are priority, and how many new poses to commit to (each is
   bespoke art)? Candidates: `proud`/level-up, `encouraging` (after a miss), `cheer`/confetti — others?
3. **Reactive mascot** — should Orbi react to how a session went (celebrate a great run, encourage a poor
   one), and where — Summary only, or also Home/Progress/achievement unlocks?
4. **Illustrative "pictures"** — how far beyond the mascot? A few spot scenes from existing assets, or
   keep it mascot-only? What's the bar that keeps this *enrichment*, not a redesign?
5. **Placement & withhold** — which surfaces get the expanded/animated mascot (achievement unlock, streak
   milestone, session start/finish, loading)? Which stay calm/text-only (e.g. mid-game)?
6. **Motion toggle** — rely solely on the OS `prefers-reduced-motion`, or also add an in-app
   "reduce animation" preference in Settings?
7. **Sequencing** — confirm this runs after Phases 31 (sweep) and 32 (answer explanations).

## Acceptance criteria
- An owner-approved plan exists (intensity, pose set, placement, illustration bar), and the agreed work is
  implemented in the house style — decorative-by-default, palette-driven, offline.
- The mascot animates subtly at the agreed beats and reacts to context where agreed; **with
  `prefers-reduced-motion` set, every animation is disabled and the mascot renders as a static pose**.
- New poses are drawn consistently and covered by tests; the pose-selection logic is pure and unit-tested.
- Fast loop green (`npm run test` / `check` / `lint`); headless-Chrome screenshots of the touched screens
  on :5180 **including a reduced-motion capture**; no unexpected bundle-size jump; no layout shift/jank.

## Out of scope
- A rebrand or new mascot *design* (identity is Phase 29 — this deepens Orbi, it doesn't replace it).
- A new palette, theme, or layout overhaul (the visual system is Phases 12 / 18).
- **Audio / sound effects** (no audio in the app).
- Any animation library or new dependency; any CDN-hosted or runtime-fetched art (offline rule stands).
- Answer-explanation content (Phase 32) and the icon/flag/map enrichment sweep (Phase 31).

## Progress log
- **2026-07-10 — Follow-up: header Orbi on Play / Progress / History.** Owner noted these
  populated pages still lacked the mascot. Added a shared `PageHero.svelte` (idle Orbi beside the
  `<h1>`) to the **Play setup** screen (`wave`), **Progress** header (reactive: `proud` once anything
  is mastered, else `wave`), and **History** header (`relaxed`, keeping the Clear-history button).
  **Mid-game (Play questions) still left calm** by design — offered to add it there too. Verified via
  headless-Chrome screenshots of all three; `test` (492) / `check` / `lint` green.
- **2026-07-10 — Built & verified (approved).** Clarifying round resolved with the owner:
  **OQ1 intensity → Expressive** (idle breathe/blink baseline, bounce-in entrances, confetti + bounce on
  wins, wiggle/pop on unlocks & streaks); **OQ2 poses → `proud` + `encouraging` + `cheer`** (3 new, now 9
  total); **OQ3/OQ5 placement → Summary result · Achievement-unlock banner · Streak milestone · Home hero**,
  with mid-game (Play) deliberately left calm; **OQ4 illustration → a few spot scenes** (perfect-score flag
  fan + a shared `MascotScene` halo on empty slates); **OQ6 → include an in-app "Reduce animation"
  toggle** in Settings (alongside OS `prefers-reduced-motion`); **OQ7 sequencing** satisfied (31 & 32 done).
  Owner said "include the toggle, go ahead."
  - **Implemented:** motion foundation on `Mascot.svelte` (`animate` prop, CSS/SVG keyframes, blink via a
    grouped `.eyes`, off-screen idle pause via `IntersectionObserver`, hard reduced-motion gate); 3 new
    bespoke poses; pure `src/domain/mascot.ts` (`pickSummaryReaction` / `isStreakMilestone` /
    `pickStreakReaction`, unit-tested) with the canonical `MascotPose`/`MascotMotion` types moved there and
    re-exported from the component; reactive Summary (pose + motion + trilingual tone headline) with the
    perfect-score flag-fan; new shared `MascotScene.svelte` on the empty Summary/History/Progress states;
    proud-wiggle Orbi on the Progress unlock banner; proud-wiggle streak-milestone beat on Home; idle Home
    hero; `reduceMotion` pref (data model + clamp + Settings toggle + root `data-reduce-motion` attribute +
    one global `app.css` kill-rule); trilingual strings (EN/FR/DE) for the reaction headlines, streak
    milestone, and the Settings motion section.
  - **Verified:** `npm run test` (492 passing), `npm run check`, `npm run lint` all green; production build
    clean with no bundle jump. Headless-Chrome (CDP on :5180) screenshots of Home, Settings, Summary
    (empty / perfect → *"Flawless!"* cheer + 5-flag fan / weak → *"Keep at it…"* encouraging), and the
    Progress achievement-unlock banner (proud Orbi); a **reduced-motion** capture confirms the cheer scene
    renders as a fully-visible static frame (nothing stuck at the entrance's `opacity:0`); functional check
    confirmed the in-app toggle sets `data-reduce-motion` and collapses the hero animation to ~0.001s.
    (Not captured live: the streak-milestone banner needs a 3-day streak — its logic is unit-tested and it
    reuses the verified proud/wiggle pose.)
- **2026-07-10 — PRD drafted at the owner's request, spun out of the Phase 31 sweep. Origin: mid-Phase-31
  the owner asked to use the mascot more, "add more pictures," and "maybe add an animated mascot," noting
  the app's graphics are "still minimal — go a step above." Phase 31 was kept restrained (mascot only on
  NotFound; existing static assets only) and this character-focused pass was deferred to its own phase, to
  be **drafted after Phase 31 shipped** (owner's choice). Phase 31 shipped (committed 2026-07-10), so this
  PRD is now on the board. Framed as: a reduced-motion-aware motion foundation + a few new poses + a
  reactive (context-driven) mascot + tasteful wider placement + a few illustrative moments, all in the
  existing house style over bundled inline-SVG assets. NOT built — awaiting the clarifying round and
  explicit build approval.**
