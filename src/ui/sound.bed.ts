// The Rising Bed (Phase 44) — the Grandmaster Challenge's escalating background score.
//
// A *pure*, framework-free module: it turns a (tier, step) pair into a list of {@link Voice}s to
// render. All the impure bits — the AudioContext, the look-ahead scheduler that calls this each
// step, the FX bus — live in `sound.ts`. Keeping the music data pure means the whole bed is
// unit-testable (tier boundaries, per-step voice sets, layer accumulation) with zero audio.
//
// Design (locked; see `docs/gauntlet-audio-spec.md` → Stage 01): D minor · 96 BPM · a 4-bar loop of
// 64 sixteenth-steps (~10 s). One looping bed whose intensity is a pure function of progress: a
// `foundation` groove present at every tier, plus 10 accumulating layers (each tier adds one on top
// of all lower ones), mirroring how `streakVoices` stacks voices with the streak tier.

import type { Voice } from './sound';

/** Equal-tempered frequency for a MIDI note number (69 = A4 = 440 Hz). Shared with `sound.ts`. */
export const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** One sixteenth-note, seconds: `60 / BPM / 4` at 96 BPM. The scheduler advances one per step. */
export const SEC16 = 60 / 96 / 4; // 0.15625 s
/** Steps in the loop — a 4-bar phrase of sixteenths. */
export const BED_STEPS = 64;
/** Highest bed tier index (0..9). */
export const BED_TIER_MAX = 9;

/**
 * The bed's intensity tier for a run's progress, normalized so *any* run length spans all 10 tiers:
 * a 108-slot Africa run and a 52-slot Oceania run both climb 0 → 9, just at different rates.
 */
export function bedTierFor(cleared: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(BED_TIER_MAX, Math.floor((cleared * 10) / total));
}

// ---- Groove data ------------------------------------------------------------------------------

/**
 * The Embers motif — short quiet marimba plucks landing only in the *gaps* between drum hits
 * (`{ step: midi }`): A4·F4 / A4·F4·E4 / Bb4·A4 / A4·F4·D4 across the four bars. Several layers are
 * derived from it (choir, drift, sky-echo, octave-double, sparkle), so it's the shared melodic cell.
 */
const EMBERS: Readonly<Record<number, number>> = {
  2: 69,
  10: 65,
  18: 69,
  26: 65,
  29: 64,
  34: 70,
  42: 69,
  50: 69,
  51: 65,
  53: 62,
};

/** A diatonic third below each Ember note (Ember layer's choir). */
const CHOIR_THIRD: Readonly<Record<number, number>> = { 69: 65, 65: 62, 64: 60, 70: 67, 62: 58 };

/** Pyre's high counter-melody answer (`{ step: midi }`). */
const COUNTER: Readonly<Record<number, number>> = {
  5: 74,
  11: 69,
  21: 74,
  27: 72,
  37: 77,
  43: 74,
};

/** War-horn stabs (Firestorm), keyed by absolute step: D·D·Bb·A. */
const HORNS: Readonly<Record<number, number>> = { 0: 38, 16: 38, 32: 46, 48: 45 };

/** Per-bar roots for the Blaze body pad and Apex triad. */
const BODY_ROOT = [50, 50, 53, 57];
/** Per-bar roots for the Inferno bass ostinato and Cataclysm sub. */
const BASS_ROOTS = [38, 38, 41, 45];

// ---- Voice helpers (author the spec's `pluck` / `drum` / `pad` / `tone` / `noise` shapes) -------

/** A triangle pluck — the melodic workhorse (percussive env by default). */
const pluck = (midi: number, dur: number, gain: number, extra?: Partial<Voice>): Voice => ({
  kind: 'osc',
  type: 'triangle',
  freq: hz(midi),
  at: 0,
  dur,
  gain,
  ...extra,
});

/** A membrane hit: a sine with a fast exponential pitch-drop `from → to`. */
const drum = (
  from: number,
  to: number,
  dur: number,
  gain: number,
  extra?: Partial<Voice>,
): Voice => ({
  kind: 'osc',
  type: 'sine',
  freq: from,
  freqTo: to,
  at: 0,
  dur,
  gain,
  ...extra,
});

// ---- The foundation (every tier) --------------------------------------------------------------

/**
 * The groove present at every tier — deep booms, mid accents, a galloping pickup, a bar-4 tom-roll
 * fill, loop crashes, and a low body drone. Returns the voices to fire *at this step* (offset 0).
 */
