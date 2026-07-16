// Sound service (Phase 36; extended for the Grandmaster Challenge in Phase 44) — the app's "voice".
//
// A thin, UI-layer module that plays a *named cue* at the existing feedback moments. It is
// deliberately kept out of the pure domain layer: the domain stays silent and testable, and
// this file is the only place that touches Web Audio. It is:
//   • gated on the sound preference (`Prefs.sound`) — a single master on/off, no volume, and
//   • gated on an autoplay-safe unlock — browsers block audio until the first user gesture, so
//     cues are silently dropped (never queued) until `unlock()` runs inside a gesture.
// Everything is wrapped so a missing/broken audio backend never throws or blocks the UI.
//
// Hybrid audio (owner decision, 2026-07-11): the short SFX (`correct` / `wrong` / `streak` / `blitz`
// / the clock cues) *and* the everyday session-complete flourish (`finish`) are *synthesized* with
// the Web Audio API — zero bytes, no licensing, offline-trivial — while the remaining celebratory
// jingles (`perfect` / `achievement` / `daily`) are tiny self-made marimba renders bundled as `.ogg`
// and precached by the service worker. `finish` was a marimba render too until the owner preferred a
// synthesized "music box" flourish (2026-07-15). Cues are authored gently/quiet-by-default (a low
// master gain) so on-by-default is never jarring.
//
// Phase 44 adds the **Grandmaster Challenge** audio (locked design — `docs/gauntlet-audio-spec.md`):
// four one-shot cues (`settle` / `fatal` / `enter` / `surge`), a ceremonial `victory` fanfare, and
// the first *looping* music the engine has carried — "the Rising Bed" (`sound.bed.ts` + the
// look-ahead scheduler below). To render these the voice vocabulary grows filters, noise, bells,
// swept whooshes and a pad envelope, plus a shared reverb / delay / compressor FX bus.

import perfectUrl from './assets/sound/perfect.ogg?url';
import achievementUrl from './assets/sound/achievement.ogg?url';
import dailyUrl from './assets/sound/daily.ogg?url';
import { STREAK_MILESTONES } from './streak';
import { BLITZ_MAX_COMBO } from '../domain';
import { hz, SEC16, BED_STEPS, bedVoices } from './sound.bed';

/**
 * Synthesized short SFX. `tick` / `timesup` are the Blitz clock cues (Phase 42); `blitz` is the
 * Blitz per-correct-answer cue, escalating with the live combo multiplier (replacing the shared
 * `streak` celebration inside Blitz). `finish` — the everyday session-complete flourish — is
 * synthesized too (a "music box" cue; owner pick 2026-07-15), unlike its `perfect` sibling. The
 * Grandmaster Challenge cues (Phase 44): `settle` (the relief-tinged correct cue), `fatal` (the
 * descending-bell knell that ends a run), `enter` (the arena hit on accepting), `surge` (a tier-up
 * hit), and `victory` (the D-major fanfare on a clean sweep).
 */
export type SynthCue =
  | 'correct'
  | 'wrong'
  | 'streak'
  | 'tick'
  | 'timesup'
  | 'blitz'
  | 'finish'
  | 'settle'
  | 'fatal'
  | 'enter'
  | 'surge'
  | 'victory';
/** Bundled marimba jingles. */
export type JingleCue = 'perfect' | 'achievement' | 'daily';
export type SoundCue = SynthCue | JingleCue;

const JINGLE_CUES: readonly JingleCue[] = ['perfect', 'achievement', 'daily'];

/**
 * Options for a played cue. `level` is the 0-based tier for the escalating cues — the sticky
 * `streak` tier (see `streakVoices`) or the Blitz combo tier (see `blitzVoices`).
 */
export interface PlayOpts {
  level?: number;
}

/** Platform bits the service needs — injectable so tests can substitute a fake backend. */
export interface SoundDeps {
  /** `AudioContext` constructor, or `null` when Web Audio is unavailable (SSR / jsdom). */
  AudioCtx: (new () => AudioContext) | null;
  /** Bundled asset URL per jingle cue. */
  sampleUrls: Record<JingleCue, string>;
  /** Fetch + decode a sample URL into an `AudioBuffer`. Overridable in tests. */
  loadSample?: (ctx: AudioContext, url: string) => Promise<AudioBuffer>;
}

export interface SoundController {
  /** Reflect the `Prefs.sound` master toggle. When off, every cue — and the bed — is silent. */
  setEnabled(enabled: boolean): void;
  /** Create/resume the audio backend inside a user gesture; safe to call repeatedly. */
  unlock(): void;
  /** Play a named cue, if enabled and unlocked; otherwise a no-op. Never throws. */
  play(cue: SoundCue, opts?: PlayOpts): void;
  /** Start the Grandmaster Challenge's looping bed at tier 0 (Phase 44). Safe pre-unlock. */
  startBed(): void;
  /** Set the bed's live intensity tier (0..9); the caller normalizes progress → tier. */
  setBedTier(tier: number): void;
  /** Fade the bed to silence over `fadeMs` (default gentle) and stop the scheduler. */
  stopBed(fadeMs?: number): void;
  /** The fatal-miss sequence: cut the bed, play `wrong`, then (after a beat) the descending bells. */
  gauntletFatal(): void;
}

// ---- Cue authoring ---------------------------------------------------------------------

