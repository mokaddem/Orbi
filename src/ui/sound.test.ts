import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSound, type JingleCue } from './sound';

// A minimal fake Web Audio backend: it records how many synth voices (oscillators) and how many
// samples (buffer sources) were actually started, so tests can assert what the service played
// without any real audio. Each constructed context registers itself so the test can inspect it.
// Phase 44 grew the graph (filters, delay, convolver, compressor, generated buffers) + a looping
// bed scheduler, so the fake now stubs those nodes too.
const contexts: FakeAudioContext[] = [];

const fakeParam = () => ({
  value: 0,
  setValueAtTime() {},
  linearRampToValueAtTime() {},
  exponentialRampToValueAtTime() {},
  cancelScheduledValues() {},
});

class FakeAudioContext {
  state: 'suspended' | 'running' = 'suspended';
  currentTime = 0;
  sampleRate = 8000; // small so generated noise/impulse buffers stay cheap in tests
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
    return { gain: fakeParam(), connect() {} };
  }
  // Arrow class fields so the inner `start` closes over the instance without aliasing `this`.
  createOscillator = () => ({
    type: 'sine' as OscillatorType,
    frequency: fakeParam(),
    detune: fakeParam(),
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
    loop: false,
    connect() {
      return { connect() {} };
    },
    start: () => {
      this.srcStarted++;
    },
    stop() {},
  });
  createBiquadFilter() {
    return {
      type: 'lowpass' as BiquadFilterType,
      frequency: fakeParam(),
      Q: { value: 0 },
      connect() {},
    };
  }
  createDelay() {
    return { delayTime: { value: 0 }, connect() {} };
  }
  createConvolver() {
    return { buffer: null as AudioBuffer | null, connect() {} };
  }
  createDynamicsCompressor() {
    return {
      threshold: { value: 0 },
      knee: { value: 0 },
      ratio: { value: 0 },
      attack: { value: 0 },
      release: { value: 0 },
      connect() {},
    };
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
}

// The fake implements only the slice of AudioContext the service uses; cast past the full DOM
// type so it's accepted where a real constructor is expected.
const AudioCtx = FakeAudioContext as unknown as new () => AudioContext;

