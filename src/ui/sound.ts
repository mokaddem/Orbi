// Sound service (Phase 36) — the app's "voice".
//
// A thin, UI-layer module that plays a *named cue* at the existing feedback moments. It is
// deliberately kept out of the pure domain layer: the domain stays silent and testable, and
// this file is the only place that touches Web Audio. It is:
//   • gated on the sound preference (`Prefs.sound`) — a single master on/off, no volume, and
//   • gated on an autoplay-safe unlock — browsers block audio until the first user gesture, so
//     cues are silently dropped (never queued) until `unlock()` runs inside a gesture.
// Everything is wrapped so a missing/broken audio backend never throws or blocks the UI.
//
// Hybrid audio (owner decision, 2026-07-11): the frequent, short SFX (`correct` / `wrong` /
// `streak`) are *synthesized* with the Web Audio API — zero bytes, no licensing, offline-trivial
// — while the celebratory jingles (`finish` / `perfect` / `achievement` / `daily`) are tiny
// self-made marimba renders bundled as `.ogg` and precached by the service worker. Cues are
// authored gently/quiet-by-default (a low master gain) so on-by-default is never jarring.

import finishUrl from './assets/sound/finish.ogg?url';
import perfectUrl from './assets/sound/perfect.ogg?url';
import achievementUrl from './assets/sound/achievement.ogg?url';
import dailyUrl from './assets/sound/daily.ogg?url';
import { STREAK_MILESTONES } from './streak';

/** Synthesized short SFX. */
export type SynthCue = 'correct' | 'wrong' | 'streak';
/** Bundled marimba jingles. */
export type JingleCue = 'finish' | 'perfect' | 'achievement' | 'daily';
export type SoundCue = SynthCue | JingleCue;

const JINGLE_CUES: readonly JingleCue[] = ['finish', 'perfect', 'achievement', 'daily'];

/** Options for a played cue. `level` selects the sticky `streak` tier (0-based; see `streakVoices`). */
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
  /** Reflect the `Prefs.sound` master toggle. When off, every cue is silent. */
  setEnabled(enabled: boolean): void;
  /** Create/resume the audio backend inside a user gesture; safe to call repeatedly. */
  unlock(): void;
  /** Play a named cue, if enabled and unlocked; otherwise a no-op. Never throws. */
  play(cue: SoundCue, opts?: PlayOpts): void;
}

// ---- Cue authoring ---------------------------------------------------------------------

/** Master attenuation — keeps every cue gentle, since there's no volume slider. */
const MASTER_GAIN = 0.45;

/**
 * Extra attenuation for the bundled jingles only (`finish` / `perfect` / `achievement` /
 * `daily`). They're recorded samples that land louder than the quiet synth SFX, so they're
 * pulled down relative to the per-answer cues. Applied on top of {@link MASTER_GAIN}; nudge
 * this to retune. Owner feedback trimmed it twice: 1.0 → 0.6 (mode-complete jingle a touch
 * too loud), then 0.6 → 0.35 (the end-of-session jingle was still too loud, 2026-07-14).
 */
const JINGLE_GAIN = 0.35;

/** Equal-tempered frequency for a MIDI note number (69 = A4 = 440 Hz). */
const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

interface Voice {
  /** Frequency in Hz. */
  freq: number;
  /** Start offset from the cue's t0, seconds. */
  at: number;
  /** Duration, seconds. */
  dur: number;
  /** Peak gain (pre-master), ~0..0.3. */
  gain: number;
  type?: OscillatorType;
  /** Optional linear glide to this frequency by the note's end (for the soft "wrong" bend). */
  glideTo?: number;
}

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
    case 'streak':
      return streakVoices(level);
  }
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

// ---- Controller ------------------------------------------------------------------------

/**
 * Build a sound controller over the injected backend. The app uses the {@link sound} singleton;
 * tests build their own with a fake `AudioCtx` to observe cues without real audio.
 */
export function createSound(deps: SoundDeps): SoundController {
  let enabled = true;
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let unlocked = false;
  const samples = new Map<JingleCue, AudioBuffer>();
  /** Debounce identical cues so a double-call can't stack into a doubled hit. */
  const lastPlayed = new Map<SoundCue, number>();

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

  function setEnabled(next: boolean): void {
    enabled = next;
  }

  function unlock(): void {
    if (!deps.AudioCtx) return; // Web Audio unavailable — stay silent, never throw.
    try {
      if (!ctx) {
        ctx = new deps.AudioCtx();
        master = ctx.createGain();
        master.gain.value = MASTER_GAIN;
        master.connect(ctx.destination);
        decodeAll(ctx);
      }
      if (ctx.state === 'suspended') void ctx.resume();
      unlocked = true;
    } catch {
      /* backend refused — leave the service inert */
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

  function playSynth(cue: SynthCue, opts?: PlayOpts): void {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + 0.001;
    for (const v of synthVoices(cue, opts?.level ?? 0)) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = v.type ?? 'triangle';
      const start = t0 + v.at;
      const end = start + v.dur;
      osc.frequency.setValueAtTime(v.freq, start);
      if (v.glideTo !== undefined) osc.frequency.linearRampToValueAtTime(v.glideTo, end);
      // Percussive marimba-ish envelope: near-instant attack, exponential decay to silence.
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(v.gain, start + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(g).connect(master);
      osc.start(start);
      osc.stop(end + 0.03);
    }
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
      if (cue === 'finish' || cue === 'perfect' || cue === 'achievement' || cue === 'daily') {
        playJingle(cue);
      } else {
        playSynth(cue, opts);
      }
    } catch {
      /* audio must never break gameplay */
    }
  }

  return { setEnabled, unlock, play };
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
    finish: finishUrl,
    perfect: perfectUrl,
    achievement: achievementUrl,
    daily: dailyUrl,
  },
});