/** Master attenuation — keeps every cue gentle, since there's no volume slider. */
const MASTER_GAIN = 0.45;

/**
 * Extra attenuation for the bundled jingles only (`perfect` / `achievement` / `daily`). They're
 * recorded samples that land louder than the quiet synth SFX, so they're pulled down relative to
 * the per-answer cues. Applied on top of {@link MASTER_GAIN}; nudge this to retune. Owner feedback
 * trimmed it twice: 1.0 → 0.6 (mode-complete jingle a touch too loud), then 0.6 → 0.35 (the
 * end-of-session `finish` render was still too loud, 2026-07-14 — that cue is now synthesized).
 */
const JINGLE_GAIN = 0.35;

/**
 * The Rising Bed's bus level, below the master so the bed sits under the answer cues. It is also
 * the node the bed ducks / cuts on — a fatal miss ramps it to silence in ~60 ms so the knell rings
 * clear. Tune in-app against real cues (see the audio spec's "ducking amounts" open item).
 */
const BED_GAIN = 0.6;

interface Voice {
  /** Sound source. `osc` (default) = an oscillator; `noise`/`whoosh` = filtered noise; `bell` = a
   * sum of inharmonic sine partials (see {@link BELL_PARTIALS}). */
  kind?: 'osc' | 'noise' | 'bell' | 'whoosh';
  /** Frequency in Hz — the oscillator pitch, or the bell fundamental. */
  freq: number;
  /** Start offset from the cue's t0, seconds. */
  at: number;
  /** Duration, seconds. */
  dur: number;
  /** Peak gain (pre-master), ~0..0.6. */
  gain: number;
  type?: OscillatorType;
  /** Exponential pitch sweep to this frequency by the note's end (membrane drops, the surge riser). */
  freqTo?: number;
  /** Linear pitch glide to this frequency by the note's end (the soft "wrong" bend). */
  glideTo?: number;
  /** Envelope shape: `perc` (default, the marimba attack/decay) or `pad` (attack/hold/release). */
  env?: 'perc' | 'pad';
  /** Pad attack, seconds (env === 'pad'). */
  attack?: number;
  /** Pad release, seconds (env === 'pad'); defaults to a fraction of `dur`. */
  release?: number;
  /** Detune in cents — for stacked/detuned pad voices (horns, choir). */
  detune?: number;
  /** Optional filter in the voice's chain, with an optional swept cutoff (whoosh / cymbal). */
  filter?: { type?: BiquadFilterType; freq: number; q?: number; freqTo?: number };
  /** Route a copy through a shared FX send, in addition to the dry signal. */
  send?: 'reverb' | 'delay';
  /** The send level (0..1); defaults per send. */
  sendGain?: number;
}

export type { Voice };

/** Bell partial table: `[ratio, gain×, dur×]` — a minor-third *tierce* gives a somber cast. */
const BELL_PARTIALS: readonly (readonly [number, number, number])[] = [
  [0.5, 0.42, 1.0],
  [1.0, 1.0, 0.95],
  [1.2, 0.55, 0.78],
  [1.5, 0.4, 0.62],
  [2.0, 0.3, 0.48],
  [2.4, 0.18, 0.38],
];

/** Build the voices for a synth cue. Kept pure so it's trivial to reason about / test. */
function synthVoices(cue: SynthCue, level = 0): Voice[] {
  switch (cue) {
    case 'correct': {
      // Warm two-note rising mallet (~200 ms): a cheerful jump up a fifth.
      return [
        { freq: hz(72), at: 0, dur: 0.18, gain: 0.16, type: 'triangle' }, // C5
        { freq: hz(79), at: 0.09, dur: 0.2, gain: 0.18, type: 'triangle' }, // G5
      ];
    }
    case 'wrong': {
      // Soft, low, muted tone that gently sags — a mellow "not quite", never a buzzer (~250 ms).
      return [{ freq: hz(53), at: 0, dur: 0.3, gain: 0.14, type: 'sine', glideTo: hz(50) }];
    }
    case 'tick': {
      // Blitz final-seconds heartbeat (Phase 42): a single crisp high blip (~60 ms). Fired once per
      // second over the last five, so it stays a soft urgency rather than nagging. Gain doubled
      // 0.06 → 0.12 (owner feedback, 2026-07-15): the ×1 level was too easy to miss under the HUD.
      return [{ freq: hz(90), at: 0, dur: 0.05, gain: 0.12, type: 'triangle' }];
    }
    case 'timesup': {
      // Blitz "time's up" (Phase 42): a short descending three-note fall — a clear, gentle "done"
      // that's distinct from the wrong-answer sag and the celebratory jingles (~360 ms).
      return [
        { freq: hz(72), at: 0, dur: 0.14, gain: 0.14, type: 'triangle' }, // C5
        { freq: hz(67), at: 0.12, dur: 0.14, gain: 0.14, type: 'triangle' }, // G4
        { freq: hz(60), at: 0.24, dur: 0.22, gain: 0.15, type: 'triangle' }, // C4
      ];
    }
    case 'blitz':
      return blitzVoices(level);
    case 'streak':
      return streakVoices(level);
    case 'finish': {
      // Session complete (owner pick, 2026-07-15): a delicate "music box" flourish — a high three-note
      // motif (E5–G5–C6) that resolves onto an airy octave with a faint top sparkle (~1 s). Replaces the
      // former finish.ogg marimba render; plays through the same synth path as the other SFX (no jingle
      // gain), so it lands at the gentle level the owner auditioned.
      const tri: OscillatorType = 'triangle';
      return [
        { freq: hz(76), at: 0, dur: 0.22, gain: 0.1, type: tri }, // E5
        { freq: hz(79), at: 0.16, dur: 0.22, gain: 0.1, type: tri }, // G5
        { freq: hz(84), at: 0.32, dur: 0.22, gain: 0.1, type: tri }, // C6
        { freq: hz(72), at: 0.5, dur: 0.6, gain: 0.07, type: tri }, // C5 — resolve
        { freq: hz(84), at: 0.5, dur: 0.6, gain: 0.06, type: tri }, // C6 octave
        { freq: hz(79), at: 0.5, dur: 0.5, gain: 0.05, type: tri }, // G5 fifth
        { freq: hz(88), at: 0.58, dur: 0.4, gain: 0.04, type: tri }, // E6 sparkle
      ];
    }
    case 'settle':
      return settleVoices();
    case 'fatal':
      return fatalVoices();
    case 'enter':
      return enterVoices();
    case 'surge':
      return surgeVoices();
    case 'victory':
      return victoryVoices();
  }
}

