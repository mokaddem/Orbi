# Grandmaster Challenge — Cinematic UI Design Spec

**Status:** 🎨 Design locked (prototype), **not implemented** · **Last updated:** 2026-07-16 · **Owner:** Sami

> ⚠️ **Design reference, not a green light.** Every value below was auditioned and locked by the
> owner in an interactive HTML prototype (see below). The app today ships the *functional* Phase-44
> challenge in the **plain light-Orbi shell** — none of the cinematic UI here is built. Implementation
> needs Sami's explicit go-ahead (main_PRD → *How to work on this project*). The companion
> [`gauntlet-audio-spec.md`](gauntlet-audio-spec.md) (✅ implemented) is the audio half of the same
> feature; this doc is the visual/UX half.

**Locked prototype (source of truth):** the full entry → gauntlet → victory flow —
https://claude.ai/code/artifact/72a9ff88-f1aa-433b-a774-03c89d5e4a3f (its complete self-contained
HTML — exact CSS, keyframes, the crest SVG, and the embers/confetti particle code — was captured at
implementation time; treat it as the pixel-level reference).

The **Grandmaster Challenge** turns the current plain challenge screen into a distinct *arena*: a
softened **dark-teal** departure from the light app ("Orbi at nightfall"), gold/ember reserved for
the escalating "heat", a crowned-Orbi crest as its mark, a gated offer modal, a cinematic entry
transition, a redesigned in-run HUD (a vertical heat sidebar, a beating single life, ambient embers),
and a golden-bloom victory screen. It pairs 1:1 with the already-built audio cues.

---

## What's built vs. what this spec adds

| Surface | Today (light shell) | This spec (locked) |
|---|---|---|
| Entry | Progress "prove it" launch → direct `push('/challenge')` | A **dark-teal entry card** (crest + cooldown badge) → an **offer modal** with stakes/cooldown |
| Start | Route swaps to the light `.game` | **Cinematic transition**: dim → title bloom → HUD fade-in (Enter cue plays here) |
| In-run HUD | Light `.game`: progress bar + crown + heart + Quit | Dark-teal arena: **vertical tier sidebar** (heat fill + notches), topbar count + **beating** life, Forfeit, **ambient embers**, **heat vignette** |
| Correct/miss | Green/red `.feedback` box | Teal-glow correct, crimson miss (in-arena styling) |
| Cooldown | none | **One attempt/day**, Wordle-style, resets local midnight |
| End (fail) | `/summary` fail branch (Orbi + "cleared X of Y") | **In-arena runover** "The challenge ends here" → Return (no `/summary`, no XP) |
| End (win) | `/summary` gold-crown hero + StreakBurst | **In-arena victory golden-bloom**: rotating rays, confetti, floating crest, shimmer GRANDMASTER title → Return (no XP) |

---

## Design tokens (add to `app.css`, `--g-*` namespace)

The gauntlet is a scoped dark theme — these tokens apply only within the arena/modal, so the rest of
the light app is untouched (there is no global dark theme).

```
--g-bg:#123b35;  --g-bg2:#18463f;                      /* dark-teal ground (lifted off black) */
--g-ink:#eaf5f1; --g-dim:#a6c9c1; --g-faint:#79978f;   /* text ramp */
--g-teal:#45c9bd; --g-teal-deep:#10a5a0;               /* Orbi teal in the chrome + relief glow */
--g-gold:#e6c579; --g-ember:#e0803f; --g-crimson:#de6a62; /* heat + the single life / miss */
--g-line:rgba(180,232,222,0.14);                       /* hairline dividers/borders */
--sb:92px;                                             /* tier-sidebar width (→ 22px mobile) */
--g-display:"Hoefler Text","Iowan Old Style","Palatino Linotype",Palatino,"Times New Roman",serif;
--g-mono:"SFMono-Regular","JetBrains Mono",Consolas,"Liberation Mono",monospace;
```

Entry-card gradient `linear-gradient(135deg,#10514a,#146a60 55%,#0f4b45)`; gold CTA/button
`linear-gradient(180deg,#f2d488,#d9a94a)` with `box-shadow:0 4px 0 #9c7328`. All system fonts — **no
webfont** (the serif/mono stacks degrade gracefully), consistent with the app's no-webfont rule.

## The crest (crowned-Orbi globe, inline SVG)

The mark on the entry card, modal, and victory screen — a teal Orbi globe wearing a gold crown (NOT
swords). Exact SVG is in the prototype; ship it as a small `GrandmasterCrest.svelte` (viewBox `0 0 64
64`, `currentColor`-independent, `aria-hidden`), reused at 46/58/118 px.