function foundation(p: number): Voice[] {
  const b = p % 16;
  const bar = Math.floor(p / 16);
  const fill = bar === 3;
  const b08 = b === 0 || b === 8;
  const v: Voice[] = [];

  // Deep booms on beats 1 & 3 (+ a wetter reverb copy for size).
  if (b08) {
    v.push(drum(hz(38) * 1.9, hz(24), 0.5, 0.6));
    v.push(drum(hz(38), hz(28), 0.4, 0.16, { send: 'reverb', sendGain: 0.9 }));
    // Sub-thump under the boom.
    v.push({
      kind: 'osc',
      type: 'sine',
      freq: hz(26),
      at: 0,
      dur: 0.45,
      gain: 0.12,
      env: 'pad',
      attack: 0.01,
    });
  }

  // Mid accents: beat 2, and beat 4 except in the fill bar (where the roll takes over).
  if (b === 4 || (b === 12 && !fill)) {
    v.push(drum(hz(45) * 1.7, hz(45), 0.2, 0.34));
  }

  // Galloping pickups into the next downbeat.
  if (b === 6 || b === 7 || ((b === 14 || b === 15) && !fill)) {
    v.push(drum(hz(45) * 1.6, hz(45) * 0.92, 0.16, 0.32));
  }

  // Bar-4 tom-roll fill: an accelerating octave climb into the loop-top downbeat.
  if (fill && b >= 9) {
    const k = (b - 9) / 6;
    const m = 41 + k * 12;
    v.push(drum(hz(m) * 1.5, hz(m) * 0.9, 0.13, 0.26 + k * 0.14));
  }

  // Loop-top crash + a long body drone that rings across the whole phrase.
  if (p === 0) {
    v.push({
      kind: 'noise',
      freq: 3200,
      at: 0,
      dur: 0.6,
      gain: 0.12,
      filter: { type: 'bandpass', freq: 3200, q: 0.5 },
      send: 'reverb',
      sendGain: 0.3,
    });
    v.push({
      kind: 'osc',
      type: 'sine',
      freq: hz(38),
      at: 0,
      dur: 10.2,
      gain: 0.03,
      env: 'pad',
      attack: 0.4,
    });
  }
  // Mid-phrase crash.
  if (p === 32) {
    v.push({
      kind: 'noise',
      freq: 2600,
      at: 0,
      dur: 0.4,
      gain: 0.07,
      filter: { type: 'bandpass', freq: 2600, q: 0.6 },
      send: 'reverb',
      sendGain: 0.3,
    });
  }

  return v;
}

// ---- The 10 accumulating layers ---------------------------------------------------------------

/** Each layer returns the voices it contributes *at this step* (empty on steps it doesn't touch). */
type Layer = (p: number) => Voice[];

