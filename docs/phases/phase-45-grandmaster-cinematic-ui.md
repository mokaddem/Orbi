# Phase 45 — Grandmaster Challenge: cinematic arena + standalone (no-XP) test flow + daily cooldown

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** 🚧 In review · **Progress:** 100% —
all sub-phases ①–⑥ complete (theme + arena HUD + offer modal & cinematic entry + in-arena victory bloom /
runover + the no-XP `grandmaster` store & daily cooldown + the **Home-screen invitation card**),
feature-complete + pending owner review + merge.
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
- **No XP — by any path (OQ1+OQ3 locked).** A challenge run grants **no Explorer XP**, feeds no
  History stats, and does **not** count toward the daily play-streak; and the **capstone badges are
  XP-neutral** too (earning one adds no XP). *(This changes Phase 44's built behavior, which records
  the run via `saveSession` and counts the capstone in the XP badge tally.)*
- **Certification + cooldown in a dedicated `grandmaster` store (OQ2 locked).** The run's certification
  (which drives the 15 gilded cells + the prestige counter) and the daily cooldown both live in one
  new IDB store — **not** a `SessionRecord` — so the challenge is fully decoupled from history/XP.
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
- **Play**-setup entry point — still out (keeps `Play.svelte` untouched). *(The **Home** entry is now
  **in** scope as ⑥ — an owner reversal of the Phase-44 ③d "Progress-only" line, for a discovery card
  only; the Progress launch mechanic is unchanged. See ⑥ below + the 2026-07-16 progress-log entry.)*
- New game modes; World / sub-region challenges (continents only, unchanged).

## Depends on
Phase 44 (the functional challenge + audio), Phase 41 (mastery unlock + the gilding/prestige
surfaces), Phase 16 (achievements / the capstone certification), Phase 6 (persistence — the cooldown
+ certification store), Phase 33 (the reduce-motion pref). Independent of Phase 43 (Explorer rank) —
in fact this phase *removes* the challenge's XP contribution to it.