/**
 * The Blitz combo cue (this task) — the per-correct-answer celebration in a Blitz run, escalating
 * with the *live combo multiplier* rather than the streak milestones (Blitz is decoupled from the
 * learning model, so it wants its own voice). `level` is the 0-based combo tier: 0 = x1 …
 * {@link BLITZ_MAX_COMBO} - 1 = the top. It grows by density and brightness like the streak cue, but
 * stays deliberately *snappy* (≤ ~0.35 s) to sit inside Blitz's near-instant advance: a brisk rising
 * mallet run that gains notes and climbs a whole step per tier, an octave sparkle from x4, and a
 * bright major-chord stab at the top multiplier.
 */
function blitzVoices(level: number): Voice[] {
  const tier = Math.max(0, Math.min(BLITZ_MAX_COMBO - 1, level)); // 0..4 (x1..x5)
  const root = 72 + tier * 2; // C5, climbing a whole step per tier
  const tri: OscillatorType = 'triangle';
  const step = 0.05; // tight arpeggio spacing — brisk, never draggy
  const voices: Voice[] = [];

  // Ascending run — a bare rising fifth at x1, filling to a triad, then a full octave from x3.
  const arp = tier >= 2 ? [0, 4, 7, 12] : tier >= 1 ? [0, 4, 7] : [0, 7];
  arp.forEach((semi, i) => {
    voices.push({ freq: hz(root + semi), at: i * step, dur: 0.14, gain: 0.16, type: tri });
  });
  const after = arp.length * step;

  // x4+: a delayed high sparkle (the fifth, an octave up) that rings a touch longer.
  if (tier >= 3) {
    voices.push({ freq: hz(root + 19), at: after, dur: 0.2, gain: 0.1, type: tri });
  }
  // x5: a bright major-chord stab — the peak payoff.
  if (tier >= 4) {
    const stabAt = after + 0.04;
    for (const semi of [0, 4, 7, 12]) {
      voices.push({ freq: hz(root + semi), at: stabAt, dur: 0.24, gain: 0.08, type: tri });
    }
  }

  return voices;
}

/**
 * The escalating streak cue (Phase 39; extended to streak 50). Tier `level` (0..8, sticky — see
 * `streakTier`) builds a progressively grander mallet flourish, escalating by *density, depth and
 * brightness* rather than volume (per-voice gains stay low, so every tier peaks gently — there is no
 * volume slider). Stays ≤ ~1.1 s at the top, well inside the correct-answer dwell.
 *
 *   tier 0  triad arpeggio (the original cue)
 *   tier 1  + a resolving octave on top
 *   tier 2  + a low bass root (body) and a fuller run up to the octave
 *   tier 3  + a delayed high sparkle and a faint detuned shimmer
 *   tier 4  + a final sustained major-chord stab
 *   tier 5  + a deep sub-bass octave (weight)
 *   tier 6  + a higher arpeggio run and a rhythmic top-octave echo
 *   tier 7  + a sustained warm pad and a fuller chord stab
 *   tier 8  + a brighter, longer blooming stab — the peak
 *
 * The whole cue climbs a whole step per tier through tier 4 (the base feel), then more gently
 * (+1 semitone/tier) so the high tiers stay bright without turning shrill.
 */