---

## Screens

### 1 · Entry affordance
Owner decision (Phase 44 ③d): **Progress only** — no Home chip / Play card. The existing "prove it"
cell in the World-Mastery breakdown becomes (or gains) the **dark-teal entry card**: crest +
"Grandmaster Challenge" (serif, uppercase, gold) + one line "Every country. One life. Miss once and
the challenge is over." + a gold "Enter the gauntlet →" CTA + a **cooldown badge** ("⏳ Available
today" / "Resets at midnight"). Clicking opens the modal (not a direct launch).

### 2 · The offer modal
A scale-in dialog (`transform:scale(0.92)→none`, 0.4s), dark-teal, crest at top, gold gradient-clip
title "The Grandmaster Challenge", a two-cell **stakes grid** (🌍 *N* Questions · ❤️ 1 Life), a
crimson-ruled warning "**One wrong answer ends the challenge.**", a cooldown row "One attempt a day ·
resets at midnight", and actions **Not yet** / **Accept the challenge** (gold). Reuses the app's
`ConfirmDialog` focus-trap/escape/backdrop plumbing, restyled. **Stakes are dynamic** — *N* is the
real slot count for the chosen family × continent (Europe map 90, Africa flags 108, Oceania ~52), not
the prototype's hard-coded 100.

### 3 · Accept → cinematic transition
On Accept: modal dismisses → a brief dim → `#intro` title bloom (`titlein` 1.9s: scale/letter-spacing
settle then lift; subtitle `subin`) → HUD fades in (`opacity` 0.6s). **The `enter` audio cue fires
here** (replacing the current run-start-only placement), so audio + visuals land together. A wrong
answer later triggers a `shake` (0.5s) + white `#flash`.

### 4 · The gauntlet HUD
- **Topbar:** run title (serif, teal), `cleared / total` counter (cleared in gold, tabular-nums),
  the single **life** = a **beating** heart (`beat` 0.9s infinite, crimson), and a **Forfeit** button.
- **Vertical tier sidebar** (`--sb` = 92px desktop / **22px mobile**; `.track` 18px / **7px** mobile):
  a bottom-anchored **heat fill** whose height = `cleared/total` and whose color is the tier heat
  (`--heat`, interpolated gold→ember as tiers rise), with a bright leading edge; **notch hints** at
  each N/10 boundary that light as passed and **flash white** on crossing (in step with the Surge
  cue + `setBedTier`). No text/labels (per ③ decision).
- **Ambient embers:** a full-bleed `<canvas>` of slow rising ember particles (physics in the
  prototype). Density/heat rises subtly with tier. Skipped under reduced-motion.
- **Heat vignette:** an inset shadow whose inner glow color-mixes `--heat` (`transition 0.8s`), so the
  arena visibly warms as the run escalates.
- **Question area:** the existing pickers (flag grid / `ChallengeSearchList` / `MapBoard`) restyled
  for dark-teal (`.opt` teal-hover; `.opt.correct` teal glow; `.opt.miss` crimson). Correct answers
  **glow teal** (relief), not gold.

### 5 · End screens
- **Runover (fail)** — an in-arena overlay: bed cuts, the fatal knell rings (already wired), then
  "The challenge ends here" / "You cleared **X** of *N*" fades up, with **Return** + (see cooldown)
  **Try again**. Then → `/summary` for the XP/stats breakdown.