const SAMPLE_URLS: Record<JingleCue, string> = {
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

  it('plays the session-complete flourish as a synth cue, not a sample (owner pick 2026-07-15)', () => {
    const s = createSound({ AudioCtx, sampleUrls: SAMPLE_URLS });
    s.setEnabled(true);
    s.unlock();
    s.play('finish');
    // `finish` is now the synthesized "music box" cue: a 7-voice flourish, no buffer source.
    expect(contexts[0].oscStarted).toBe(7);
    expect(contexts[0].srcStarted).toBe(0);
  });

  it('escalates the streak cue: each tier adds voices (Phase 39, extended to streak 50)', () => {
    // Tiers 0..8 grow the flourish (triad → +octave → +bass/run → +sparkle → +stab → +sub-bass →
    // +higher run/echo → +pad/fuller stab → +blooming stab), so the oscillator count climbs strictly
    // with the tier (pitch, which also transposes per tier, is ignored by the fake backend).
    const counts = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((level) => {
      contexts.length = 0;
      const s = createSound({ AudioCtx, sampleUrls: SAMPLE_URLS });
      s.setEnabled(true);
      s.unlock();
      s.play('streak', { level });
      return contexts[0].oscStarted;
    });
    expect(counts).toEqual([3, 4, 6, 8, 12, 13, 15, 17, 18]);
    // strictly increasing
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeGreaterThan(counts[i - 1]);
  });

  it('clamps a streak level beyond the top tier to the peak cue', () => {
    const s = createSound({ AudioCtx, sampleUrls: SAMPLE_URLS });
    s.setEnabled(true);
    s.unlock();
    s.play('streak', { level: 99 }); // caps at tier 8 (the peak)
    expect(contexts[0].oscStarted).toBe(18);
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
      // The Grandmaster Challenge surface must be just as safe with no backend.
      s.play('victory');
      s.startBed();
      s.setBedTier(4);
      s.gauntletFatal();
      s.stopBed();
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
    s.play('perfect');
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
    s.play('perfect');
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

describe('Grandmaster Challenge cues (Phase 44)', () => {
  const play = (cue: Parameters<ReturnType<typeof createSound>['play']>[0]) => {
    const s = createSound({ AudioCtx, sampleUrls: SAMPLE_URLS });
    s.setEnabled(true);
    s.unlock();
    s.play(cue);
    return contexts[0];
  };

  it('settle is a soft three-voice resolution (no noise / bells)', () => {
    const c = play('settle');
    expect(c.oscStarted).toBe(3);
    expect(c.srcStarted).toBe(0);
  });

  it('fatal rings three inharmonic bells (6 partials each) over a body thump', () => {
    const c = play('fatal');
    // 3 bells × 6 sine partials + 1 sine body-thump = 19 oscillators; no noise sources.
    expect(c.oscStarted).toBe(19);
    expect(c.srcStarted).toBe(0);
  });

  it('enter swells a whoosh into a gong, a bell and war-horns', () => {
    const c = play('enter');
    // gong(1) + low bell(6) + 3 horns(3) = 10 osc; whoosh + sparkle = 2 noise sources.
    expect(c.oscStarted).toBe(10);
    expect(c.srcStarted).toBe(2);
  });

  it('surge fires a riser, a chord stab and a boom over a whoosh + crash', () => {
    const c = play('surge');
    // riser(1) + 4 chord stabs + boom(1) = 6 osc; whoosh + crash = 2 noise sources.
    expect(c.oscStarted).toBe(6);
    expect(c.srcStarted).toBe(2);
  });

  it('victory is the full ceremonial fanfare', () => {
    const c = play('victory');
    // timpani(6)+gong(1)+chord(6)+brass(6)+ascent(6)+crown(2)+peal(4)+choir(10)+shimmer(1) = 42 osc;
    // cymbal + crash = 2 noise sources.
    expect(c.oscStarted).toBe(42);
    expect(c.srcStarted).toBe(2);
  });

  it('the Grandmaster cues are silent when the sound pref is off', () => {
    const s = createSound({ AudioCtx, sampleUrls: SAMPLE_URLS });
    s.setEnabled(false);
    s.unlock();
    s.play('settle');
    s.play('fatal');
    s.play('enter');
    s.play('surge');
    s.play('victory');
    expect(contexts[0].oscStarted).toBe(0);
    expect(contexts[0].srcStarted).toBe(0);
  });

  it('gauntletFatal cuts the bed, sags, then rings the bells after a beat', () => {
    vi.useFakeTimers();
    try {
      const s = createSound({ AudioCtx, sampleUrls: SAMPLE_URLS });
      s.setEnabled(true);
      s.unlock();
      const c = contexts[0];
      s.gauntletFatal();
      // Immediately: only the `wrong` sag (1 oscillator); the bells are deferred.
      expect(c.oscStarted).toBe(1);
      vi.advanceTimersByTime(500);
      // After ~0.48 s: the fatal knell joins the sag — 3 bells (18 partials) + a body thump = 19.
      expect(c.oscStarted).toBe(1 + 19);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the Rising Bed (Phase 44)', () => {
  it('schedules looping voices while running and stops on stopBed', () => {
    vi.useFakeTimers();
    try {
      const s = createSound({ AudioCtx, sampleUrls: SAMPLE_URLS });
      s.setEnabled(true);
      s.unlock();
      const c = contexts[0];
      s.startBed(); // schedules the first look-ahead window immediately
      const afterStart = c.oscStarted + c.srcStarted;
      expect(afterStart).toBeGreaterThan(0);

      // Advance the audio clock + timers → the scheduler lays down more steps.
      c.currentTime = 0.5;
      vi.advanceTimersByTime(100);
      const afterRun = c.oscStarted + c.srcStarted;
      expect(afterRun).toBeGreaterThan(afterStart);

      // Stop → no further scheduling however far time advances.
      s.stopBed(10);
      const afterStop = c.oscStarted + c.srcStarted;
      c.currentTime = 3.0;
      vi.advanceTimersByTime(300);
      expect(c.oscStarted + c.srcStarted).toBe(afterStop);
    } finally {
      vi.useRealTimers();
    }
  });

  it('muting the sound pref silences the bed and stops its scheduler', () => {
    vi.useFakeTimers();
    try {
      const s = createSound({ AudioCtx, sampleUrls: SAMPLE_URLS });
      s.setEnabled(true);
      s.unlock();
      const c = contexts[0];
      s.startBed();
      const n0 = c.oscStarted + c.srcStarted;
      s.setEnabled(false); // mute mid-run
      c.currentTime = 1.0;
      vi.advanceTimersByTime(200);
      expect(c.oscStarted + c.srcStarted).toBe(n0); // nothing scheduled while muted
    } finally {
      vi.useRealTimers();
    }
  });

  it('a higher tier stacks more voices into the loop', () => {
    vi.useFakeTimers();
    try {
      const runTier = (tier: number): number => {
        contexts.length = 0;
        const s = createSound({ AudioCtx, sampleUrls: SAMPLE_URLS });
        s.setEnabled(true);
        s.unlock();
        const c = contexts[0];
        s.startBed();
        s.setBedTier(tier);
        // Advance through a full loop (~10 s) so every step of the pattern is scheduled once.
        for (let t = 0; t <= 11; t += 0.2) {
          c.currentTime = t;
          vi.advanceTimersByTime(25);
        }
        s.stopBed(1);
        return c.oscStarted + c.srcStarted;
      };
      const low = runTier(0);
      const high = runTier(9);
      expect(high).toBeGreaterThan(low);
    } finally {
      vi.useRealTimers();
    }
  });
});
