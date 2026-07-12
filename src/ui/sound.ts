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

/** Synthesized short SFX. */
export type SynthCue = 'correct' | 'wrong' | 'streak';
/** Bundled marimba jingles. */
export type JingleCue = 'finish' | 'perfect' | 'achievement' | 'daily';
export type SoundCue = SynthCue | JingleCue;

const JINGLE_CUES: readonly JingleCue[] = ['finish', 'perfect', 'achievement', 'daily'];

/** Options for a played cue. `level` bumps the `streak` arpeggio up a step per milestone. */
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
    case 'streak': {
      // A short major-triad arpeggio that climbs a whole step per milestone (level 0/1/2…).
      const root = 72 + level * 2; // C5, D5, E5, …
      return [0, 4, 7].map((semi, i) => ({
        freq: hz(root + semi),
        at: i * 0.075,
        dur: 0.16,
        gain: 0.15,
        type: 'triangle' as OscillatorType,
      }));
    }
  }
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
    src.connect(master);
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
