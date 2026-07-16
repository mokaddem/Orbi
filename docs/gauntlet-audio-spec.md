# Grandmaster Run — Audio Design Spec

**Status:** ✅ Implemented (on `phase-44-mastery-challenge`, pending owner audition) · **Last updated:** 2026-07-16 · **Owner:** Sami

> ✅ **Built 2026-07-16** on the `phase-44-mastery-challenge` branch (explicit owner go-ahead): the
> engine (`src/ui/sound.ts` + the pure bed model `src/ui/sound.bed.ts`) and the `Challenge.svelte`
> triggers. Every parameter below was auditioned and locked by the owner as an interactive Web-Audio
> prototype; this doc is the authoritative reference the implementation follows. **The live audition
> (Sami, on 5180) is the real acceptance step** — headless can't play sound, so the automated checks
> only confirm the graph builds and the right cues fire. See the *Implementation notes* at the end.

The **Grandmaster Run** ("the gauntlet") is the phase-44 mastery challenge: a long run (N questions)
where **one wrong answer ends everything**. This spec covers the audio that makes it feel like an
epic trial: an escalating background score, a relief-tinged correct cue, a run-ending fatal-miss
jingle, two arena effects, and a victory fanfare.

Everything is synthesized with the Web Audio API using the **same oscillator vocabulary the app
already uses** in [`src/ui/sound.ts`](../src/ui/sound.ts) — zero new assets, zero dependencies (the
fatal-miss bells could alternatively be a small `.ogg` via the existing jingle path; see
[Open decisions](#open-decisions)).

---

## The five cues at a glance

| Stage | Name | What it is | Fires when |
|------:|------|------------|------------|
| **01** | **The Rising Bed** | A looping D-minor score that escalates through 10 tiers | Loops throughout the run; a new layer stacks every `N/10` cleared |
| **02** | **Settle** | The correct-answer cue — relief, not triumph | Each correct answer |
| **03** | **Descending Bells** | The fatal-miss end-jingle — a falling knell that fades loud→soft | The one fatal miss that ends the run |
| **04** | **Enter the Arena** + **Tier-Up Surge** | Two arena hits | Enter on accepting the challenge; Surge on each tier-up |
| **05** | **Victory Fanfare** | A ceremonial fanfare resolving D-minor → D-major | Clearing all N — the "Grandmaster" payoff |

**Prototype artifacts** (audition pages — the source of truth for these parameters):

- Stage 01 · The Rising Bed — https://claude.ai/code/artifact/4794a4e5-8d18-4536-8356-95453a6b3add
- Stage 02 · Settle (relief cue) — https://claude.ai/code/artifact/8a316177-04e2-4d25-8376-3db6feacee87
- Stage 03 · Descending Bells — https://claude.ai/code/artifact/a9873ecf-22a5-4de9-9dce-825e74485328
- Stage 04 · Gauntlet FX — https://claude.ai/code/artifact/e41e62ad-55f4-4813-8512-0f5a43af44a2
- Stage 05 · Victory fanfare (call variations) — https://claude.ai/code/artifact/94647245-680b-43e7-9f2a-4884b33c1aba
- Full entry → gauntlet → victory UI flow — https://claude.ai/code/artifact/72a9ff88-f1aa-433b-a774-03c89d5e4a3f

---

## Synthesis foundation

All cues are built from a small set of pure voice helpers over one `AudioContext`. `hz(m)` is the
existing MIDI→frequency helper: `hz(m) = 440 · 2^((m − 69)/12)`. Two envelope shapes recur:

- **Percussive** (the app's existing marimba shape): `gain 0.0001 → peak` over ~6 ms (exponential),
  then exponential decay back to `0.0001` at the note's end. Used by `pluck`, `drum`, `tone`, `noise`.
- **Pad**: linear attack `a`, hold, linear release `r`. Used for drones, horn swells, pads.

Voice helpers (names as used in the prototypes):

| Helper | Timbre | Notes |
|--------|--------|-------|
| `pluck` | triangle, percussive | **The app's `correct`-cue voice.** The melodic workhorse (Embers, choir, sparkle). |
| `drum(f0→f1)` | sine with pitch-drop | Membrane hit — booms, toms, timpani, body-thumps. |
| `pad` | sine/saw/tri + optional low-pass, pad env | Drones, string/horn swells, chords. |
| `tone` | saw/tri + optional low-pass, percussive env | Bass ostinato, bright stabs. |
| `noise` | filtered white-noise burst | Crashes, hats, breath, whoosh impacts. |
| `bell` | sum of inharmonic sine partials | Fatal-miss bells (see Stage 03). |
| `whoosh` | looped noise through a swept band-pass | Enter / Tier-Up risers. |

**Gain staging.** Per-voice gains below are pre-master (the same convention as `sound.ts`, where
`MASTER_GAIN = 0.45`). Everything is authored deliberately quiet; a shared `DynamicsCompressor`
before the destination glues peaks when many layers stack. The **bed ducks under the answer cues**
in-game (exact duck amount to be tuned in-app).

Two shared sends exist per graph: a **reverb** (a procedurally-generated impulse) and, for the bed,
a **dotted-eighth delay**.

---

## Stage 01 — The Rising Bed

The background score. **D minor · 96 BPM · a 4-bar loop = 64 sixteenth-steps** (`SEC16 = 60/96/4 =
0.15625 s`, loop ≈ 10 s). It is one looping bed whose intensity is a pure function of progress.

### Groove (`foundation`, present at every tier)

Per step `p`, with `b = p % 16`, `bar = ⌊p/16⌋`, `fill = (bar === 3)`:

| Element | Steps | Voice (params) |
|---------|-------|----------------|
| Deep booms | `b ∈ {0, 8}` | `drum` sine `hz(38)·1.9 → hz(24)`, dur 0.5, gain **0.6** (+ reverb copy `hz(38)→hz(28)` dur 0.4 gain 0.16) |
| Sub-thump | `b ∈ {0, 8}` | `pad` sine `hz(26)`, dur 0.45, gain 0.12, atk 0.01 |
| Mid accents | `b = 4`, or `b = 12` when not `fill` | `drum` sine `hz(45)·1.7 → hz(45)`, dur 0.2, gain 0.34 |
| Gallop pickups | `b ∈ {6, 7}`, or `{14, 15}` when not `fill` | `drum` sine `hz(45)·1.6 → hz(45)·0.92`, dur 0.16, gain 0.32 |
| Bar-4 tom-roll fill | `fill && b ≥ 9` | `drum` sine, `m = 41 + ((b−9)/6)·12`, `hz(m)·1.5 → hz(m)·0.9`, dur 0.13, gain `0.26 + k·0.14` (rising octave into the downbeat) |
| Loop-top crash + body drone | `p = 0` | `noise` band-pass 3200 (q 0.5) dur 0.6 gain 0.12 → reverb; `pad` sine `hz(38)` dur 10.2 gain 0.03 |
| Mid crash | `p = 32` | `noise` band-pass 2600 (q 0.6) dur 0.4 gain 0.07 → reverb |

### The Embers motif

The melodic cell shared by several layers — short `pluck`s landing only in the gaps between hits
(`{step: midi}`): `2:69, 10:65, 18:69, 26:65, 29:64, 34:70, 42:69, 50:69, 51:65, 53:62`
— i.e. **A4·F4 / A4·F4·E4 / Bb4·A4 / A4·F4·D4** across the four bars.

### The 10 tiers (accumulating)

`renderBed(tier, p, …)` plays `foundation(p)` then every layer `i` where `i ≤ tier`. Each tier adds
one layer on top of all lower ones:

| Tier | Name | Adds (key params) |
|-----:|------|-------------------|
| 0 | Kindling | **Embers melody** — `pluck` tri dur 0.16 gain **0.075** |
| 1 | Ember | **Choir** — a diatonic third below each note (`{69:65,65:62,64:60,70:67,62:58}`), `pluck` gain 0.052 |
| 2 | Flame | **Drift** — `+12` shimmer `pluck` gain 0.028 → bus+delay; the base note echoed into the delay (gain 0.04) |
| 3 | Blaze | **Body** — `b0`: `pad` saw `hz(BODY_ROOT[bar]−12)` dur 2.6 gain 0.045 cutoff 600; `b0/8` deeper boom `drum` `hz(26)·1.6→hz(19)` dur 0.55 gain 0.28. `BODY_ROOT = [50,50,53,57]` |
| 4 | Pyre | **Counter-melody** — high answer `{5:74,11:69,21:74,27:72,37:77,43:74}`, `pluck` dur 0.12 gain 0.04 |
| 5 | Inferno | **Bass ostinato** — `BASS_ROOTS = [38,38,41,45]`, hits `b ∈ {0,3,6,8,11,14}`, `tone` saw cutoff 480 q 2; accents (`b0/8`) dur 0.2 gain **0.047**, else dur 0.13 gain **0.032** |
| 6 | Firestorm | **War-horn stabs** — `HORNS = {0:38,16:38,32:46,48:45}` (D·D·Bb·A), octave-stacked `[r, r+12]` × detune `±7`, `pad` saw cutoff 1300 dur 2.0 gain 0.04 (root) / 0.028 (oct) |
| 7 | Cataclysm | **Sky echo & sub** — `+12` shimmer `pluck` gain 0.03 → delay; `b0/8` sub `pad` sine `hz(BASS_ROOTS[bar]−12)` dur 0.6 gain 0.05 |
| 8 | Apex | **Pad swell + octave double + climax sparkle** — `b0` triad `[0,3,7]+BODY_ROOT` `pad` tri dur 2.6 gain 0.02; octave-down `pluck` `e.m−12` gain 0.03; sparkle `pluck` `e.m+19` gain 0.022; `p0/32` crash `noise` hp 5000 dur 0.4 gain 0.05 |
| 9 | Grandmaster | **Ticking clock** — on every **8th** (`p%2===0`), `high = p%4===0`: `pluck` tri `hz(96)`/`hz(89)` dur 0.03 gain 0.05/0.042 atk 0.001 + `noise` hp 6800/4800 dur 0.014 gain 0.026 (dry, no reverb) |

### Normalization (any run length N)

```
tier = min(9, ⌊cleared · 10 / N⌋)     // 10 tiers evenly across the run
```

So a 50-question run still traverses all 10 tiers, just twice as fast. `N` = total questions in the run.

### FX bus

- **Reverb** — 2.6 s tail, decay 2.6, wet send **0.2**.
- **Delay** — dotted-eighth (`SEC16 · 3 ≈ 0.469 s`), feedback 0.34, send 0.3 (feeds Drift/Sky-echo layers).

### New subsystem required

The engine today only plays one-shot cues — it has **no looping music**. Implementing the bed means
adding, in `sound.ts`:

1. A small **look-ahead scheduler** (25–30 ms timer, ~0.18 s schedule-ahead window) — the standard
   Web-Audio pattern the prototype uses.
2. A **`bedVoices(tier)` accumulator**, structurally identical to the existing `streakVoices(level)`:
   a list of layers, play those with `from ≤ tier`.
3. A **bed lifecycle API** (`startBed()` / `stopBed(fade)` / a live `tier` the scheduler reads each
   step), started when the gauntlet begins and stopped when it ends.

---

## Stage 02 — Settle (correct-answer cue)

A **relief** cue, not a celebration: softer/warmer than the app's bright `correct`, so a right answer
reads as *survival* ("phew, next") rather than triumph. A gentle suspension resolving **downward**
over a held warm third.

Voices (times relative to cue start `t0`):

| Voice | midi | at | dur | gain | type | attack |
|-------|-----:|---:|----:|-----:|------|-------:|
| Warm bed | E5 (76) | 0 | 0.44 | 0.07 | sine | 0.03 |
| Suspension | A5 (81) | 0 | 0.14 | 0.10 | triangle | 0.012 |
| Resolution | G5 (79) | 0.12 | 0.34 | 0.12 | triangle | 0.02 |

**Cue reverb:** a short, bright reverb (1.6 s, decay 3.0), send **0.16**.

It lands in the same G5 register as the current `correct`, so it still reads as "correct" — it just
softens the attack and warms the landing.

---

## Stage 03 — Descending Bells (fatal-miss end-jingle)

The run-ending marker. A struck-bell knell of three bells **falling A2→F2→D2**, with the volume
**reversed to fade loud→soft** — a strong opening strike that recedes into a quiet, long-ringing
final D. Weightier than the everyday `wrong` sag, but never a harsh buzzer.

**The `bell` voice** — a sum of inharmonic sine partials (minor-third *tierce* = somber). Ratios of
the fundamental, with `[ratio, gain×, dur×]`:

```
[0.5, 0.42, 1.00]   [1.0, 1.00, 0.95]   [1.2, 0.55, 0.78]
[1.5, 0.40, 0.62]   [2.0, 0.30, 0.48]   [2.4, 0.18, 0.38]
```

The jingle (times from `t0`):

| Bell | fund | at | dur | gain | + body |
|------|------|---:|----:|-----:|--------|
| A2 (loudest) | `hz(45)` | 0 | 1.8 | **0.15** | `drum` `hz(45)·1.3 → hz(20)` dur 0.7 gain 0.3 |
| F2 | `hz(41)` | 0.55 | 1.9 | 0.11 | — |
| D2 (softest, longest) | `hz(38)` | 1.15 | 2.8 | **0.075** | — |

**Cue reverb:** long (3.2 s, decay 2.4), send **0.28**.

### The fatal-miss sequence

On the losing answer:

1. **Cut the bed** — fade the bed bus to silence over ~**60 ms** (a clean cut, not a duck), so the
   bell rings in silence. *(Duck-vs-cut is an [open decision](#open-decisions); the prototype cuts.)*
2. Play the existing **`wrong`** cue (sine `hz(53) → hz(50)`, dur 0.3, gain 0.14) — the answer being graded.
3. After **~0.48 s**, play **Descending Bells**.

Today a failed run plays *only* the `wrong` sag and no end-jingle — this fills that gap.

---

## Stage 04 — Gauntlet FX

Two one-shot hits (the audition spread also included Advance Whoosh, Near-Miss Sting, Arena Ambience,
and Heartbeat — **all dropped**). Stage-04 cue reverb: 2.8 s, decay 2.5, send 0.22.

### Enter the Arena

A rising whoosh swelling into a deep gong and a war-horn — the gates opening.

| Element | at | params |
|---------|---:|--------|
| Whoosh | 0 | `whoosh` band-pass sweep `300 → 3400 Hz`, dur 0.85, gain 0.11, q 0.8 → reverb |
| Gong | 0.82 | `drum` `hz(38)·1.7 → hz(20)`, dur 1.0, gain 0.5 |
| Low bell | 0.82 | `bell` `hz(38)`, gain 0.09, dur 2.0 |
| War-horn swell | 0.82 | `[D2±7, A2]` `pad` saw cutoff 1200, dur 1.4, gain 0.05 |
| Sparkle | 0.80 | `noise` hp 4000, dur 0.3, gain 0.06 |

**Trigger (owner-specified flow):** *not* generic run-start. A popup offers the challenge (gated by a
cooldown — see [open decisions](#open-decisions)); **on accept → a short pause → a UI transition
effect with Enter playing → the gauntlet starts.**

### Tier-Up Surge

A rising riser into a bright minor stab and a boom — reinforces the escalation.

| Element | at | params |
|---------|---:|--------|
| Whoosh | 0 | `whoosh` band-pass sweep `400 → 4200 Hz`, dur 0.8, gain 0.075, q 0.9 → reverb |
| Pitched riser | 0 | saw sweep `hz(50) → hz(74)` over 0.8 s, low-pass 1800, peak gain 0.05 |
| Chord stab | 0.82 | `[D3, F3, A3, D4]` (`50,53,57,62`) `pluck` tri dur 0.6 gain 0.05 |
| Boom | 0.82 | `drum` `hz(38)·1.6 → hz(22)`, dur 0.5, gain 0.34 |
| Crash sheen | 0.82 | `noise` hp 5000, dur 0.3, gain 0.05 |

**Trigger:** on each **tier-up** — when `cleared` crosses a `N/10` boundary (in step with the bed).

---

## Stage 05 — Victory fanfare (the "Grandmaster" payoff)

Clearing all N earns a **ceremonial fanfare** — the moment that resolves the whole run's
**D minor into D major**. It's a bespoke replacement for the generic `perfect` sample on a clean
sweep. ~4 s, five parts. Times are relative to a landing beat `land = t0 + 0.5` (`t0` = cue start).

**1 · Anticipation** — a build into the landing:

| Element | at | params |
|---------|---:|--------|
| Timpani roll | `t0` + 0, .13, .24, .33, .40, .45 | `drum` `hz(38)·1.4 → hz(20)`, dur 0.3, gain `0.12 + i·0.045` (accelerating + crescendo) |
| Cymbal swell | `t0` | `noise` high-pass sweeping `1200 → 7000 Hz` over 0.5 s, gain → 0.06 |

**2 · The landing** (`land`):

| Element | params |
|---------|--------|
| Gong | `drum` `hz(38)·1.8 → hz(19)`, dur 1.3, gain 0.5 |
| Crash | `noise` hp 4200, dur 0.7, gain 0.08 |
| Full D-major chord | `[D3 F#3 A3 D4 F#4 A4]` = `50 54 57 62 66 69`, `pluck` tri dur 1.1 gain 0.044 |
| Low brass swell | `[D2 F#2 A2]` = `38 42 45` (detuned ±6), saw cutoff 1500, dur 2.8, gain 0.05, pad |

**3 · The heraldic call — "Ascent"** (locked, owner pick 2026-07-16) — the rising D-major arpeggio keeps climbing, then a held crown:

| Notes | at (from `land`) | params |
|-------|---:|--------|
| D4 · F#4 · A4 · D5 · F#5 · A5 | 0, .13, .26, .39, .52, .65 | `pad` saw cutoff 2300, dur 0.34, gain 0.056 |
| **held D6** (+ D5 an octave below) | .82 | saw cutoff 2600, dur 1.0, gain 0.075 / 0.046, pad — the crown |

**4 · Bell peal** — `[D5 F#5 A5 D6]` = `74 78 81 86` at `land + 0.85 + i·0.07`, `pluck` tri dur 0.55, gain 0.033.

**5 · Choir bloom** — `[D2 D3 F#3 A3 D4]` = `38 50 54 57 62` (detuned ±4) at `land + 0.15`, `pad` tri
cutoff 2400, dur 3.6, gain 0.025, attack 0.7, release 1.5 — the sustained "arrival" that holds and
resolves; a final high `D6` shimmer at `land + 1.4` (dur 1.6, gain 0.02). Cue reverb ≈ 3 s.

**Trigger:** on clearing all N (the `finalize` **pass** branch); stop/duck the bed first so the
fanfare rings clear (mirroring the fatal-miss cut). Pairs with the golden victory screen
(crowned-Orbi reveal + sunburst + confetti). *Auditioned against 5 alternative heraldic calls
(Current, Ascent, Coronation, Ascension, Hall of Champions, Noble) — "Ascent" won.*

---

## Integration / wiring points

> **Branch note (verify before implementing).** The Grandmaster Run is **phase 44**, which is *not
> merged to `main`* (on `main` it's ⬜ Not started, and there is no `Challenge.svelte`, challenge
> store, or `/challenge` route). The challenge play shell lives on the **`phase-44-mastery-challenge`**
> branch. The `Challenge.svelte:NN` line references below were read from that branch and **must be
> re-confirmed at implementation time** — they may drift as phase 44 is finished/rebased. If phase 44
> ends up implemented as a *format reusing `Play.svelte`* (as the phase-44 PRD originally proposed)
> rather than a dedicated shell, the same trigger points move into `Play.svelte`'s answer-grading and
> end-of-session logic. Treat the rows below as *functional* triggers first, file:line second.

| What | Where | Change |
|------|-------|--------|
| New cues + bed engine | [`src/ui/sound.ts`](../src/ui/sound.ts) | Add `SynthCue`s (e.g. `clear`, `fatal`, `enter`, `surge`); add the loop scheduler + `bedVoices(tier)` + bed lifecycle API |
| Correct / wrong per answer | `Challenge.svelte:127–131` (verdict effect) | Correct → play **Settle** (new cue) instead of plain `correct`; wrong → keep `wrong` |
| Run start / lose | `Challenge.svelte:66–79` (start) & `96–108` (`finalize`) | Start the bed on run start; on `finalize` **failed** branch → cut bed + **Descending Bells**; drive `tier` from `cleared` and fire **Tier-Up Surge** on each increment |
| Clear all N (win) | `Challenge.svelte:96–108` (`finalize`) **passed** branch | Stop/duck the bed → play the **Victory fanfare** (Stage 05) over the win screen |
| Accept the challenge | The challenge-launch flow (popup → `pendingChallenge`) | Play **Enter the Arena** on accept, over the short pause / UI transition |
| Prefs & unlock | `App.svelte:19–47` | Respect `Prefs.sound` (`setEnabled`) and the autoplay `unlock()`; audio must never throw or block gameplay |

The pass (clean-sweep) branch today plays the generic `perfect` sample; **Stage 05 replaces it**
with the bespoke Victory fanfare.

---

## Open decisions

- **Challenge cooldown — DECIDED (2026-07-16): once per day, always** (win or lose), resetting at **local midnight** — Wordle-style. Drives the entry-card badge + modal copy ("Available today · resets at midnight", → a countdown once used). No audio impact.
- **Settle: constant vs. grow-with-tier** — leave the correct cue constant, or add a shimmer/octave at higher tiers so it grows with the bed. *(Undecided; leaning constant.)*
- **Fatal-miss bed transition** — hard cut (~60 ms, prototype) vs. a quick duck under the bells.
- **Bells: synth vs. `.ogg`** — synthesized (zero bytes, matches the SFX path) or a small self-made `.ogg` via the existing precached jingle path. Either works.
- **Ducking amounts / bed master level** — to be tuned in-app against real cues.

---

## Non-goals / constraints

- No new runtime dependencies; no backend. Everything stays client-side and offline-first.
- Gated on the single `Prefs.sound` on/off toggle (there is no volume slider) and the autoplay
  unlock. Cues are dropped silently until unlocked; a broken audio backend must never throw.
- The Grandmaster Run does **not** feed spaced-repetition (existing decision, commit `2e9079c`);
  audio changes nothing about that.

---

## Implementation notes (2026-07-16)

Where the spec landed in code, and the deliberate simplifications made when unifying five separate
prototype pages into one engine. All parameters above are honoured; the notes below are the *shared
infrastructure* decisions that weren't in any single prototype.

**Files.**
- `src/ui/sound.bed.ts` — the pure bed model: `hz`, `SEC16`, `BED_STEPS`, `bedTierFor(cleared,total)`,
  and `bedVoices(tier, p)` (the foundation groove + 10 accumulating layers). No audio; fully unit-tested.
- `src/ui/sound.ts` — the engine: a richer declarative `Voice` (adds `kind` noise/bell/whoosh, a `pad`
  envelope, `filter` with a swept cutoff, `freqTo` pitch sweeps, `detune`, and reverb/delay `send`s),
  a single `renderVoice()` interpreter, the shared FX bus, the five new cues, and the bed lifecycle
  API (`startBed` / `setBedTier` / `stopBed` / `gauntletFatal`) with the look-ahead scheduler.
- `src/ui/routes/Challenge.svelte` — the triggers (below).

**Trigger map (re-confirmed on the branch).** `enter` + a delayed `startBed` (~950 ms) at run start
(`onMount`); `settle` on a correct clear and `gauntletFatal()` on the one miss (verdict `$effect`);
`surge` + `setBedTier` when `bedTierFor(cleared,total)` crosses a boundary (a dedicated `$effect`);
`stopBed` + `victory` on a clean sweep (`finalize` pass), `stopBed` on quit / fail. Because there is
**no visual arena transition in the current shell**, "Enter" plays at run start and the bed swells in
after a beat — the audio stands in for the transition (owner decision A, 2026-07-16).

**Shared-infrastructure decisions (not per-prototype):**
- **Reverb — one impulse, two convolvers.** The prototypes each tuned their own tail length
  (1.6–3.2 s); the engine synthesizes a *single* ~3 s impulse (decay 2.5) and feeds it to **two**
  convolvers — a **cue reverb → master** and a **bed reverb → bedBus** — so the relative wetness is
  per-voice `sendGain` (0.16–0.3) while the bed's wet stays inside the bed's bus (next bullet).
- **Lazy FX bus (post-review).** The reverb/delay/bed nodes + the ~265k-sample impulse synthesis
  build on the *first gauntlet cue or bed start*, never on the app's first-gesture `unlock()` — so
  players who never open a challenge pay nothing, and if the advanced nodes fail to build the everyday
  SFX (which route dry through `master`) keep working.
- **Compressor.** A gentle `DynamicsCompressor` (threshold −10 dB) sits `master → compressor →
  destination` to glue the dense bed; its high threshold leaves the quiet one-shot SFX untouched (and
  a backend without it falls back to `master → destination`).
- **Bed bus + ducking.** The bed (dry **and** its reverb/delay returns) rides its own `bedBus` gain
  (`BED_GAIN = 0.6`) below the master, so it can cut (~60 ms on a fatal miss) and be silenced
  instantly on mute *with no lingering wet tail*. Static gain-staging only — no dynamic per-cue duck
  yet (owner decision E); revisit live if `settle` gets buried.
- **Deferred-cue lifecycle (post-review).** `stopBed()` cancels any pending fatal-knell timer, and a
  fatal miss cancels the not-yet-fired bed swell-in — so quitting/leaving right after a miss never
  rings the knell on a later screen, and a fast miss never lets the bed start over the death reveal.
- **`drum`'s pitch drop is exponential** (`freqTo`), distinct from the everyday `wrong` cue's *linear*
  `glideTo` (preserved verbatim).

**Tunables (nudge live on 5180):** `BED_GAIN`, `MASTER_GAIN`, the compressor threshold, the reverb
impulse length/decay, `BED_START_DELAY_MS` (the Enter→bed gap, in `Challenge.svelte`), and per-voice
`sendGain`s. The open decisions above resolved to: hard-cut fatal transition (C), constant `settle`
(D), static gain-staging (E).

**Verification.** Fast loop green (`test` / `check` / `lint`); the engine is unit-tested against a
fake `AudioContext` (per-cue voice counts, the bed scheduler start/stop + mute, tier accumulation),
the pure bed model is unit-tested (tier normalization + layer growth), and `Challenge.svelte`'s
triggers are asserted with a mocked `sound`. A real-browser check (headless Chrome against the dev
server) confirms the actual Web Audio graph builds and every cue + the whole bed render without
throwing. **Audio can't be heard headless — Sami's live audition is the acceptance step.**