## Deliverables checklist
- [x] `--g-*` theme tokens + arena keyframes in `app.css`; `GrandmasterCrest.svelte`. *(sub-phase ①)*
- [x] Cinematic HUD in `Challenge.svelte`: topbar (beating life + gold counter + Forfeit), tier
      sidebar (heat fill + notches wired to `cleared/total` + the tier effect), embers canvas, heat
      vignette, restyled pickers/feedback, teal-glow correct. *(sub-phase ② — pickers go dark via
      scoped `--color-*` token overrides on `.gauntlet`; the run's end-flow is unchanged for now)*
- [x] `GauntletOfferModal.svelte` (dynamic stakes) launched from the Progress entry card; the
      accept→dim→title→HUD transition; the `enter` cue paired with the transition. *(sub-phase ③ —
      the cooldown row is informational for now; the actual once-a-day gate lands in ⑤)*
- [x] In-arena **victory bloom** + **runover**; remove the `/summary` challenge branch +
      `retryChallenge()`; Return → `/progress`. *(sub-phase ④ — `saveSession` (XP/cert) stays until ⑤)*
- [x] Dedicated `grandmaster` IDB store (+ `QuizStore` methods) holding per-`family|region`
      certified flag/date + last-attempt day-key; the finish writes here, **not** `saveSession`.
      *(sub-phase ⑤ — DB v6, `GrandmasterRecord`, idb + memory adapters + contract tests)*
- [x] No-XP standalone flow — a run contributes nothing to XP/stats/streak; the 15 capstones moved off
      the XP-counted achievements path (XP-neutral); gilding + prestige + the "Certified!" toast read
      the `grandmaster` store. *(⑤ — `recordChallengeResult` replaces `saveSession`; the capstone
      catalog entries + `grandmasterCertified` removed; `challengeSessionSummary`/`sessionSummary()`
      dropped as dead code)*
- [x] Daily cooldown (once/day per family×region) off the same store: entry-cell clock affordance +
      countdown, modal gating (Accept removed + countdown), "Try again" gone. *(⑤)*
- [x] EN/FR/DE copy (`challenge.certifiedToast`, `challenge.cooldown.next`, `challenge.offer.close`);
      `messages.test.ts` parity green. *(⑤)*
- [x] Tests (component `GauntletOfferModal` cooldown + `FamilyRegionBreakdown` cooldown; pure store
      certification/monotonicity/cooldown-reset/no-history; headless real-app **clean-sweep** (certifies,
      no SessionRecord) **and fatal-miss** (runover → spent-uncertified → cell on cooldown) drives). *(⑤)*
- [x] Fast loop green (`test` / `check` / `lint`); reduced-motion verified; both PRDs + the Status
      Table updated. *(⑤)*
- [x] **⑥ Home-screen invitation card** (approved 2026-07-16; landed): a new
      `GrandmasterInviteCard.svelte` (the ceremonial dark-teal `.gm-invite` — crowned crest,
      "Grandmaster Challenge" title, one-line body, an "Available today" badge, gold "Enter the
      gauntlet →" CTA), shown on **Home only** and **only when ≥ 1 challenge is available** (unlocked &
      uncertified & not-spent-today, via a new pure `availableChallenges`). Click: exactly one available
      → open the `GauntletOfferModal` on Home → Accept → `/challenge`; more than one →
      `focusMastery.set(true)` + `push('/progress')` and Progress scrolls its World Mastery panel into
      view (brief highlight, reduce-motion-safe) then clears the flag. **Progress stays exactly as-is.**
      New `focusMastery` writable; `challenge.invite.*` EN/FR/DE copy; `availableChallenges` +
      `GrandmasterInviteCard` + Home-integration tests + a headless drive of all three branches.

## Technical notes
- **Theme scoping.** Put the arena under a scoping class/attribute so `--g-*` applies only inside it;
  the light app is untouched. Reuse `ConfirmDialog`'s focus-trap/escape/backdrop plumbing for the
  modal, restyled.
- **One source of truth for escalation.** The sidebar heat fill + notch flashes must read the *same*
  `bedTierFor(cleared, total)` crossing that already drives `sound.play('surge')` + `setBedTier` (the
  `$effect` in `Challenge.svelte`). Extend that effect (or a derived value) to also flash the sidebar
  notch, so audio and visuals escalate in lockstep.
- **No-XP standalone flow + certification (LOCKED — OQ1–OQ3, owner 2026-07-16).** Today the finish
  calls `saveSession(challengeSessionSummary(...))`, creating a `type:'challenge'` `SessionRecord` that
  feeds XP (`computeXp`←`computeStats`), History, the streak, *and* the 15 capstones
  (`evaluateAchievements` reads a clean-sweep challenge record; `computeXp` counts the capstone badge).
  Replace that with a **dedicated `grandmaster` IDB store** (mirror `dailyChallenge`/`DailyResult` —
  a new object store + `QuizStore` methods): per `family|region`, store the **certified** flag/date +
  the **last-attempt day-key** (one store serves both certification *and* the cooldown). Concretely:
  - On finish the run writes to this store and **does NOT call `saveSession`** → no `SessionRecord`,
    so **zero XP / stats / streak** contribution falls out for free (OQ3: never counts as "played
    today").
  - Re-point the Progress **gilding + "Grandmaster X/15" prestige** (and the unlock-banner/toast
    title, composed via the existing `challenge.badge.title` helper) to read the `grandmaster` store
    instead of a challenge `SessionRecord` / `AchievementView`.
  - Move the 15 capstones **out of the XP-counted achievements path** so earning one adds no XP
    (OQ1 — XP-neutral): drive certification from the store, not `ACHIEVEMENTS` + `saveSession`. This
    supersedes Phase 44's `saveSession`-based certification; **no data migration** (Phase 44 unmerged).
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
OQ1–OQ3 are **locked** (owner, 2026-07-16) and folded into *Trigger / decisions* + *Technical notes*:
the capstones are **XP-neutral**, certification + cooldown live in a **dedicated `grandmaster` store**,
and a run **does not** count toward the play-streak. One minor item remains:

1. **Cooldown copy** — confirm the entry-card badge / midnight-countdown wording (EN/FR/DE). The
   behaviour is already decided (per family×region): a spent family×region shows the countdown while a
   *different*, un-spent one stays attemptable the same day; this is just the exact strings.

## Acceptance criteria
- Launching a challenge opens the **dark-teal arena** (not the light shell); the **offer modal** gates
  entry and shows the real slot count + cooldown; Accept plays the cinematic transition into the HUD.
- The **tier sidebar** fills with `cleared/total` and its notches flash on each N/10 crossing, in
  lockstep with the Surge cue; the single life beats; embers + vignette warm with the tier.
- A **clean sweep** shows the **in-arena victory bloom** (no `/summary`, no XP/stats/streak change);
  a **fatal miss** shows the **runover**; both Return to Progress.
- The **capstone still certifies** (gilded cell + prestige increment, from the `grandmaster` store)
  with **zero XP** gained — the run writes no `SessionRecord`, and the capstone is XP-neutral.
- The **cooldown** blocks a second same-day attempt of the *same* family×region (win or lose), resets
  at local midnight, and shows the countdown; a *different* family×region is still attemptable.
- Reduce-motion neutralizes all arena animation; EN/FR/DE parity holds; fast loop green + a headless
  clean-sweep & fatal-miss drive on a small continent.

## Progress log
- **2026-07-17 — Forfeit now counts as a failed attempt → in-arena game-over (owner request).** The
  HUD's **Forfeit** control no longer abandons the run silently back to Progress; it opens a guard
  `ConfirmDialog` ("Forfeit the challenge? — counts as a failed attempt, no retry until tomorrow"), and
  on confirm the run **ends as a failure**: `challenge.end()` (mid-run, so `summary().passed` is false)
  → the shared `finalize()` path, which **spends today's family×region attempt**
  (`recordChallengeResult(..., false)`) and reveals the **runover** ("game over") screen (no missed-
  country pill — a forfeit has no miss). The confirm renders inside the arena so it inherits the dark-
  teal `--color-*` remaps; a scoped `--color-wrong: #cf3b2c` keeps the crimson confirm button's white
  label legible (the arena's softer death-crimson fell below contrast). Robustness: `finalize()` now
  also cancels a still-pending bed swell, and `forfeit()` no-ops if the run finished on its own while
  the confirm was open (no double-record). New i18n `challenge.forfeitConfirm` (EN/FR/DE). Tests:
  rewrote the old "forfeit → idle" case to the guarded fail→game-over flow, added a cancel-path case,
  updated the bed-stop case. **799 tests**, check/lint clean; headless capture confirms the dialog.
- **2026-07-17 — Post-⑥ arena polish (owner feedback): map label, clipped shadow, win-screen copy.**
  Four fixes to the shipped arena. **(1)** On-map reveal labels went white-on-white — the arena flips
  `--color-text` to a near-white ink while the map keeps its light palette; added a dedicated
  `--map-ink` token (`app.css`) for `.reveal-label` so it stays dark everywhere. **(2)** `.arena-main`'s
  vertical scroll clips overflow-x too, slicing the search focus ring + feedback glow flat on both
  sides; added `padding-inline` (max-width bumped to keep the 640px column) so those colored shadows
  render fully. **(3)** Dropped the "Come back tomorrow" line from the **victory** screen (kept on the
  runover). **(4)** Replaced the anticlimactic **"Return"** button on the victory screen with
  **"Onward"** (new `challenge.victory.cta`, EN/FR/DE); the runover keeps "Return". **798 tests**,
  check/lint clean; headless before/after captures confirm the label + shadow fixes. *(Committed 4cf944f.)*
- **2026-07-17 — Offer modal: added a rough duration estimate (owner request).** The `GauntletOfferModal`
  stakes grid is now three cells — **Questions · ~N min · Life** — so the player also sees how long a
  clean sweep roughly takes before committing. A new pure `estimateChallengeMinutes(slots)` (domain,
  beside `challengeSlotCount`) at `CHALLENGE_SECONDS_PER_SLOT = 6` (~1.2 s correct-answer dwell +
  ~4.8 s to answer), rounded, floored at 1; shown with a "~" and styled muted (`--g-dim`) so the two
  real stakes (gold questions / crimson life) still lead. New i18n `challenge.offer.timeLabel`
  (EN/FR "min", DE "Min."). Applies to **both** entry points (Progress cell + the Home invitation
  card) since they share the modal. Tests: `estimateChallengeMinutes` (pace/round/floor) +
  a modal "~N min" assertion. **798 tests**, check/lint clean; headless capture confirms the modal
  renders `108 Questions · ~11 min · 1 Life` for Africa flags.
- **2026-07-17 — Sub-phase ⑥ landed (Home Grandmaster invitation card); explicit owner go-ahead.**
  The ceremonial entry card is back — on **Home only**, as an *invitation* (Progress keeps its per-cell
  "prove it" crowns + cooldown clocks + gilding/prestige, **unchanged**). **Component:** a new
  `GrandmasterInviteCard.svelte` — the dark-teal `--g-*` `.gm-invite` (crowned `GrandmasterCrest`, a gold
  "Available today" pill, the gradient-clip serif "Grandmaster Challenge" title, a one-line body, and the
  chunky gold "Enter the gauntlet →" CTA, echoing the offer modal's Accept). Purely presentational — Home
  owns visibility + routing via an `onenter` callback. **Visibility:** a new pure
  `availableChallenges(mastery, certified, spentToday)` (domain) lists every family × continent that is
  unlocked (`isChallengeUnlocked`), **not** certified, and **not** spent today; Home renders the card only
  when that list is non-empty (a player with nothing attemptable never sees it). Home now also
  `loadGrandmaster()`s alongside its existing `loadMastery()`. **Routing (owner-specified):** *exactly one*
  available → open the `GauntletOfferModal` **on Home** (reusing Progress's accept path — `challenge.reset`,
  `lastChallengeSummary.set(null)`, stage `pendingChallenge`, `push('/challenge')`); *more than one* → a new
  `focusMastery` writable set true + `push('/progress')`, where a new Progress effect brings its **World
  Mastery** panel into view (`scrollIntoView`) with a one-shot `.mastery-focus` accent pulse, then clears
  the flag (both the smooth scroll and the pulse are dropped under reduce-motion — OS query or the in-app
  pref — and the pulse keyframe is also `@media`-guarded). New i18n `challenge.invite.{title,body,cta,available}`
  (EN/FR/DE), parity green. Tests: `availableChallenges` (lists/excludes certified+spent+partial+empty),
  `GrandmasterInviteCard` (content + CTA fires `onenter`), and a mocked-mastery `Home.invite.test.ts`
  (hidden at 0 · single→offer modal→`pendingChallenge`+`/challenge` · multi→`focusMastery`+`/progress`).
  Fast loop: **795 tests** (+9), `check` 0/0, `lint` clean. **Headless Puppeteer drive (5180, fresh IDB per
  branch, no console errors):** SINGLE (Flags×Oceania mastered) → the card shows → CTA opens the offer modal
  naming Flags·Oceania → Accept mounts the cinematic arena; MULTI (Flags + Capitals ×Oceania) → the card →
  CTA routes to `/progress` and spotlights the World Mastery panel; HIDDEN (nothing mastered) → no card.
  This reverses the Phase-44 ③d "Progress-only / Home out of scope" line (discovery surface only). **Phase 45
  is now feature-complete across ①–⑥, pending owner review + merge.**
- **2026-07-16 — ⑥ Home invitation card APPROVED (owner); NOT yet built (next session).** Reviewing
  the original prototype ([entry-flow Artifact](https://claude.ai/code/artifact/72a9ff88-f1aa-433b-a774-03c89d5e4a3f)),
  the owner noted the build had dropped the artifact's **prominent ceremonial entry card** in favour of
  the quiet per-cell "prove it" crown (the Phase-44 ③d "Progress-only" call, made when the design
  pivoted from one World/100-question run to 15 per-family×continent runs). Decision: **bring the card
  back — on the Home screen only, as an *invitation*** in case the player misses the Progress entry.
  **Progress stays exactly as-is** (per-cell prove-it crowns + cooldown clocks + gilded/prestige).
  Locked spec for the build:
  - **Component:** a new `GrandmasterInviteCard.svelte` matching the artifact's `.gm-card` — dark-teal
    gradient, the `GrandmasterCrest`, a "Grandmaster Challenge" title, a one-line body ("prove a
    mastered family — every country, both directions, one life"), an **"Available today"** badge, and
    the gold **"Enter the gauntlet →"** CTA. Styled via the existing `--g-*` tokens.
  - **Visibility:** Home only; render **only when ≥ 1 challenge is *available*** = family × continent
    that is unlocked (`isChallengeUnlocked`) **and** not certified **and** not spent today (from
    `loadGrandmaster`). Hidden otherwise (a player with nothing attemptable never sees it). Home already
    loads `mastery`; add a `loadGrandmaster()` read.
  - **Click behaviour (owner-specified):** *exactly one* available → open the `GauntletOfferModal` on
    Home for that run (spent=false) → Accept stages `pendingChallenge` + routes to `/challenge` (reuse
    Progress's accept path); *more than one* available → `focusMastery.set(true)` + `push('/progress')`,
    and Progress scrolls its **World Mastery** panel into view with a brief (reduce-motion-safe)
    highlight, then clears the flag. (Owner-confirmed defaults: the single case goes **through the offer
    modal**, not straight into the arena; the card shows **only when something is attemptable today**.)
  - **Plumbing:** a new `focusMastery` writable (alongside `pendingChallenge`); Progress binds its
    mastery-panel element + honours the flag on load. New i18n `challenge.invite.{title,body,cta,available}`
    (EN/FR/DE), parity green. Tests: `GrandmasterInviteCard` component, Home (shows at ≥1 / hidden at 0 /
    single→modal / multi→`/progress`+`focusMastery`), and a headless drive of both branches.
- **2026-07-16 — Sub-phase ⑤ landed (the `grandmaster` store · no-XP standalone flow · daily
  cooldown); explicit owner go-ahead.** The challenge is now a fully standalone test, decoupled from
  history/XP. **Store:** a new `grandmaster` IDB object store (DB v6, additive upgrade) with a
  `GrandmasterRecord { key: "family|region", certified, certifiedAt?, lastAttemptDay }` in both the
  IDB + memory adapters and a `QuizStore` contract test. **No-XP finish:** `Challenge.svelte`'s
  `finalize()` no longer calls `saveSession` — it calls `recordChallengeResult(family, region, passed)`,
  which always stamps today's local day-key (win *or* lose consumes the family×region's daily attempt)
  and certifies on a clean sweep (monotonic — never revoked). No `SessionRecord` ⇒ **zero XP / stats /
  streak** falls out for free. **XP-neutral capstones:** the 15 `grandmaster-*` entries + the
  `grandmasterCertified` predicate were removed from `ACHIEVEMENTS` (so earning one adds no XP);
  Progress's gilding + the "Grandmaster X/15" prestige now read `loadGrandmaster()`, and a clean sweep
  hands a session-scoped `justCertified` to a gold "Certified!" toast (the in-arena victory bloom is
  the primary celebration). The now-dead `challengeSessionSummary` (domain) + `sessionSummary()` (store)
  adapters were deleted. **Cooldown:** a spent-today, fully-mastered-uncertified family cell shows a
  muted **clock** in place of the gold "prove it" crown; tapping it opens the offer modal in a cooldown
  state — the **Accept button is removed** and the informational line becomes a gold **countdown**
  ("Next attempt in {time}", to local midnight). A wipe (`clearHistory`/`clearTraining`) clears the
  store too. New i18n `challenge.certifiedToast` / `challenge.cooldown.next` / `challenge.offer.close`
  (EN/FR/DE). Tests: the `grandmaster` contract test, a persistence-level suite (certify + no
  `SessionRecord`, fail-spends-not-certifies, monotonic, cooldown resets next day, reset wipes), the
  modal's cooldown state, and the breakdown's cooldown affordance. Fast loop: **786 tests**, `check`
  0/0, `lint` clean. **Headless real-app drives (Puppeteer / 5180), both confirmed with no console
  errors:** (a) *clean sweep* — a full 28-slot Capitals×Oceania run reaches the victory bloom, then
  Progress gilds the cell with the prestige at **1 / 15**, and the run wrote **no `SessionRecord`**
  (sessions unchanged ⇒ XP-neutral); a pre-spent Flags row shows the cooldown clock + a gated modal
  (countdown, no Accept). (b) *fatal miss* — a deliberately-wrong first pick shows the in-arena
  **runover**, records Capitals×Oceania as **spent-but-uncertified** with **no `SessionRecord`**, and
  the cell then reads "Next attempt in …" (prestige stays 0 / 15). **Phase 45 is feature-complete,
  pending owner review + merge.**
- **2026-07-16 — Sub-phase ④ landed (in-arena end screens; off the /summary route); explicit owner
  go-ahead.** A finished run now ends **in the arena** — `Challenge.svelte`'s `finalize()` stops routing
  to `/summary` and instead reveals a self-contained `ended` overlay (`{ passed, cleared, total, missed }`),
  with **Return → /progress**. **Victory (clean sweep):** a golden-bloom over the dark-teal ground — a
  slow rotating conic **ray field** (`gm-spin`, radially masked), a new **`GauntletConfetti.svelte`**
  gold/teal confetti canvas (capped, paused when hidden, not mounted under reduce-motion), the floating
  crowned crest, a "★ World Grandmaster" pill, the shimmering serif **GRANDMASTER** title (`gm-shimmer`),
  "You cleared all N — flawless.", Return, and the "Come back tomorrow." line. **Runover (fatal miss):**
  a somber dimmed crest, "The challenge ends here", "You cleared X of N", the crimson "Missed on {country}"
  chip, Return, cooldown line. Only the end **content** fades in (`gm-hudin`) over an opaque ground, so the
  app shell never peeks through the reveal (caught + fixed in the headless drive). Per the PRD's own
  staging, **`saveSession` (and thus XP + the current capstone certification) stays for now** — the no-XP
  `grandmaster`-store swap is ⑤; the cooldown line is still informational. Removed the superseded
  `/summary` challenge surface: `Summary.svelte`'s `type === 'challenge'` branch (meta / crown hero /
  fail hero / "Try again" / the certified burst) and `retryChallenge()`, plus the dead `challenge.summary.*`
  i18n and the `masteryFamilyOf` import; added `challenge.victory.*` / `challenge.runover.*` /
  `challenge.endReturn` / `challenge.endCooldown` (EN/FR/DE). Tests: rewired the two Challenge route tests
  (miss → runover; clean sweep → victory bloom) + new Return-resets + runover-count tests; dropped the
  Summary Grandmaster describe block. Fast loop: **787 tests**, `check` 0/0, `lint` clean; a headless drive
  (seeded Oceania×Flags, isolated browser per outcome) confirms a full 28-slot clean sweep → the victory
  bloom (rays + confetti + shimmer) and a fatal miss → the runover, both **full-screen with no console
  errors**. **Remaining: ⑤ the `grandmaster` IDB store + no-XP flow (drop `saveSession`; XP-neutral
  capstones; re-point gilding/prestige) + daily cooldown.**
- **2026-07-16 — Sub-phase ③ landed (offer modal + cinematic entry); explicit owner go-ahead.**
  The Progress "prove it" cell no longer launches the run directly — it opens a gated ceremonial
  **`GauntletOfferModal.svelte`** (owner picks: keep the cell as-is; include the cooldown line). The
  modal reuses `ConfirmDialog`'s plumbing (role=dialog + aria-modal, initial focus on Accept, Escape /
  backdrop dismiss), restyled dark-teal via the `--g-*` tokens: the crowned crest, a gold gradient-clip
  serif title, a `{family} · {region}` subtitle, a **two-cell stakes grid** whose "N Questions" is the
  run's **real** slot count — a new pure `challengeSlotCount(family, countries)` (the `2 × N` minus
  map-ineligible countries, no throwaway shuffle) — beside the crimson "1 Life", the crimson-ruled
  "One wrong answer ends the challenge." warning, the informational "One attempt a day · resets at
  midnight" line (the actual gate is ⑤), and Not-yet / gold **Accept the challenge** actions.
  `Progress.svelte`'s `launchChallenge` now just opens the modal; a new `acceptChallenge` stages
  `pendingChallenge` + routes into the arena on Accept. In `Challenge.svelte`, Accept now plays a
  **cinematic entry**: the arena mounts on a dim ground, the ceremonial serif title (`challenge.intro.title`
  "Enter the Gauntlet") blooms via `gm-titlein` with the floating crest + `{family} · {region}` subtitle,
  then the overlay crossfades out as the HUD fades in (a three-beat `intro → leaving → live` with two
  timers, cleared on teardown). The `enter` cue is paired with the bloom (audio-only under reduce-motion,
  which skips the visual entirely — `introPhase` stays `live`). New i18n `challenge.offer.*` +
  `challenge.intro.*` (EN/FR/DE). Tests: `challengeSlotCount` (domain), `GauntletOfferModal` (dynamic N,
  accept/decline/Escape/backdrop, closed = nothing), and the intro transition (bloom → HUD, reduce-motion
  skip + cue still plays) in `Challenge.test.ts`. Fast loop: **788 tests** (+10), `check` 0/0, `lint`
  clean; a headless Chrome drive (seeded Oceania×Flags mastery → Progress "prove it" → modal → Accept →
  intro → HUD) confirms the whole flow with **no console errors** (modal shows the real 28-slot count).
  **Remaining: ④ victory bloom + runover (rewire `finalize()` off `saveSession`/`/summary`), ⑤ the
  `grandmaster` IDB store + no-XP flow + daily cooldown + capstone-XP-neutrality.**
- **2026-07-16 — Sub-phases ①–② landed (theme + arena HUD); paused for a live look (owner cadence).**
  Building on the **same `phase-44-mastery-challenge` branch** (owner pick). **①** added the scoped
  `--g-*` dark-teal token set + the `gm-*` arena keyframes to `app.css` (with an arena-scoped
  `prefers-reduced-motion` guard) and a new `GrandmasterCrest.svelte` (crowned-Orbi globe, self-palette,
  `aria-hidden`). **②** reskinned `Challenge.svelte` into the dark-teal HUD: a **full-screen** `.gauntlet`
  takeover (`position: fixed`, `z-index: 70` — covering the tab bar / rail / appbar, so the only exit is
  **Forfeit**; an owner-review change from the first in-shell bleed, which read as weird) that
  **re-defines the core `--color-*` tokens for its subtree**, so the child pickers (`ChoiceGrid` /
  `ChallengeSearchList`) render dark-teal *by inheritance* — no change to those files (Phase 12 token
  architecture). The quit affordance was renamed **Forfeit** (`challenge.hud.quit`: EN "Forfeit" / FR
  "Abandonner" / DE "Aufgeben"). New: a topbar (serif teal run title, gold `cleared/total`
  tabular-nums counter, a **beating** crimson heart, Forfeit); the **vertical tier sidebar** (bottom-anchored
  heat fill = `cleared/total`, gold→ember `--heat` via `color-mix`, a bright leading edge, nine N/10 notches
  that light as passed and **flash white on crossing** — driven by the **same** `bedTierFor` `$effect` that
  fires the Surge cue + `setBedTier`, so audio + visuals escalate in lockstep); an **ambient-embers** canvas
  (`GauntletEmbers.svelte` — capped, paused when hidden, tier-reactive without restarting, static-gradient
  fallback under reduce-motion); a **heat vignette** (inset glow `color-mix`ing `--heat`, 0.8s transition);
  and a fatal-miss **shake + white flash**. Behavior is **unchanged** this sub-phase — a finished run still
  routes to `/summary` (the no-XP / in-arena end-flow is ④–⑤). A read-write-same-`$state` effect loop
  (`+= 1` inside the tier/verdict effects) was avoided by keying the notch pop on the strictly-increasing
  `flashedTier` and the miss flash on a plain boolean. Fast loop: **778 tests**, `check` 0/0, `lint` clean;
  a headless Chrome drive (seeded Oceania mastery → Progress "prove it" → `/challenge`) confirms the arena
  renders on desktop + mobile with **no console errors**. Owner-review polish: the internally-scrolled
  pickers (search list / flag grid) now **fade** their overflow into the ground (a bottom `mask-image` +
  matched padding) instead of a hard clip through a row; the HUD run title moved to the uppercase,
  tracked **UI font** (the serif `--g-display` is reserved for the ceremonial modal / victory titles); and
  the type-ahead search now **clears on every pick** (the fixed whole-continent pool means the options never
  change between questions, so the existing "options changed → reset" guard never fired — the typed text
  used to linger into the next question).
  **Remaining: ③ offer modal + cinematic transition
  (move the `enter` cue there), ④ victory bloom + runover (rewire `finalize()` off `saveSession`/`/summary`),
  ⑤ the `grandmaster` IDB store + no-XP flow + daily cooldown + capstone-XP-neutrality.**
- **2026-07-16 — OQ1–OQ3 locked (owner).** Capstones are **XP-neutral**; certification **and** the
  daily cooldown live in a **dedicated `grandmaster` IDB store** (the finish writes there, not
  `saveSession`); a run **does not** count toward the play-streak. Only the exact cooldown copy
  (OQ→1) remains. The PRD's decisions / technical notes / deliverables / acceptance were updated to
  match — the handover is now design-complete; the implementing session need only confirm the copy
  and get an explicit go.
- **2026-07-16 — PRD drafted for handover.** Owner resolved the forks: build the full locked
  cinematic UI ([`gauntlet-ui-spec.md`](../gauntlet-ui-spec.md)); challenge grants **no XP** and shows
  **no Summary** (in-arena victory bloom / runover instead); cooldown **once/day per family×region**;
  tracked as a **new phase (45)** with [Phase 44](phase-44-mastery-challenge.md) cross-updated. Audio
  already shipped (Phase 44 follow-on). **Not built** — awaiting the implementing session's confirm +
  explicit go.