function streakVoices(level: number): Voice[] {
  const tier = Math.max(0, Math.min(STREAK_TIER_MAX, level));
  const root = 72 + (tier <= 4 ? tier * 2 : 8 + (tier - 4)); // C5, climbing (whole steps, then half)
  const step = 0.065; // arpeggio note spacing
  const tri: OscillatorType = 'triangle';
  const voices: Voice[] = [];

  // Core ascending arpeggio — a triad low, a run to the octave from tier 2, a higher run from tier 6.
  const arp = tier >= 6 ? [0, 4, 7, 12, 16] : tier >= 2 ? [0, 4, 7, 12] : [0, 4, 7];
  arp.forEach((semi, i) => {
    voices.push({ freq: hz(root + semi), at: i * step, dur: 0.16, gain: 0.14, type: tri });
  });
  const afterArp = arp.length * step;

  // tier 1+: a resolving top octave that rings a touch longer.
  if (tier >= 1) {
    voices.push({ freq: hz(root + 12), at: afterArp, dur: 0.22, gain: 0.13, type: tri });
  }
  // tier 2+: a soft low bass root, one octave down, for body.
  if (tier >= 2) {
    voices.push({ freq: hz(root - 12), at: 0, dur: 0.32, gain: 0.12, type: 'sine' });
  }
  // tier 3+: a delayed high sparkle (the fifth, an octave up) + a faint detuned shimmer.
  if (tier >= 3) {
    voices.push({ freq: hz(root + 19), at: afterArp + 0.05, dur: 0.2, gain: 0.08, type: tri });
    voices.push({ freq: hz(root + 12) * 1.006, at: afterArp, dur: 0.22, gain: 0.05, type: tri });
  }
  // tier 5+: a deep sub-bass octave for weight. tier 7+: a sustained warm pad underneath.
  if (tier >= 5) {
    voices.push({ freq: hz(root - 24), at: 0, dur: 0.42, gain: 0.1, type: 'sine' });
  }
  if (tier >= 7) {
    voices.push({ freq: hz(root - 12), at: 0, dur: 0.6, gain: 0.06, type: 'sine' });
  }
  // tier 6+: a rhythmic echo of the top octave — a little bounce before the stab.
  if (tier >= 6) {
    voices.push({ freq: hz(root + 12), at: afterArp + 0.14, dur: 0.18, gain: 0.07, type: tri });
  }
  // tier 4+: a final sustained major-chord stab. It grows fuller (tier 7+) and brighter/longer
  // (tier 8) as the peak, with per-voice gain eased down so the bigger chord still lands gently.
  if (tier >= 4) {
    const stabAt = afterArp + (tier >= 6 ? 0.28 : step) + 0.02;
    const stab = tier >= 8 ? [0, 4, 7, 12, 16, 19] : tier >= 7 ? [0, 4, 7, 12, 16] : [0, 4, 7, 12];
    const stabDur = tier >= 8 ? 0.42 : 0.3;
    const stabGain = tier >= 7 ? 0.06 : 0.07;
    for (const semi of stab) {
      voices.push({ freq: hz(root + semi), at: stabAt, dur: stabDur, gain: stabGain, type: tri });
    }
  }

  return voices;
}

/** Highest streak tier index — tracks {@link STREAK_MILESTONES} so the two never drift. */
const STREAK_TIER_MAX = STREAK_MILESTONES.length - 1;

// ---- Grandmaster Challenge cues (Phase 44; params locked in docs/gauntlet-audio-spec.md) --------

/**
 * `settle` — the correct-answer cue in a run: *relief*, not triumph. A gentle suspension (A5)
 * resolving downward to G5 over a held warm E5, so a right answer reads as "phew, survived — next"
 * rather than a celebration. Lands in the same register as the everyday `correct`, softened.
 */
function settleVoices(): Voice[] {
  const rv = 0.16; // shared reverb send — a little air
  return [
    {
      freq: hz(76),
      at: 0,
      dur: 0.44,
      gain: 0.07,
      type: 'sine',
      env: 'pad',
      attack: 0.03,
      release: 0.2,
      send: 'reverb',
      sendGain: rv,
    }, // warm bed E5
    {
      freq: hz(81),
      at: 0,
      dur: 0.14,
      gain: 0.1,
      type: 'triangle',
      env: 'pad',
      attack: 0.012,
      release: 0.08,
      send: 'reverb',
      sendGain: rv,
    }, // suspension A5
    {
      freq: hz(79),
      at: 0.12,
      dur: 0.34,
      gain: 0.12,
      type: 'triangle',
      env: 'pad',
      attack: 0.02,
      release: 0.16,
      send: 'reverb',
      sendGain: rv,
    }, // resolution G5
  ];
}

/**
 * `fatal` — the descending-bell knell that ends a run. Three struck bells falling A2→F2→D2 with the
 * volume *reversed* to fade loud→soft: a strong opening strike (with a low body thump) receding into
 * a quiet, long-ringing final D. Weightier than the everyday `wrong` sag, but never a harsh buzzer.
 */
function fatalVoices(): Voice[] {
  const rv = 0.28;
  return [
    { kind: 'bell', freq: hz(45), at: 0, dur: 1.8, gain: 0.15, send: 'reverb', sendGain: rv }, // A2 (loudest)
    { kind: 'osc', type: 'sine', freq: hz(45) * 1.3, freqTo: hz(20), at: 0, dur: 0.7, gain: 0.3 }, // body thump
    { kind: 'bell', freq: hz(41), at: 0.55, dur: 1.9, gain: 0.11, send: 'reverb', sendGain: rv }, // F2
    { kind: 'bell', freq: hz(38), at: 1.15, dur: 2.8, gain: 0.075, send: 'reverb', sendGain: rv }, // D2 (softest, longest)
  ];
}