- **Victory (pass)** — the golden-bloom payoff (Victory fanfare already wired): a radial gold base
  over near-opaque dark-teal, a slow **rotating conic ray** field (`spin` 64s, radial-masked),
  **gold/teal confetti** (canvas, gravity), the **floating crest** (`floaty` 4s + gold glow), a "★
  World Grandmaster" pill, a shimmering **GRANDMASTER** title (`shimmer` 3.2s gradient sweep), "You
  cleared all *N* — flawless.", **Return**, and the cooldown line "Come back tomorrow." Then → the
  Summary for XP/badge (or fold the Summary's XP cards beneath — see open decisions).

All animations gated behind `prefers-reduced-motion` / the app's reduce-motion pref (`* {animation:
none !important}` inside the arena), matching every other burst in the app.

---

## Cooldown (Wordle-style, once/day)

Locked (Phase 44): **one attempt per day, win or lose, resetting at local midnight.** Adds a small
persisted record (mirror `DailyResult`: a new `grandmaster` IDB store or a row keyed by
`family|region` + `localDayKey`). On a day already spent, the entry card shows "Come back tomorrow" +
a countdown and the modal's Accept is disabled. **This replaces the current unconditional "Try again"
re-stage on a loss** — a loss consumes the day (open decision: global vs per-family×region below).

---

## Integration points

| What | Where | Change |
|---|---|---|
| `--g-*` tokens + arena base | `src/app.css` | Add the scoped dark-teal token set + keyframes |
| Crest | new `src/ui/components/GrandmasterCrest.svelte` | Inline crowned-Orbi SVG |
| Entry card + modal | `Progress.svelte` / `FamilyRegionBreakdown` + new `GauntletOfferModal.svelte` | Card → modal → `pendingChallenge`; gate on cooldown |
| Arena HUD + transition + embers/vignette | `Challenge.svelte` (+ small child components) | Replace the light `.game` with the dark-teal HUD, sidebar, intro, embers canvas; move the `enter` cue to the transition |
| End screens | `Challenge.svelte` overlays (runover/victory) and/or `Summary.svelte` challenge branch | Build the runover + victory bloom; reconcile with the existing `/summary` challenge branch |
| Cooldown persistence | `data/persistence` (+ store types) + a `challenge` store bridge | A per-day attempt record + gating helpers |
| i18n | `src/i18n/messages/{en,fr,de}` | Modal stakes/warn/cooldown copy, transition title, runover/victory copy; `messages.test.ts` parity |
| Tests | component + pure | Modal (open/accept/decline/cooldown-gated), cooldown persistence/reset logic, HUD tier→sidebar mapping, reduced-motion, EN/FR/DE parity |

---

## Phased implementation plan (each phase independently shippable + green)

1. **Theme foundation** — `--g-*` tokens, keyframes, the `GrandmasterCrest` component. (No behavior
   change; pure groundwork.)
2. **Arena HUD** — restyle `Challenge.svelte` into the dark-teal HUD: topbar (beating life, gold
   counter), the **tier sidebar** (heat fill + notches wired to `cleared/total` + the existing
   Surge/tier effect), embers canvas, heat vignette, restyled pickers/feedback. *The biggest visual
   phase; the run already works, this reskins + adds the sidebar.*
3. **Entry modal + cinematic transition** — the offer modal (dynamic stakes) from the Progress card,
   the accept→dim→title→HUD transition, and moving the `enter` cue to the transition.
4. **Victory bloom + runover** — the two end screens (rays, confetti, floating crest, shimmer title;
   fail runover), reconciled with `/summary`.
5. **Cooldown** — the once/day persistence + gating (entry badge/countdown, modal disable, retry
   rules), i18n, tests.

Ordering rationale: 1→2 gives the visible arena fastest (what "where are the features" is really
about); 3–5 layer the front-door, payoff, and gate. Each phase keeps the fast loop green.

---

## Resolved decisions (owner, 2026-07-16)

- **D1 · End screens → in-arena, no Summary.** The challenge grants **no XP**, so there's nothing for
  the generic Summary to show: the end-of-run is presented **in-arena** — the victory bloom on a clean
  sweep, the runover on the fatal miss — with a **Return** to Progress. The `/summary` route is
  **not** used for challenges (its `type === 'challenge'` branch is removed). *(See the tables above —
  "then Summary for XP" no longer applies.)*
- **D2 · Cooldown → once/day per family × region.** Each of the 15 challenges has its own daily
  attempt (Wordle-style, local-midnight reset); win or lose consumes that challenge's day. This
  **removes** the current immediate "Try again" on a loss. A *different* family×region is still
  attemptable the same day.
- **D3 · Tracking → new phase.** Implemented as **[Phase 45](phases/phase-45-grandmaster-cinematic-ui.md)**
  with this doc as its design reference; [Phase 44](phases/phase-44-mastery-challenge.md) is
  cross-updated for the superseded end-flow.
- **D4 · Canvas cost → capped.** The embers + confetti particle systems cap their counts, pause on
  `document.hidden`, and hard-disable under reduce-motion (static gradient fallback).

> **No-XP standalone flow (new requirement).** A run must contribute nothing to XP / History stats /
> the play-streak; the capstone *certification* (badges + gilding + prestige) is preserved via a
> mechanism that grants no XP — see Phase 45 → *Technical notes* (dedicated `grandmaster` store, or
> excluding `type:'challenge'` from the history-derived signals).

---

## Non-goals / constraints
- No new runtime dependencies; no backend; offline-first (all SVG/canvas/CSS, system fonts).
- The dark theme is **scoped to the arena + its modal** — there is deliberately no global dark theme.
- Reduced-motion must fully neutralize embers, confetti, rays, shimmer, beat, shake, and the intro.
- Does not change the run's domain rules, mastery, SR, or the audio (already shipped).
