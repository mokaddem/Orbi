# Phase 36 — Sound effects & jingles

**Part of:** [Geography Quiz — Main PRD](../main_PRD.md) · **Status:** ✅ Done · **Progress:** 100%
· **Track:** v2.1 — Feel & fairness

> ## ⚠️ Process requirement — clarify before building (MANDATORY)
> This PRD is **planning only**. Reading it and answering its questions is **not** a green light to
> code. The implementer MUST resolve the [Open Questions](#open-questions--to-resolve-with-the-owner)
> with the owner (Sami), present the plan, and get an **explicit "go"** before writing any
> implementation. Record answers in the Progress log. (See the callout at the top of the main PRD.)

## Goal
Give the app a **voice**: a small, cohesive set of short sound effects and musical jingles that
reinforce the bright, tactile "Orbi Play" interface. Right now the game is silent; a correct answer,
a broken streak, a finished session, an unlocked achievement — all land with no audio. The playful
look is asking for playful sound. Add feedback cues (correct / wrong), celebratory jingles (perfect
run, achievement, daily challenge, streak milestones), and light interaction ticks, all behind a
**global sound control** and a browser-**autoplay-safe unlock**, fully **offline** with **no backend**.

## The trigger (owner request)
> "Adding sound effect in the entire map. Short song and jingles would pair well with the playful
> interface." — owner

## Decisions (resolved with the owner — 2026-07-11)
- **Audio source: hybrid.** Synthesize the frequent SFX (`correct` / `wrong` / `streak`) with the Web
  Audio API (zero bytes, no licensing, offline-trivial); bundle a few **tiny, licence-clean (CC0 or
  self-made)** jingles for the celebratory moments. Bundled assets are precached by the PWA.
- **Default & control: on by default, a single master on/off toggle** — **no volume slider**. The data
  model gains only `Prefs.sound: boolean` (no `volume`). Because the only control is full mute, the
  cues are authored **gently / quiet-by-default** so on-by-default is never jarring.
- **Event-driven only** — short SFX + jingles at moments; **no looping / ambient music**.
- **Sound palette: soft marimba / chime** — warm, friendly mallet tones matching Orbi's identity.
- **Independent from "Reduce animation"** — separate controls (motion and sound are orthogonal).
- **Control location: a new Settings → "Sound" section**, mirroring the Motion section. An in-HUD mute
  is possible later, not in this phase.
- **No UI-tap sound** — cues fire on game events only, not on every button press.

### Cue set
| Cue | Fires when | Backend | Sketch |
|---|---|---|---|
| `correct` | answer graded correct | synth | warm two-note rising mallet (~200 ms) |
| `wrong` | answer graded wrong | synth | soft low muted tone — gentle, not a buzzer (~250 ms) |
| `streak` | a streak milestone (e.g. 3 / 5 / 10) | synth | short arpeggio that climbs a step each milestone |
| `finish` | session ends | bundled | brief marimba resolve (~1.5 s) |
| `perfect` | flawless run | bundled | brighter, longer flourish (~2–2.5 s) — the celebratory peak |
| `achievement` | a badge unlocks | bundled | distinct sparkle / chime (~1.5 s) |
| `daily` | Daily Challenge completed | bundled | its own small jingle so the habit moment feels special |

→ **4 tiny bundled jingles** (`finish`, `perfect`, `achievement`, `daily`) + **3 synth cues**
(`correct`, `wrong`, `streak`). No UI-tap cue.

## Current state (so scope is clear)
- **There is no audio anywhere in the codebase** — no `<audio>`, no Web Audio, no assets, no deps
  (`grep -riE "audio|sound|\.mp3|\.ogg|howler" src` → nothing).
- **A clean precedent exists for a global A/V preference:** the Phase 33 **`reduceMotion`** flag is a
  boolean in `Prefs` (`src/data/persistence/types.ts`), defaulted in `DEFAULT_PREFS`, coerced in
  `clampPrefs`, edited by a checkbox in `Settings.svelte`, and applied app-wide by an `$effect` in
  `App.svelte` (`document.documentElement.toggleAttribute('data-reduce-motion', …)`). A sound/mute
  preference should follow this exact shape (minus the root attribute — audio is gated in a service,
  not via CSS).
- **The trigger points already exist** and produce clean signals to hook onto:
  - `play.answer()` (`src/ui/stores/game.ts`) returns a `QuestionResult` with `.correct` — the
    correct/wrong cue fires from `onPick` / `onMapPick` / `submitMulti` in `Play.svelte`.
  - The live session state exposes `state.streak` (a streak beat / rising pitch).
  - `onContinue()` detects `finished` and routes to the Summary — the session-complete / perfect-run
    jingle.
  - Phase 33's reactive layer already fires **achievement-unlock** and **streak** celebration beats
    (mascot poses proud / cheer) on Summary/Home — the natural pairing for jingles.
  - The **Daily Challenge** completion (`saveDailyResult`) is a distinct celebratory moment.
- Auto-advance timings are fixed: `CORRECT_MS = 1500`, `REVEAL_MS = 4500` (`Play.svelte`) — every cue
  must comfortably fit inside its moment (short SFX ≤ ~600 ms; the end-of-session jingle ≤ ~2.5 s).

## In scope
- A small **sound service** (`src/ui/sound.ts` or `src/ui/stores/sound.ts`) — a thin, UI-layer,
  framework-light module that plays a **named cue** (`correct`, `wrong`, `streak`, `finish`,
  `perfect`, `achievement`, `daily` — see the cue set above), gated on the sound preference and on the
  autoplay unlock. Kept out of the pure domain layer.
- **Autoplay-safe unlock**: create/resume the audio backend on the **first user gesture** (browsers
  block audio until then); before that, cues are silently dropped, never queued to blast later.
- **A global sound preference** in `Prefs` (mirroring `reduceMotion`): default, `clampPrefs` coercion,
  a **Settings** control (a new "Sound" section), persisted to IndexedDB.
- **Wiring the cues** at the existing feedback points listed above (answer verdict, streak, finish /
  perfect, achievement unlock, daily complete) — presentation only; no change to scoring, SR, or
  history.
- **Trilingual (EN/FR/DE) Settings copy** for the new control(s) — the `messages.test.ts` key-parity
  test must stay green.
- **Offline**: whatever audio ships must be **precached by the PWA service worker** so sound works
  with no connection (or be synthesized, so there's nothing to cache — see Open Questions).
- **Tests**: unit-test the sound service (right cue per event, silent when the pref is off, no-op
  before unlock, no throw when the audio backend is unavailable) with the backend mocked.

## Out of scope (deliberately)
- **No background/ambient music loop** unless the owner asks for one (see OQ4) — this phase is
  event-driven SFX + short jingles.
- No per-cue volume mixing UI beyond a single master control (a simple on/off, or on/off + one volume
  — decided in OQ3).
- No changes to gameplay logic, timings, scoring, SR, or the visual layer.
- No voiceover / narration / spoken country names (a separate idea, not requested here).
- No new game mode or map behaviour (map *selection* difficulty is **Phase 37**).

## Depends on
Phase 2 (quiz engine / feedback signals), Phase 9 (PWA — service-worker precaching of any audio
assets), Phase 16 (achievements) and Phase 33 (the reactive celebration beats jingles pair with).
Independent of Phase 37; either can go first.

## Deliverables checklist
- [x] `Prefs.sound` (boolean) added to `types.ts`, `DEFAULT_PREFS` (default `true`), and `clampPrefs`
      (coerce to boolean, **defaulting an absent legacy value to on**, not off). **No `volume` field.**
- [x] Sound service (`src/ui/sound.ts`) that plays the named cues, gated on `Prefs.sound` + the autoplay
      unlock, resilient when audio is unavailable (never throws, never blocks the UI). Cues authored
      gently — a low master gain + quiet per-voice levels. Backend injectable for tests.
- [x] First-gesture unlock wired once at the app shell (`App.svelte`, `pointerdown`/`keydown`, once).
- [x] Cues wired at: correct / wrong verdict + streak milestone (`Play.svelte`), session finish /
      perfect run / daily-challenge complete (`Play.svelte onContinue`), achievement unlock
      (`Progress.svelte`). **No UI-tap cue.** Milestone plays `streak` in place of `correct` (no
      overlap); daily takes precedence over finish/perfect at session end.
- [x] 3 synth cues (`correct` / `wrong` / `streak`) + **4 tiny self-made jingles** (`finish` / `perfect`
      / `achievement` / `daily`, 11–20 KB `.ogg`), rendered by `scripts/gen-jingles.mjs` (CC0), added to
      the vite-pwa precache glob (`ogg`) — **verified served from cache offline**.
- [x] **Settings → "Sound"** section: a single master on/off toggle, mirroring the Motion section.
- [x] EN/FR/DE Settings strings; `messages.test.ts` parity green.
- [x] Unit tests for the sound service (`src/ui/sound.test.ts`): synth cue plays, streak arpeggio,
      muted-is-silent, pre-unlock no-op, safe when unavailable, jingle-after-decode, drop-before-decode,
      debounce, re-enable. Plus a `clampPrefs` legacy-default test.
- [x] Verified in the real app (headless Chrome via CDP) with sound on (verdict cue fires an oscillator
      on a real answer) and off (silent, `osc:0`, pref persists a reload), on dev **and** the production
      build, and **offline** (jingle served `200 audio/ogg` from cache; app shell reloads offline).

## Technical notes
- **Synthesis vs. bundled files is the pivotal decision (OQ1).** Web Audio (oscillator/gain
  envelopes) is **zero bytes, offline-trivial, no licensing**, and fits crisp UI blips well, but a
  composed "short song" jingle is far easier as a small bundled `.ogg`/`.mp3`. A pragmatic split:
  **synthesize the frequent SFX** (`correct` / `wrong` / `streak`) and **bundle four tiny jingles**
  (`finish` / `perfect` / `achievement` / `daily`). Bundled audio must be added to the vite-pwa
  precache glob so it's available offline, and kept tiny to protect the "lean and self-contained"
  pillar.
- **Autoplay policy**: an `AudioContext` starts `suspended` and must be `resume()`d inside a user
  gesture; an `<audio>` element must first `play()` from a gesture. Unlock once on first interaction,
  then cues are free. Cues that fire before the unlock (unlikely — the first cue follows a tap) are
  dropped, not queued.
- **Keep it a UI-layer concern.** The domain layer stays pure and silent; the service is imported only
  by Svelte components/stores and is fully mockable in tests (inject the backend, or feature-detect
  and no-op under jsdom/Vitest).
- **Don't create a cacophony**: debounce/one-shot per event; never overlap the same cue; the
  finish/perfect jingle supersedes the last per-question cue.
- **Sound is additive feedback, never the only channel** — the visual verdict/reveal already carries
  the meaning (good for a11y and muted play), so muting loses nothing but delight.
- **Relationship to `reduceMotion`**: keep it a *separate* control (a user may want motion but silence,
  or vice-versa). Decide in OQ5 whether `reduceMotion` should also imply muted (recommend: no, keep
  orthogonal, but a combined "reduce motion **and** sound" is worth a thought).

## Open Questions — resolved
All open questions were resolved with the owner on **2026-07-11** (see **Decisions** above):
- **OQ1 audio source** → **hybrid** (synth SFX + bundled jingles).
- **OQ2 cue set** → the **cue-set table** — no UI-tap cue; daily-complete gets its own jingle.
- **OQ3 control & default** → **on by default, single on/off toggle, no volume slider.**
- **OQ4 ambient music** → **none** — event-driven only.
- **OQ5 vs. Reduce-animation** → **independent controls.**
- **OQ6 palette** → **soft marimba / chime.**
- **OQ7 placement** → **Settings → "Sound" section** (in-HUD mute deferred).

## Acceptance criteria
- With sound **on**, a correct answer, a wrong answer, a finished session (and a perfect run), an
  achievement unlock, and a completed daily challenge each play a fitting, non-overlapping cue that
  ends within its moment.
- With sound **off**, the app is completely silent and behaves exactly as today.
- Audio only ever starts after a user gesture (no console autoplay warnings; nothing blasts on load).
- Everything works **offline** from the preview/PWA build (:5181) — no network fetch for audio.
- The preference persists across reloads; the Settings control reads and writes it.
- Fast loop green (`npm run test` / `check` / `lint`); EN/FR/DE render; a manual audio check with the
  toggle on and off.

## Progress log
- **2026-07-11 — Built & verified (✅ Done; awaiting merge).** Implemented on the locked decisions.
  `Prefs.sound` (default on, absent→on) in `types.ts`; sound service `src/ui/sound.ts` — lazy
  `AudioContext`, first-gesture unlock (`App.svelte`), gentle synth `correct`/`wrong`/`streak` (low
  master gain) and decoded-buffer jingles, injectable backend, never-throws. Four self-made marimba
  jingles (`finish`/`perfect`/`achievement`/`daily`, 11–20 KB `.ogg`) rendered by
  `scripts/gen-jingles.mjs`; `ogg` added to the PWA precache glob. Cues wired in `Play.svelte`
  (verdict + streak milestone; finish/perfect/daily at session end) and `Progress.svelte` (badge
  unlock). Settings "Sound" section + EN/FR/DE strings. Tests: 10 sound-service cases + a clampPrefs
  legacy-default case (full suite **512 → 512+** green); `check` + `lint` clean. Real-app CDP checks:
  unlock only after a gesture; a real answer fires an oscillator with sound on and **nothing** with it
  off (pref persists a reload); passes on dev and the production build; **offline** the jingle is
  served `200 audio/ogg` from the SW cache and the shell reloads. No console errors. **NOT yet
  merged/archived** — archive after merge per the main-PRD process.
- **2026-07-11 — Clarifying round complete; all open questions resolved.** Owner locked: **hybrid**
  audio (synth SFX + bundled jingles), **on by default with a single on/off toggle** (no volume — so
  cues must be authored gently), **event-driven only** (no ambient music), **soft marimba/chime**
  palette, sound **independent** of Reduce-animation, control in a **Settings "Sound" section**, and
  **no UI-tap cue** (daily-complete gets its own jingle). Final cue set = 3 synth (`correct` / `wrong`
  / `streak`) + 4 tiny bundled jingles (`finish` / `perfect` / `achievement` / `daily`). PRD updated
  with a Decisions section + cue table; deliverables trimmed accordingly. **Still NOT built — awaiting
  explicit build approval.**
- **2026-07-11 — PRD drafted** from the owner's request to add sound effects and jingles across the
  app. Grounded in the current codebase: **no audio exists yet**; the Phase 33 `reduceMotion` pref is
  the template for a global sound preference (`Prefs` → `Settings.svelte` → `App.svelte` `$effect`);
  the feedback trigger points (`play.answer().correct`, `state.streak`, `onContinue` finish, Phase 33
  achievement/streak beats, daily completion) are already in place to hook cues onto. Central open
  question is **synthesized Web Audio vs. bundled files** (footprint / licensing / offline). **NOT
  built** — awaiting the clarifying round and explicit build approval.
</content>
</invoke>