/** `enter` — the arena hit on accepting the challenge: a rising whoosh into a deep gong + war-horn. */
function enterVoices(): Voice[] {
  const rv = 0.22;
  const horn = (midi: number, detune: number): Voice => ({
    kind: 'osc',
    type: 'sawtooth',
    freq: hz(midi),
    detune,
    at: 0.82,
    dur: 1.4,
    gain: 0.05,
    env: 'pad',
    attack: 0.2,
    release: 0.4,
    filter: { type: 'lowpass', freq: 1200 },
  });
  return [
    {
      kind: 'whoosh',
      freq: 300,
      at: 0,
      dur: 0.85,
      gain: 0.11,
      env: 'pad',
      attack: 0.35,
      release: 0.3,
      filter: { type: 'bandpass', freq: 300, freqTo: 3400, q: 0.8 },
      send: 'reverb',
      sendGain: rv,
    },
    {
      kind: 'osc',
      type: 'sine',
      freq: hz(38) * 1.7,
      freqTo: hz(20),
      at: 0.82,
      dur: 1.0,
      gain: 0.5,
    }, // gong
    { kind: 'bell', freq: hz(38), at: 0.82, dur: 2.0, gain: 0.09, send: 'reverb', sendGain: rv }, // low bell
    horn(38, -7), // war-horn swell [D2±7, A2]
    horn(38, 7),
    horn(45, 0),
    {
      kind: 'noise',
      freq: 4000,
      at: 0.8,
      dur: 0.3,
      gain: 0.06,
      filter: { type: 'highpass', freq: 4000 },
    }, // sparkle
  ];
}

/** `surge` — the tier-up hit: a rising riser into a bright D-minor stab and a boom. */
function surgeVoices(): Voice[] {
  const rv = 0.22;
  const stab = (midi: number): Voice => ({
    freq: hz(midi),
    at: 0.82,
    dur: 0.6,
    gain: 0.05,
    type: 'triangle',
  });
  return [
    {
      kind: 'whoosh',
      freq: 400,
      at: 0,
      dur: 0.8,
      gain: 0.075,
      env: 'pad',
      attack: 0.3,
      release: 0.2,
      filter: { type: 'bandpass', freq: 400, freqTo: 4200, q: 0.9 },
      send: 'reverb',
      sendGain: rv,
    },
    {
      kind: 'osc',
      type: 'sawtooth',
      freq: hz(50),
      freqTo: hz(74),
      at: 0,
      dur: 0.8,
      gain: 0.05,
      env: 'pad',
      attack: 0.05,
      release: 0.1,
      filter: { type: 'lowpass', freq: 1800 },
    }, // pitched riser
    stab(50),
    stab(53),
    stab(57),
    stab(62), // chord stab [D3 F3 A3 D4]
    {
      kind: 'osc',
      type: 'sine',
      freq: hz(38) * 1.6,
      freqTo: hz(22),
      at: 0.82,
      dur: 0.5,
      gain: 0.34,
    }, // boom
    {
      kind: 'noise',
      freq: 5000,
      at: 0.82,
      dur: 0.3,
      gain: 0.05,
      filter: { type: 'highpass', freq: 5000 },
    }, // crash sheen
  ];
}

/**
 * `victory` — the ceremonial fanfare on clearing a run: the moment that resolves the whole gauntlet's
 * D minor into **D major**. ~4 s in five parts: an accelerating timpani roll + cymbal swell into a
 * grand landing (gong + crash + full D-major chord + low brass), the heraldic "Ascent" call (a rising
 * D-major arpeggio climbing to a held crown D6), a bell peal, and a sustained choir/organ bloom.
 */
function victoryVoices(): Voice[] {
  const land = 0.5; // the landing beat (t0 + 0.5); anticipation fills the run-up
  const v: Voice[] = [];

  // 1 · Anticipation — an accelerating, crescendoing timpani roll + a bright cymbal swell.
  [0, 0.13, 0.24, 0.33, 0.4, 0.45].forEach((at, i) => {
    v.push({
      kind: 'osc',
      type: 'sine',
      freq: hz(38) * 1.4,
      freqTo: hz(20),
      at,
      dur: 0.3,
      gain: 0.12 + i * 0.045,
    });
  });
  v.push({
    kind: 'noise',
    freq: 1200,
    at: 0,
    dur: 0.5,
    gain: 0.06,
    filter: { type: 'highpass', freq: 1200, freqTo: 7000 },
  });

  // 2 · The landing — gong, crash, the full D-major chord, and a low brass swell.
  v.push({
    kind: 'osc',
    type: 'sine',
    freq: hz(38) * 1.8,
    freqTo: hz(19),
    at: land,
    dur: 1.3,
    gain: 0.5,
    send: 'reverb',
    sendGain: 0.24,
  }); // gong
  v.push({
    kind: 'noise',
    freq: 4200,
    at: land,
    dur: 0.7,
    gain: 0.08,
    filter: { type: 'highpass', freq: 4200 },
  }); // crash
  for (const m of [50, 54, 57, 62, 66, 69]) {
    v.push({
      freq: hz(m),
      at: land,
      dur: 1.1,
      gain: 0.044,
      type: 'triangle',
      send: 'reverb',
      sendGain: 0.22,
    });
  }
  for (const m of [38, 42, 45]) {
    for (const detune of [-6, 6]) {
      v.push({
        kind: 'osc',
        type: 'sawtooth',
        freq: hz(m),
        detune,
        at: land,
        dur: 2.8,
        gain: 0.05,
        env: 'pad',
        attack: 0.06,
        release: 0.8,
        filter: { type: 'lowpass', freq: 1500 },
      });
    }
  }

  // 3 · The heraldic call "Ascent" (owner pick) — the rising arpeggio keeps climbing to a held crown.
  [62, 66, 69, 74, 78, 81].forEach((m, i) => {
    v.push({
      kind: 'osc',
      type: 'sawtooth',
      freq: hz(m),
      at: land + i * 0.13,
      dur: 0.34,
      gain: 0.056,
      env: 'pad',
      attack: 0.02,
      release: 0.12,
      filter: { type: 'lowpass', freq: 2300 },
      send: 'reverb',
      sendGain: 0.2,
    });
  });
  v.push({
    kind: 'osc',
    type: 'sawtooth',
    freq: hz(86),
    at: land + 0.82,
    dur: 1.0,
    gain: 0.075,
    env: 'pad',
    attack: 0.03,
    release: 0.4,
    filter: { type: 'lowpass', freq: 2600 },
    send: 'reverb',
    sendGain: 0.22,
  }); // crown D6
  v.push({
    kind: 'osc',
    type: 'sawtooth',
    freq: hz(74),
    at: land + 0.82,
    dur: 1.0,
    gain: 0.046,
    env: 'pad',
    attack: 0.03,
    release: 0.4,
    filter: { type: 'lowpass', freq: 2600 },
  }); // D5 an octave below

  // 4 · Bell peal.
  [74, 78, 81, 86].forEach((m, i) => {
    v.push({
      freq: hz(m),
      at: land + 0.85 + i * 0.07,
      dur: 0.55,
      gain: 0.033,
      type: 'triangle',
      send: 'reverb',
      sendGain: 0.2,
    });
  });

  // 5 · Choir bloom — the sustained "arrival" that holds and resolves, + a final high shimmer.
  for (const m of [38, 50, 54, 57, 62]) {
    for (const detune of [-4, 4]) {
      v.push({
        kind: 'osc',
        type: 'triangle',
        freq: hz(m),
        detune,
        at: land + 0.15,
        dur: 3.6,
        gain: 0.025,
        env: 'pad',
        attack: 0.7,
        release: 1.5,
        filter: { type: 'lowpass', freq: 2400 },
      });
    }
  }
  v.push({
    kind: 'osc',
    type: 'triangle',
    freq: hz(86),
    at: land + 1.4,
    dur: 1.6,
    gain: 0.02,
    env: 'pad',
    attack: 0.3,
    release: 0.8,
    send: 'reverb',
    sendGain: 0.2,
  });

  return v;
}

