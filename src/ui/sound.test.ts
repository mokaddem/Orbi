import { describe, it, expect, beforeEach } from 'vitest';
import { createSound, type JingleCue } from './sound';

// A minimal fake Web Audio backend: it records how many synth voices (oscillators) and how many
// samples (buffer sources) were actually started, so tests can assert what the service played
// without any real audio. Each constructed context registers itself so the test can inspect it.
const contexts: FakeAudioContext[] = [];

class FakeAudioContext {
  state: 'suspended' | 'running' = 'suspended';
  currentTime = 0;
  destination = {};
  oscStarted = 0;
  srcStarted = 0;

  constructor() {
    contexts.push(this);
  }
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }
  createGain() {
    return {
      gain: {
        value: 0,
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
        linearRampToValueAtTime() {},
      },
      connect() {},
    };
  }
  // Arrow class fields so the inner `start` closes over the instance without aliasing `this`.
  createOscillator = () => ({
    type: 'sine' as OscillatorType,
    frequency: { setValueAtTime() {}, linearRampToValueAtTime() {} },
    connect() {
      return { connect() {} };
    },
    start: () => {
      this.oscStarted++;
    },
    stop() {},
  });
  createBufferSource = () => ({
    buffer: null as AudioBuffer | null,
    connect() {},
    start: () => {
      this.srcStarted++;
    },
  });
}

// The fake implements only the slice of AudioContext the service uses; cast past the full DOM
// type so it's accepted where a real constructor is expected.
const AudioCtx = FakeAudioContext as unknown as new () => AudioContext;

const SAMPLE_URLS: Record<JingleCue, string> = {
  finish: 'finish.ogg',
  perfect: 'perfect.ogg',
  achievement: 'achievement.ogg',
  daily: 'daily.ogg',
};

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  contexts.length = 0;
});

describe('sound service (Phase 36)', () => {
  it('plays a synth cue once enabled and unlocked', () => {
    const s = createSound({ AudioCtx, sampleUrls: SAMPLE_URLS });
    s.setEnabled(true);
    s.unlock();
    s.play('correct');
    // "correct" is a two-note rising mallet → two oscillator voices.
    expect(contexts[0].oscStarted).toBe(2);
  });

  it('escalates the streak cue: each tier adds voices (Phase 39)', () => {
    // Tier 0..4 grows the flourish (triad → +octave → +bass/run → +sparkle → +chord stab), so the
    // oscillator count climbs strictly with the tier (pitch, which also transposes per tier, is
    // ignored by the fake backend).
    const counts = [0, 1, 2, 3, 4].map((level) => {
      contexts.length = 0;
      const s = createSound({ AudioCtx, sampleUrls: SAMPLE_URLS });
      s.setEnabled(true);
      s.unlock();
      s.play('streak', { level });
      return contexts[0].oscStarted;
    });
    expect(counts).toEqual([3, 4, 6, 8, 12]);
    // strictly increasing
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1]);
  });

  it('clamps a streak level beyond the top tier to the peak cue', () => {
    const s = createSound({ AudioCtx, sampleUrls: SAMPLE_URLS });
    s.setEnabled(true);
    s.unlock();
    s.play('streak', { level: 99 }); // caps at tier 4
    expect(contexts[0].oscStarted).toBe(12);
  });

  it('is completely silent when the sound pref is off', () => {
    const s = createSound({ AudioCtx, sampleUrls: SAMPLE_URLS });
    s.setEnabled(false);
    s.unlock();
    s.play('correct');
    s.play('wrong');
    s.play('streak');
    expect(contexts[0].oscStarted).toBe(0);
  });

  it('is a no-op before the first-gesture unlock', () => {
    const s = createSound({ AudioCtx, sampleUrls: SAMPLE_URLS });
    s.setEnabled(true);
    // No unlock() yet — a cue that fires before the gesture is dropped, never queued.
    s.play('correct');
    expect(contexts.length).toBe(0); // no context was even created
  });

  it('does not throw when the audio backend is unavailable', () => {
    const s = createSound({ AudioCtx: null, sampleUrls: SAMPLE_URLS });
    expect(() => {
      s.setEnabled(true);
      s.unlock();
      s.play('correct');
      s.play('finish');
    }).not.toThrow();
    expect(contexts.length).toBe(0);
  });

  it('plays a bundled jingle once its sample has decoded', async () => {
    const buffer = {} as AudioBuffer;
    const s = createSound({
      AudioCtx,
      sampleUrls: SAMPLE_URLS,
      loadSample: () => Promise.resolve(buffer),
    });
    s.setEnabled(true);
    s.unlock();
    await flush(); // let the decode promises resolve
    s.play('finish');
    expect(contexts[0].srcStarted).toBe(1);
    expect(contexts[0].oscStarted).toBe(0); // jingles are samples, not synth
  });

  it('drops a jingle silently while its sample is still loading', () => {
    // A loader that never resolves models a sample that hasn't decoded yet.
    const s = createSound({
      AudioCtx,
      sampleUrls: SAMPLE_URLS,
      loadSample: () => new Promise<AudioBuffer>(() => {}),
    });
    s.setEnabled(true);
    s.unlock();
    s.play('finish');
    expect(contexts[0].srcStarted).toBe(0);
  });

  it('debounces an identical cue fired twice in the same instant', () => {
    const s = createSound({ AudioCtx, sampleUrls: SAMPLE_URLS });
    s.setEnabled(true);
    s.unlock();
    s.play('wrong'); // one voice
    s.play('wrong'); // same instant → debounced, no extra voice
    expect(contexts[0].oscStarted).toBe(1);
  });

  it('turning the pref back on resumes playing without re-unlocking', () => {
    const s = createSound({ AudioCtx, sampleUrls: SAMPLE_URLS });
    s.unlock();
    s.setEnabled(false);
    s.play('correct');
    expect(contexts[0].oscStarted).toBe(0);
    s.setEnabled(true);
    s.play('correct');
    expect(contexts[0].oscStarted).toBe(2);
  });
});