const LAYERS: readonly Layer[] = [
  // 0 · Kindling — the Embers melody itself.
  (p) => (EMBERS[p] !== undefined ? [pluck(EMBERS[p], 0.16, 0.075)] : []),

  // 1 · Ember — a choir a diatonic third below each Ember note.
  (p) => {
    const e = EMBERS[p];
    const third = e !== undefined ? CHOIR_THIRD[e] : undefined;
    return third !== undefined ? [pluck(third, 0.16, 0.052)] : [];
  },

  // 2 · Flame — a +12 shimmer into the delay, and the base note echoed into the delay.
  (p) => {
    const e = EMBERS[p];
    if (e === undefined) return [];
    return [
      pluck(e + 12, 0.16, 0.028, { send: 'delay', sendGain: 0.5 }),
      pluck(e, 0.16, 0.04, { send: 'delay', sendGain: 0.5 }),
    ];
  },

  // 3 · Blaze — a low body pad per bar + a deeper boom under the beats.
  (p) => {
    const b = p % 16;
    const bar = Math.floor(p / 16);
    const v: Voice[] = [];
    if (b === 0) {
      v.push({
        kind: 'osc',
        type: 'sawtooth',
        freq: hz(BODY_ROOT[bar] - 12),
        at: 0,
        dur: 2.6,
        gain: 0.045,
        env: 'pad',
        attack: 0.08,
        filter: { type: 'lowpass', freq: 600 },
      });
    }
    if (b === 0 || b === 8) v.push(drum(hz(26) * 1.6, hz(19), 0.55, 0.28));
    return v;
  },

  // 4 · Pyre — a high counter-melody answering the Embers.
  (p) => (COUNTER[p] !== undefined ? [pluck(COUNTER[p], 0.12, 0.04)] : []),

  // 5 · Inferno — a driving bass ostinato (accents on the beats, ghosts between).
  (p) => {
    const b = p % 16;
    const bar = Math.floor(p / 16);
    if (![0, 3, 6, 8, 11, 14].includes(b)) return [];
    const accent = b === 0 || b === 8;
    return [
      {
        kind: 'osc',
        type: 'sawtooth',
        freq: hz(BASS_ROOTS[bar]),
        at: 0,
        dur: accent ? 0.2 : 0.13,
        gain: accent ? 0.047 : 0.032,
        filter: { type: 'lowpass', freq: 480, q: 2 },
      },
    ];
  },

  // 6 · Firestorm — war-horn stabs, octave-stacked and detuned for width.
  (p) => {
    const root = HORNS[p];
    if (root === undefined) return [];
    const horn = (midi: number, gain: number, detune: number): Voice => ({
      kind: 'osc',
      type: 'sawtooth',
      freq: hz(midi),
      detune,
      at: 0,
      dur: 2.0,
      gain,
      env: 'pad',
      attack: 0.15,
      filter: { type: 'lowpass', freq: 1300 },
    });
    return [
      horn(root, 0.04, -7),
      horn(root, 0.04, 7),
      horn(root + 12, 0.028, -7),
      horn(root + 12, 0.028, 7),
    ];
  },

  // 7 · Cataclysm — a sky-echo shimmer into the delay + a sub under the beats.
  (p) => {
    const b = p % 16;
    const bar = Math.floor(p / 16);
    const v: Voice[] = [];
    const e = EMBERS[p];
    if (e !== undefined) v.push(pluck(e + 12, 0.16, 0.03, { send: 'delay', sendGain: 0.5 }));
    if (b === 0 || b === 8) {
      v.push({
        kind: 'osc',
        type: 'sine',
        freq: hz(BASS_ROOTS[bar] - 12),
        at: 0,
        dur: 0.6,
        gain: 0.05,
        env: 'pad',
        attack: 0.02,
      });
    }
    return v;
  },

  // 8 · Apex — a pad-swell triad per bar, an octave-down double + sparkle on each Ember, loop crashes.
  (p) => {
    const b = p % 16;
    const bar = Math.floor(p / 16);
    const v: Voice[] = [];
    if (b === 0) {
      for (const semi of [0, 3, 7]) {
        v.push({
          kind: 'osc',
          type: 'triangle',
          freq: hz(BODY_ROOT[bar] + semi),
          at: 0,
          dur: 2.6,
          gain: 0.02,
          env: 'pad',
          attack: 0.2,
        });
      }
    }
    const e = EMBERS[p];
    if (e !== undefined) {
      v.push(pluck(e - 12, 0.2, 0.03));
      v.push(pluck(e + 19, 0.2, 0.022));
    }
    if (p === 0 || p === 32) {
      v.push({
        kind: 'noise',
        freq: 5000,
        at: 0,
        dur: 0.4,
        gain: 0.05,
        filter: { type: 'highpass', freq: 5000 },
      });
    }
    return v;
  },

  // 9 · Grandmaster — a dry ticking clock on every 8th, the accent on each beat (no reverb).
  (p) => {
    if (p % 2 !== 0) return [];
    const high = p % 4 === 0;
    return [
      pluck(high ? 96 : 89, 0.03, high ? 0.05 : 0.042, { attack: 0.001 }),
      {
        kind: 'noise',
        freq: high ? 6800 : 4800,
        at: 0,
        dur: 0.014,
        gain: 0.026,
        filter: { type: 'highpass', freq: high ? 6800 : 4800 },
      },
    ];
  },
];

/**
 * The voices to render at loop step `p` for intensity `tier`: the foundation groove plus every
 * accumulating layer `i ≤ tier`. Pure — the scheduler renders the returned voices at the step's time.
 */
export function bedVoices(tier: number, p: number): Voice[] {
  const t = Math.max(0, Math.min(BED_TIER_MAX, tier));
  const v = foundation(p);
  for (let i = 0; i <= t; i++) v.push(...LAYERS[i](p));
  return v;
}
