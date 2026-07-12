// Generate the four bundled celebratory jingles (Phase 36) as tiny, self-made marimba renders.
//
// These are fully self-authored (CC0) — additive mallet synthesis composed here, so there is no
// third-party audio and nothing to license. Run once (or whenever the compositions change):
//
//     node scripts/gen-jingles.mjs
//
// It writes 16-bit mono PCM WAVs to a temp dir, then encodes each to a small `.ogg` (libvorbis)
// in `src/ui/assets/sound/`. Requires `ffmpeg` on PATH. The committed `.ogg` files are the source
// of truth at runtime (imported by `src/ui/sound.ts`); this script just reproduces them.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 44100;
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'ui', 'assets', 'sound');

/** Equal-tempered frequency for a MIDI note (69 = A4 = 440 Hz). */
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// Marimba-ish inharmonic partials (ratio → relative amplitude): a mallet-bar timbre.
const PARTIALS = [
  [1, 1.0],
  [3.9, 0.42],
  [9.2, 0.12],
];

/**
 * Render one struck marimba note into `buffer` (Float32) starting at `startSec`.
 * Near-instant attack, exponential decay — a soft, woody mallet hit.
 */
function strike(buffer, startSec, freq, gain, decay = 0.4) {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const len = Math.floor((decay * 4 + 0.02) * SAMPLE_RATE); // ~4 time-constants of tail
  const attack = 0.004 * SAMPLE_RATE;
  for (let i = 0; i < len; i++) {
    const idx = start + i;
    if (idx >= buffer.length) break;
    const t = i / SAMPLE_RATE;
    const env = (i < attack ? i / attack : 1) * Math.exp(-t / decay);
    let s = 0;
    for (const [ratio, amp] of PARTIALS) s += amp * Math.sin(2 * Math.PI * freq * ratio * t);
    buffer[idx] += gain * env * s;
  }
}

/** A composition is a list of {t, midi, gain, decay} strikes; total length in seconds. */
const JINGLES = {
  // Brief marimba resolve — a gentle rising triad settling onto a soft chord.
  finish: {
    length: 1.5,
    notes: [
      { t: 0.0, midi: 72, gain: 0.5 }, // C5
      { t: 0.14, midi: 76, gain: 0.5 }, // E5
      { t: 0.28, midi: 79, gain: 0.55 }, // G5
      { t: 0.5, midi: 72, gain: 0.4, decay: 0.7 }, // C5  ┐ soft resolving chord
      { t: 0.5, midi: 76, gain: 0.4, decay: 0.7 }, // E5  │
      { t: 0.5, midi: 79, gain: 0.45, decay: 0.7 }, // G5 ┘
    ],
  },
  // The celebratory peak — a brighter, longer ascending flourish topped with a sparkle.
  perfect: {
    length: 2.4,
    notes: [
      { t: 0.0, midi: 72, gain: 0.45 }, // C5
      { t: 0.12, midi: 76, gain: 0.45 }, // E5
      { t: 0.24, midi: 79, gain: 0.48 }, // G5
      { t: 0.36, midi: 84, gain: 0.52 }, // C6
      { t: 0.62, midi: 79, gain: 0.4, decay: 0.9 }, // G5 ┐ bright chord
      { t: 0.62, midi: 84, gain: 0.42, decay: 0.9 }, // C6 │
      { t: 0.62, midi: 88, gain: 0.4, decay: 0.9 }, // E6 ┘
      { t: 1.05, midi: 91, gain: 0.32, decay: 0.5 }, // G6 sparkle
      { t: 1.2, midi: 96, gain: 0.28, decay: 0.55 }, // C7 sparkle
    ],
  },
  // A distinct sparkle/chime for a badge unlock — bright, bell-like, quick.
  achievement: {
    length: 1.5,
    notes: [
      { t: 0.0, midi: 79, gain: 0.4, decay: 0.3 }, // G5
      { t: 0.1, midi: 84, gain: 0.44, decay: 0.35 }, // C6
      { t: 0.24, midi: 88, gain: 0.42, decay: 0.45 }, // E6
      { t: 0.24, midi: 91, gain: 0.36, decay: 0.55 }, // G6 (shimmer)
    ],
  },
  // The daily-habit jingle — a friendly, bouncy pentatonic lilt so the moment feels its own.
  daily: {
    length: 1.5,
    notes: [
      { t: 0.0, midi: 76, gain: 0.48 }, // E5
      { t: 0.12, midi: 79, gain: 0.46 }, // G5
      { t: 0.24, midi: 81, gain: 0.46 }, // A5
      { t: 0.38, midi: 79, gain: 0.42 }, // G5
      { t: 0.52, midi: 84, gain: 0.5, decay: 0.6 }, // C6
    ],
  },
};

/** Peak-normalize to a gentle target so on-by-default is never jarring (master gain sits atop). */
function normalize(buffer, peak = 0.72) {
  let max = 0;
  for (const v of buffer) max = Math.max(max, Math.abs(v));
  if (max === 0) return;
  const k = peak / max;
  for (let i = 0; i < buffer.length; i++) buffer[i] *= k;
}

/** Encode a Float32 [-1,1] buffer as a 16-bit mono PCM WAV. */
function toWav(buffer) {
  const n = buffer.length;
  const bytes = Buffer.alloc(44 + n * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + n * 2, 4);
  bytes.write('WAVE', 8);
  bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); // PCM
  bytes.writeUInt16LE(1, 22); // mono
  bytes.writeUInt32LE(SAMPLE_RATE, 24);
  bytes.writeUInt32LE(SAMPLE_RATE * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, buffer[i]));
    bytes.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return bytes;
}

mkdirSync(OUT_DIR, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'jingles-'));

for (const [name, spec] of Object.entries(JINGLES)) {
  const buffer = new Float32Array(Math.ceil(spec.length * SAMPLE_RATE));
  for (const note of spec.notes) strike(buffer, note.t, hz(note.midi), note.gain, note.decay);
  normalize(buffer);
  const wavPath = join(tmp, `${name}.wav`);
  writeFileSync(wavPath, toWav(buffer));
  const oggPath = join(OUT_DIR, `${name}.ogg`);
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    wavPath,
    '-c:a',
    'libvorbis',
    '-q:a',
    '3',
    oggPath,
  ]);
  console.log(`wrote ${oggPath}`);
}
console.log('done — 4 jingles rendered');