// ---- Controller ------------------------------------------------------------------------

/**
 * Build a sound controller over the injected backend. The app uses the {@link sound} singleton;
 * tests build their own with a fake `AudioCtx` to observe cues without real audio.
 */
export function createSound(deps: SoundDeps): SoundController {
  let enabled = true;
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  // The FX bus (built once at unlock): a shared reverb + delay send, a bed bus, and a noise buffer.
  let reverbSend: GainNode | null = null;
  let delaySend: GainNode | null = null;
  let bedBus: GainNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;
  let unlocked = false;
  const samples = new Map<JingleCue, AudioBuffer>();
  /** Debounce identical cues so a double-call can't stack into a doubled hit. */
  const lastPlayed = new Map<SoundCue, number>();

  // Bed scheduler state (Phase 44). The look-ahead scheduler renders `bedVoices(liveTier, step)` a
  // window ahead on a coarse timer; `bedActive` is the *intent* (a run is on), reconciled against
  // `enabled`/`unlocked` so muting mid-run silences it and an unlock after start still catches.
  const LOOKAHEAD = 0.2; // seconds scheduled ahead
  const TICK_MS = 25; // scheduler wakeup interval
  let bedActive = false;
  let liveTier = 0;
  let stepIndex = 0;
  let nextStepTime = 0;
  let schedulerId: ReturnType<typeof setInterval> | null = null;
  let fatalTimer: ReturnType<typeof setTimeout> | null = null;

  const load =
    deps.loadSample ??
    (async (c: AudioContext, url: string): Promise<AudioBuffer> => {
      const res = await fetch(url);
      const bytes = await res.arrayBuffer();
      return await c.decodeAudioData(bytes);
    });

  function decodeAll(c: AudioContext): void {
    for (const cue of JINGLE_CUES) {
      const url = deps.sampleUrls[cue];
      if (!url) continue;
      void load(c, url)
        .then((buf) => samples.set(cue, buf))
        .catch(() => {
          /* a missing/undecodable jingle just stays silent — never fatal */
        });
    }
  }

  /** A short white-noise buffer, shared by every `noise` / `whoosh` voice (looped as needed). */
  function makeNoise(c: AudioContext): AudioBuffer {
    const len = Math.max(1, Math.floor(c.sampleRate * 2));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** A procedurally-generated reverb impulse: exponentially-decaying noise. */
  function makeImpulse(c: AudioContext, seconds: number, decay: number): AudioBuffer {
    const len = Math.max(1, Math.floor(c.sampleRate * seconds));
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  /** Wire the master → compressor → destination chain and the shared reverb / delay / bed buses. */
  function buildGraph(c: AudioContext): void {
    master = c.createGain();
    master.gain.value = MASTER_GAIN;

    // A gentle compressor glues stacked bed layers + cue peaks; its high threshold leaves the quiet
    // one-shot SFX essentially untouched, only taming the dense bed.
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 6;
    comp.ratio.value = 3;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    master.connect(comp);
    comp.connect(c.destination);

    noiseBuffer = makeNoise(c);

    // Reverb: a unity send bus → convolver → master (per-voice `sendGain` sets the wet amount).
    const conv = c.createConvolver();
    conv.buffer = makeImpulse(c, 3.0, 2.5);
    reverbSend = c.createGain();
    reverbSend.gain.value = 1;
    reverbSend.connect(conv);
    conv.connect(master);

    // Delay: a dotted-eighth feedback delay for the bed's drift / sky-echo layers.
    const delay = c.createDelay(1.0);
    delay.delayTime.value = SEC16 * 3; // dotted eighth ≈ 0.469 s
    const fb = c.createGain();
    fb.gain.value = 0.34;
    delaySend = c.createGain();
    delaySend.gain.value = 1;
    delaySend.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(master);

    // The bed rides its own bus below the master, so it can duck / cut under the cues.
    bedBus = c.createGain();
    bedBus.gain.value = BED_GAIN;
    bedBus.connect(master);
  }

  function setEnabled(next: boolean): void {
    enabled = next;
    if (ctx && bedBus) {
      // The bed is a continuous source (unlike one-shot cues gated per-play), so muting must
      // silence its bus directly; re-enabling mid-run restores it.
      const now = ctx.currentTime;
      bedBus.gain.cancelScheduledValues(now);
      bedBus.gain.setValueAtTime(next && bedActive ? BED_GAIN : 0.0001, now);
    }
    reconcileBed();
  }

  function unlock(): void {
    if (!deps.AudioCtx) return; // Web Audio unavailable — stay silent, never throw.
    try {
      if (!ctx) {
        ctx = new deps.AudioCtx();
        buildGraph(ctx);
        decodeAll(ctx);
      }
      if (ctx.state === 'suspended') void ctx.resume();
      unlocked = true;
      reconcileBed(); // a bed started before the first gesture catches up here
    } catch {
      // backend refused — leave the service fully inert (not half-built).
      ctx = null;
      master = null;
      reverbSend = null;
      delaySend = null;
      bedBus = null;
      noiseBuffer = null;
      unlocked = false;
    }
  }

  function shouldDrop(cue: SoundCue): boolean {
    if (!enabled || !unlocked || !ctx || !master) return true;
    const now = ctx.currentTime;
    const prev = lastPlayed.get(cue);
    if (prev !== undefined && now - prev < 0.08) return true; // one-shot per event
    lastPlayed.set(cue, now);
    return false;
  }

  /** Apply a voice's amplitude envelope to its gain node between `start` and `end`. */
  function applyEnv(g: GainNode, v: Voice, start: number, end: number): void {
    if ((v.env ?? 'perc') === 'pad') {
      const a = v.attack ?? 0.02;
      const r = v.release ?? Math.min(0.25, v.dur * 0.35);
      const peakAt = start + a;
      const relAt = Math.max(peakAt, end - r);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(v.gain, peakAt);
      g.gain.setValueAtTime(v.gain, relAt);
      g.gain.linearRampToValueAtTime(0.0001, end);
    } else {
      // Percussive marimba-ish envelope: near-instant attack, exponential decay to silence.
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(v.gain, start + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
    }
  }

  /** Route a voice's gain node to a shared FX send at the voice's send level. */
  function sendTo(g: GainNode, target: GainNode, amount: number): void {
    if (!ctx) return;
    const s = ctx.createGain();
    s.gain.value = amount;
    g.connect(s);
    s.connect(target);
  }

  /** Render one bell voice: a sum of inharmonic sine partials (a somber struck bell). */
  function renderBell(v: Voice, start: number, dest: AudioNode): void {
    if (!ctx) return;
    const sum = ctx.createGain();
    sum.gain.value = 1;
    sum.connect(dest);
    if (v.send === 'reverb' && reverbSend) sendTo(sum, reverbSend, v.sendGain ?? 0.28);
    for (const [ratio, gainMul, durMul] of BELL_PARTIALS) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(v.freq * ratio, start);
      const g = ctx.createGain();
      const end = start + v.dur * durMul;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v.gain * gainMul), start + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(g).connect(sum);
      osc.start(start);
      osc.stop(end + 0.05);
    }
  }

  /** Render one voice at absolute time `start` into `dest` (+ any FX send). Never throws on its own. */
  function renderVoice(v: Voice, start: number, dest: AudioNode): void {
    if (!ctx) return;
    const kind = v.kind ?? 'osc';
    if (kind === 'bell') {
      renderBell(v, start, dest);
      return;
    }
    const end = start + v.dur;
    const isNoise = kind === 'noise' || kind === 'whoosh';
    if (isNoise && !noiseBuffer) return;

    // Source.
    let source: OscillatorNode | AudioBufferSourceNode;
    if (isNoise) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;
      source = src;
    } else {
      const osc = ctx.createOscillator();
      osc.type = v.type ?? 'triangle';
      osc.frequency.setValueAtTime(v.freq, start);
      if (v.freqTo !== undefined) osc.frequency.exponentialRampToValueAtTime(v.freqTo, end);
      if (v.glideTo !== undefined) osc.frequency.linearRampToValueAtTime(v.glideTo, end);
      if (v.detune) osc.detune.setValueAtTime(v.detune, start);
      source = osc;
    }

    // Optional filter (with an optional swept cutoff — the whoosh band-pass, the cymbal high-pass).
    let node: AudioNode = source;
    if (v.filter) {
      const f = ctx.createBiquadFilter();
      f.type = v.filter.type ?? 'lowpass';
      f.frequency.setValueAtTime(v.filter.freq, start);
      if (v.filter.freqTo !== undefined)
        f.frequency.exponentialRampToValueAtTime(v.filter.freqTo, end);
      if (v.filter.q !== undefined) f.Q.value = v.filter.q;
      node.connect(f);
      node = f;
    }

    // Envelope → dry destination (+ FX sends).
    const g = ctx.createGain();
    applyEnv(g, v, start, end);
    node.connect(g);
    g.connect(dest);
    if (v.send === 'reverb' && reverbSend) sendTo(g, reverbSend, v.sendGain ?? 0.2);
    else if (v.send === 'delay' && delaySend) sendTo(g, delaySend, v.sendGain ?? 0.3);

    source.start(start);
    source.stop(end + 0.05);
  }

  function playSynth(cue: SynthCue, opts?: PlayOpts): void {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + 0.001;
    for (const v of synthVoices(cue, opts?.level ?? 0)) renderVoice(v, t0 + v.at, master);
  }

  function playJingle(cue: JingleCue): void {
    if (!ctx || !master) return;
    const buf = samples.get(cue);
    if (!buf) return; // not decoded yet (or failed) — drop rather than stall
    const src = ctx.createBufferSource();
    src.buffer = buf;
    // Route through a jingle gain so the sampled cues sit below the synth SFX (see JINGLE_GAIN).
    const g = ctx.createGain();
    g.gain.value = JINGLE_GAIN;
    src.connect(g);
    g.connect(master);
    src.start();
  }

  function play(cue: SoundCue, opts?: PlayOpts): void {
    try {
      if (shouldDrop(cue)) return;
      if (ctx && ctx.state === 'suspended') void ctx.resume();
      if (cue === 'perfect' || cue === 'achievement' || cue === 'daily') {
        playJingle(cue);
      } else {
        playSynth(cue, opts);
      }
    } catch {
      /* audio must never break gameplay */
    }
  }

  // ---- The Rising Bed lifecycle (Phase 44) ---------------------------------------------

  /** Schedule every bed step whose time falls inside the look-ahead window. */
  function schedulerTick(): void {
    if (!ctx || !bedBus) return;
    // If we've fallen behind (a backgrounded tab throttles timers), skip forward rather than
    // burst-scheduling a flood of catch-up steps.
    if (nextStepTime < ctx.currentTime) nextStepTime = ctx.currentTime + 0.02;
    const horizon = ctx.currentTime + LOOKAHEAD;
    while (nextStepTime < horizon) {
      for (const v of bedVoices(liveTier, stepIndex)) renderVoice(v, nextStepTime + v.at, bedBus);
      nextStepTime += SEC16;
      stepIndex = (stepIndex + 1) % BED_STEPS;
    }
  }

  /** Start / stop the scheduler to match intent (`bedActive`) against `enabled` + `unlocked`. */
  function reconcileBed(): void {
    const shouldRun = bedActive && enabled && unlocked && !!ctx && !!bedBus;
    if (shouldRun && schedulerId === null) {
      if (nextStepTime < ctx!.currentTime) nextStepTime = ctx!.currentTime + 0.08;
      schedulerId = setInterval(schedulerTick, TICK_MS);
      schedulerTick(); // schedule the first window immediately, don't wait a tick
    } else if (!shouldRun && schedulerId !== null) {
      clearInterval(schedulerId);
      schedulerId = null;
    }
  }

  function startBed(): void {
    bedActive = true;
    liveTier = 0;
    stepIndex = 0;
    if (ctx && bedBus) {
      const now = ctx.currentTime;
      nextStepTime = now + 0.08;
      bedBus.gain.cancelScheduledValues(now);
      bedBus.gain.setValueAtTime(enabled ? BED_GAIN : 0.0001, now);
    }
    if (fatalTimer !== null) {
      clearTimeout(fatalTimer);
      fatalTimer = null;
    }
    reconcileBed();
  }

  function setBedTier(tier: number): void {
    liveTier = Math.max(0, Math.min(9, Math.floor(tier)));
  }

  function stopBed(fadeMs = 140): void {
    bedActive = false;
    if (ctx && bedBus) {
      const now = ctx.currentTime;
      const g = bedBus.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0.0001, now + Math.max(0.01, fadeMs / 1000));
    }
    reconcileBed(); // bedActive === false → the scheduler stops
  }

  function gauntletFatal(): void {
    try {
      stopBed(60); // a clean ~60 ms cut so the knell rings in silence
      play('wrong'); // the answer being graded
      if (fatalTimer !== null) clearTimeout(fatalTimer);
      // The descending bells land ~0.48 s after the sag.
      fatalTimer = setTimeout(() => {
        fatalTimer = null;
        play('fatal');
      }, 480);
    } catch {
      /* audio must never break gameplay */
    }
  }

  return { setEnabled, unlock, play, startBed, setBedTier, stopBed, gauntletFatal };
}

/** Resolve the platform `AudioContext` constructor, or `null` under SSR / jsdom. */
function resolveAudioCtx(): (new () => AudioContext) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** App-wide singleton, wired to the real Web Audio backend and the bundled jingle assets. */
export const sound: SoundController = createSound({
  AudioCtx: resolveAudioCtx(),
  sampleUrls: {
    perfect: perfectUrl,
    achievement: achievementUrl,
    daily: dailyUrl,
  },
});
