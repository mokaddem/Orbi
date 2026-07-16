# Phase 45 — Grandmaster Challenge: cinematic arena + standalone (no-XP) test flow + daily cooldown

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ⬜ Not started · **Progress:** 0%
· **Track:** v2.7 — Mastery capstone (the presentation half of [Phase 44](phase-44-mastery-challenge.md))

> ## ⚠️ Process requirement — get an explicit "go" before building (MANDATORY)
> This is a **handover PRD** written for a fresh session to implement. The owner (Sami) has resolved
> the major design forks (recorded under *Trigger / decisions*), but the implementer MUST still
> confirm the remaining [Open Questions](#open-questions--confirm-with-the-owner) and get an explicit
> **"go"** before writing code (see the main PRD callout). Update **both** this PRD and
> [Phase 44](phase-44-mastery-challenge.md) as work lands (owner instruction, 2026-07-16).

## Goal
Phase 44 shipped the **functional** Grandmaster Challenge (the one-life "prove it" run) — but in the
**plain light-Orbi shell**, granting XP and routing to the generic Summary. This phase turns it into
the **locked cinematic arena**: a distinct dark-teal "Orbi at nightfall" experience with a crowned
crest, an offer modal, a cinematic entry transition, a redesigned HUD (a vertical heat sidebar, a
beating single life, ambient embers, a warming vignette), and a golden-bloom victory. It also makes
the challenge a **pure standalone test**: it grants **no XP** and shows **no Summary screen** (the
end is *in-arena* — a victory bloom on a clean sweep, a runover on the fatal miss), gated by a
**once-a-day-per-family×region** cooldown.

The **audio** (the five cues + escalating bed) is already shipped and wired
([Phase 44 follow-on](phase-44-mastery-challenge.md), commits `0974d99` + `fe728d9`); this phase is
purely the **visual/UX + flow** half. It pairs 1:1 with those cues.

## Design references (read these first)
- **[`docs/gauntlet-ui-spec.md`](../gauntlet-ui-spec.md)** — the locked visual spec: exact dark-teal
  tokens, the crowned-Orbi crest SVG, sidebar dimensions (desktop/mobile), every keyframe, modal
  copy, and the victory bloom. Derived from the owner-auditioned prototype (linked inside).
- **[`docs/gauntlet-audio-spec.md`](../gauntlet-audio-spec.md)** — the audio half (✅ implemented).
- The current implementation lives on branch **`phase-44-mastery-challenge`**
  (`Challenge.svelte`, the `challenge` store/domain, the Progress reward). Re-confirm file:line refs.

## Trigger / decisions (owner, 2026-07-16)
- **Build the whole locked visual design** (theme, crest, modal, transition, HUD + tier sidebar +
  embers + vignette, teal-glow correct, victory bloom, fail runover). It was prototyped + locked but
  never wired into the app.
- **No XP.** A challenge run grants **no Explorer XP** and does not feed History stats or the daily
  play-streak. *(This changes Phase 44's built behavior, which records the run via `saveSession`.)*
- **No Summary.** Because there's no XP/stats to show, the challenge **skips the `/summary` route**
  entirely; the end-of-run is presented **in-arena** (victory bloom / fail runover) with a **Return**
  to Progress.
- **Cooldown = once per day, per family × region**, Wordle-style, resets **local midnight**; win or
  lose **consumes that challenge's day**. This **removes** the current immediate "Try again" relaunch
  on a loss. Each of the 15 family×region challenges has its own daily attempt (so you may attempt a
  *different* one the same day).
- **Tracking:** a **new phase (45)**; [Phase 44](phase-44-mastery-challenge.md) stays the record of
  the functional mechanic and is updated to point here for the superseded end-flow. Both PRDs are
  updated together as work lands.

## Current state (what Phase 44 built — keep vs. change)
**Keep as-is:**
- The domain (`src/domain/challenge.ts`): unlock predicate, `buildChallengeQueue` (2N both-direction),
  `buildChallengeQuestion` (fixed full-continent options), the one-life `ChallengeSession`.
- The `challenge` store (`src/ui/stores/challenge.ts`) and `pendingChallenge` handoff.
- The pickers: `ChallengeSearchList`, the flag grid (`ChoiceGrid variant="flag"`), `MapBoard`.
- The **15 monotonic capstones** + the Progress reward surfaces (prove-it launch, gilded cells,
  "Grandmaster X/15" prestige bar) — the *certification* stays; only its trigger/persistence may move
  (see Technical notes).
- **All audio** (cues + bed) and its triggers in `Challenge.svelte`.

**Change:**
- The plain light `.game` shell → the **cinematic dark-teal HUD** (spec §4).
- The Progress "prove it" **direct launch** → an **offer modal** + cinematic transition (spec §2–3).
- `finalize()`'s `saveSession(...)` + `push('/summary')` + `perfect`/`victory` → **no XP record** and
  **in-arena end screens** (spec §5); `Summary.svelte`'s `type === 'challenge'` branch +
  `retryChallenge()` become dead code and are removed.
- Add the **daily cooldown** gate.

## In scope
- **Theme foundation** — the `--g-*` dark-teal token set + keyframes in `app.css` (scoped to the
  arena/modal, *no* global dark theme), and a `GrandmasterCrest.svelte` (the crowned-Orbi SVG).
- **Cinematic HUD** (`Challenge.svelte`) — topbar (run title, gold `cleared/total`, a **beating**
  single-life heart, Forfeit); the **vertical tier sidebar** (bottom-anchored heat fill = `cleared/
  total`, notch hints per N/10 that flash on crossing — driven by the **same** tier-crossing effect
  that already fires the Surge cue + `setBedTier`); an **ambient-embers** canvas; a **heat vignette**
  that warms with the tier; restyled pickers/feedback; **correct answers glow teal**.
- **Offer modal + entry transition** — a `GauntletOfferModal` (crest, gold title, a stakes grid with
  the **real** slot count, the crimson "one wrong answer ends the challenge" line, the cooldown row,
  Accept/Not-yet) opened from the Progress entry card; on Accept → dim → title bloom → HUD fade-in
  (the `enter` cue moves to *here*).
- **In-arena end screens** — a **victory golden-bloom** overlay (rotating rays, gold/teal confetti,
  the floating crest, "★ World Grandmaster", the shimmering GRANDMASTER title, Return, the cooldown
  line) on a clean sweep; a **runover** overlay ("The challenge ends here", "cleared X of N", Return)
  on the fatal miss. **No `/summary` route** for challenges.
- **Standalone no-XP flow** — a challenge run contributes **nothing** to XP / History stats / streak;
  the capstone **certification is preserved** by the mechanism chosen in Technical notes.
- **Daily cooldown** — persist a per-family×region last-attempt day-key; gate the entry card (badge +
  countdown when spent) and the modal's Accept; remove the immediate "Try again" on a loss.
- **i18n EN/FR/DE** — modal copy, transition title, runover/victory copy, cooldown copy;
  `messages.test.ts` parity stays green.
- **Tests** — component (modal open/accept/decline + cooldown-gated; HUD tier→sidebar/notch mapping;
  victory vs. runover branch; reduced-motion), pure (cooldown day-key + gating logic, no-XP
  exclusion), and a headless real-app drive of a clean sweep + a fatal miss (small continent).

## Out of scope
- A **global dark theme** — the dark treatment is scoped to the arena + its modal only.
- Any change to the run's **domain rules / mastery / SR** or to normal fixed/survival/full/training/
  blitz runs.
- The **audio** (already shipped).
- **Home / Play** entry points — Progress-only stays (Phase 44 ③d).
- New game modes; World / sub-region challenges (continents only, unchanged).

## Depends on
Phase 44 (the functional challenge + audio), Phase 41 (mastery unlock + the gilding/prestige
surfaces), Phase 16 (achievements / the capstone certification), Phase 6 (persistence — the cooldown
+ certification store), Phase 33 (the reduce-motion pref). Independent of Phase 43 (Explorer rank) —
in fact this phase *removes* the challenge's XP contribution to it.

## Deliverables checklist
- [ ] `--g-*` theme tokens + arena keyframes in `app.css`; `GrandmasterCrest.svelte`.
- [ ] Cinematic HUD in `Challenge.svelte`: topbar (beating life + gold counter + Forfeit), tier
      sidebar (heat fill + notches wired to `cleared/total` + the tier effect), embers canvas, heat
      vignette, restyled pickers/feedback, teal-glow correct.
- [ ] `GauntletOfferModal.svelte` (dynamic stakes) launched from the Progress entry card; the
      accept→dim→title→HUD transition; the `enter` cue moved to the transition.
- [ ] In-arena **victory bloom** + **runover**; remove the `/summary` challenge branch +
      `retryChallenge()`; Return → `/progress`.
- [ ] No-XP standalone flow — a run contributes nothing to XP/stats/streak; capstone certification
      preserved (Technical notes).
- [ ] Daily cooldown (once/day per family×region): persistence, entry-card badge + countdown, modal
      gating, "Try again" removed.
- [ ] EN/FR/DE copy; `messages.test.ts` parity green.
- [ ] Tests (component + pure + headless real-app clean-sweep & fatal-miss on a small continent).
- [ ] Fast loop green (`test` / `check` / `lint`); reduced-motion verified; both PRDs + the Status
      Table updated.

## Technical notes
- **Theme scoping.** Put the arena under a scoping class/attribute so `--g-*` applies only inside it;
  the light app is untouched. Reuse `ConfirmDialog`'s focus-trap/escape/backdrop plumbing for the
  modal, restyled.
- **One source of truth for escalation.** The sidebar heat fill + notch flashes must read the *same*
  `bedTierFor(cleared, total)` crossing that already drives `sound.play('surge')` + `setBedTier` (the
  `$effect` in `Challenge.svelte`). Extend that effect (or a derived value) to also flash the sidebar
  notch, so audio and visuals escalate in lockstep.
- **No-XP + preserved certification (the key decision).** Today the finish calls
  `saveSession(challengeSessionSummary(...))`, creating a `type:'challenge'` `SessionRecord` that
  feeds XP (`computeXp`←`computeStats`), History, the streak, *and* the 15 capstones
  (`evaluateAchievements` reads a clean-sweep challenge record). To grant no XP while keeping the
  certification, choose:
  - **(A · recommended) A dedicated `grandmaster` IDB store** (mirror `dailyChallenge`/`DailyResult`):
    per family×region, store the **last-attempt day-key** (the cooldown) + a **certified** flag/date.
    The run finish writes here — **not** `saveSession`. Re-point the 15 capstones + the Progress
    gilding/prestige to read this store instead of a challenge `SessionRecord`. Fully decouples the
    challenge from history/XP/streak *and* provides the cooldown record in one place. Biggest change,
    cleanest end state.
  - **(B · lighter) Keep the `SessionRecord`** (so capstones still evaluate unchanged) but **exclude
    `type === 'challenge'`** from `computeStats`, `computeXp`, and `computeStreak` inputs, and add a
    separate cooldown record. Fewer moving parts in the reward path, but challenge runs still linger
    in the `sessions` store and the exclusion must be applied at every history-derived site.
  - Either way, confirm **OQ1** (do capstone *badges* grant badge-XP?) — `computeXp` counts
    `achievementsUnlocked`, so a certified capstone would add XP unless capstones are made
    XP-neutral. To honor "no XP by any path," recommend excluding capstones from the XP badge count.
- **End-flow.** `finalize()` stops routing to `/summary`; instead it reveals the in-arena overlay
  (victory on `passed`, runover otherwise) and Return → `/progress`. The `victory` / fatal audio
  already fire in `finalize()` / the verdict effect — leave those. Delete `Summary.svelte`'s
  `type === 'challenge'` branch, its Grandmaster burst, and `retryChallenge()`.
- **Cooldown.** Use `localDayKey` (existing) per `family|region`; gate `launchChallenge` + the modal
  Accept; the entry card shows "Available today" or a midnight countdown when spent. Removing "Try
  again" means a lost run returns to Progress (spent for the day).
- **Canvas perf (D4, owner-rec).** Two particle systems (embers, confetti): cap counts, pause on
  `document.hidden`, and hard-disable both under reduce-motion (a static gradient fallback).
- **Reduced motion.** Must neutralize embers, confetti, rays, shimmer, the beating heart, the shake,
  and the intro (`* { animation: none !important }` inside the arena) — matching every other burst.
- **Determinism / safety.** Audio must never throw or block gameplay (already true). The cooldown
  clock is injectable for tests (like `DailyResult`).

## Open Questions — confirm with the owner
1. **Capstone badge XP** — make the 15 capstones **XP-neutral** (recommended, to honor "no XP by any
   path") or let earning one still grant its badge-XP?
2. **Certification persistence** — the dedicated `grandmaster` store (A, recommended) or the
   exclude-from-history approach (B)?
3. **Play-streak** — a challenge should **not** count as "played today" for the daily habit streak
   (recommended — it's a test, not practice). Confirm.
4. **Cooldown copy / edge** — confirm the entry badge/countdown wording, and that a spent challenge
   still lets the player attempt a *different* (un-spent) family×region the same day (per the
   per-region decision).

## Acceptance criteria
- Launching a challenge opens the **dark-teal arena** (not the light shell); the **offer modal** gates
  entry and shows the real slot count + cooldown; Accept plays the cinematic transition into the HUD.
- The **tier sidebar** fills with `cleared/total` and its notches flash on each N/10 crossing, in
  lockstep with the Surge cue; the single life beats; embers + vignette warm with the tier.
- A **clean sweep** shows the **in-arena victory bloom** (no `/summary`, no XP/stats/streak change);
  a **fatal miss** shows the **runover**; both Return to Progress.
- The **capstone still certifies** (badge + gilded cell + prestige increment) with **zero XP** gained
  from the run (and, per OQ1, from the badge).
- The **cooldown** blocks a second same-day attempt of the *same* family×region (win or lose), resets
  at local midnight, and shows the countdown; a *different* family×region is still attemptable.
- Reduce-motion neutralizes all arena animation; EN/FR/DE parity holds; fast loop green + a headless
  clean-sweep & fatal-miss drive on a small continent.

## Progress log
- **2026-07-16 — PRD drafted for handover.** Owner resolved the forks: build the full locked
  cinematic UI ([`gauntlet-ui-spec.md`](../gauntlet-ui-spec.md)); challenge grants **no XP** and shows
  **no Summary** (in-arena victory bloom / runover instead); cooldown **once/day per family×region**;
  tracked as a **new phase (45)** with [Phase 44](phase-44-mastery-challenge.md) cross-updated. Audio
  already shipped (Phase 44 follow-on). Remaining forks captured as OQ1–OQ4. **Not built** — awaiting
  the implementing session's confirm + explicit go.
