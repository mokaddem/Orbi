import { describe, it, expect } from 'vitest';
import type { QuestionResult, SessionSummary } from './types';
import { computeBlitzPoints } from './blitz';
import {
  DUEL_PROTOCOL_VERSION,
  type DuelPayload,
  decodeDuel,
  duelScore,
  duelVerdict,
  encodeDuel,
  isDuelType,
} from './duel';

function payload(overrides: Partial<DuelPayload> = {}): DuelPayload {
  return {
    protocolVersion: DUEL_PROTOCOL_VERSION,
    dataVersion: 'v1-abc123',
    mode: 'flag-to-country',
    type: 'fixed',
    region: 'Europe',
    length: 10,
    choices: 4,
    seed: 0xdeadbeef,
    challengerName: 'Sami',
    challengerScore: { primary: 8, tiebreak: 42000 },
    ...overrides,
  };
}

function summary(overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    mode: 'flag-to-country',
    type: 'fixed',
    total: 10,
    correct: 7,
    accuracy: 0.7,
    bestStreak: 4,
    startedAt: 1000,
    finishedAt: 41000,
    durationMs: 40000,
    missed: [],
    results: [],
    choices: 4,
    ...overrides,
  };
}

function result(correct: boolean, answerMs: number): QuestionResult {
  return { itemKey: `flag-to-country:XX`, countryIso2: 'XX', correct, answerMs };
}

describe('isDuelType', () => {
  it('accepts the four duel-able formats and rejects the rest', () => {
    expect(isDuelType('fixed')).toBe(true);
    expect(isDuelType('survival')).toBe(true);
    expect(isDuelType('full')).toBe(true);
    expect(isDuelType('blitz')).toBe(true);
    expect(isDuelType('training')).toBe(false);
    expect(isDuelType('challenge')).toBe(false);
  });
});

describe('encodeDuel / decodeDuel', () => {
  it('round-trips a fixed region duel', () => {
    const p = payload();
    const decoded = decodeDuel(encodeDuel(p));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.payload).toEqual(p);
  });

  it('round-trips a survival duel (lives, no length)', () => {
    const p = payload({ type: 'survival', lives: 3, length: undefined, region: 'Asia' });
    const decoded = decodeDuel(encodeDuel(p));
    expect(decoded.ok && decoded.payload).toMatchObject({ type: 'survival', lives: 3 });
    if (decoded.ok) expect(decoded.payload.length).toBeUndefined();
  });

  it('round-trips a full whole-world duel (no region, no length)', () => {
    const p = payload({ type: 'full', region: undefined, subregion: undefined, length: undefined });
    const decoded = decodeDuel(encodeDuel(p));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.payload.region).toBeUndefined();
      expect(decoded.payload.length).toBeUndefined();
      expect(decoded.payload.type).toBe('full');
    }
  });

  it('round-trips a blitz duel and a sub-region', () => {
    const p = payload({
      type: 'blitz',
      region: 'Europe',
      subregion: 'Northern Europe',
      length: undefined,
      challengerScore: { primary: 1234, tiebreak: 0 },
    });
    const decoded = decodeDuel(encodeDuel(p));
    expect(decoded.ok && decoded.payload).toMatchObject({
      type: 'blitz',
      subregion: 'Northern Europe',
      challengerScore: { primary: 1234, tiebreak: 0 },
    });
  });

  it('preserves accented names via UTF-8-safe base64url', () => {
    const p = payload({ challengerName: 'Zoé — Škoda 🌍' });
    const decoded = decodeDuel(encodeDuel(p));
    expect(decoded.ok && decoded.payload.challengerName).toBe('Zoé — Škoda 🌍');
  });

  it('produces a URL-safe code (no +, /, or = padding)', () => {
    const code = encodeDuel(payload({ challengerName: 'lots of padding needed here ????' }));
    expect(code).not.toMatch(/[+/=]/);
  });

  it('normalises the seed to an unsigned 32-bit int on both ends', () => {
    const decoded = decodeDuel(encodeDuel(payload({ seed: 0xffffffff })));
    expect(decoded.ok && decoded.payload.seed).toBe(0xffffffff);
    expect(decoded.ok && decoded.payload.seed).toBeGreaterThanOrEqual(0);
  });
});

describe('decodeDuel — graceful failure', () => {
  it('rejects a non-base64url / non-JSON code as malformed', () => {
    expect(decodeDuel('!!!not a code!!!')).toEqual({ ok: false, error: 'malformed' });
    expect(decodeDuel('')).toEqual({ ok: false, error: 'malformed' });
  });

  it('rejects a valid base64url of non-object JSON as malformed', () => {
    const code = encodeDuelRaw(JSON.stringify(42));
    expect(decodeDuel(code)).toEqual({ ok: false, error: 'malformed' });
  });

  it('flags a foreign / future protocol version distinctly', () => {
    const code = encodeDuelRaw(JSON.stringify({ ...wire(), v: 999 }));
    expect(decodeDuel(code)).toEqual({ ok: false, error: 'unsupported-protocol' });
  });

  it('rejects a missing version as malformed', () => {
    const w = wire();
    delete (w as Record<string, unknown>).v;
    expect(decodeDuel(encodeDuelRaw(JSON.stringify(w)))).toEqual({ ok: false, error: 'malformed' });
  });

  it('rejects an unknown format as invalid', () => {
    const code = encodeDuelRaw(JSON.stringify({ ...wire(), t: 'training' }));
    expect(decodeDuel(code)).toEqual({ ok: false, error: 'invalid' });
  });

  it('rejects a tampered numeric field as invalid', () => {
    const code = encodeDuelRaw(JSON.stringify({ ...wire(), s: 'not-a-number' }));
    expect(decodeDuel(code)).toEqual({ ok: false, error: 'invalid' });
  });

  it('rejects a missing required field as invalid', () => {
    const w = wire();
    delete (w as Record<string, unknown>).c; // choices
    expect(decodeDuel(encodeDuelRaw(JSON.stringify(w)))).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('duelScore', () => {
  it('blitz → points, no tiebreak', () => {
    const results = [result(true, 800), result(true, 900), result(true, 1200)];
    const s = summary({ type: 'blitz', results });
    expect(duelScore('blitz', s)).toEqual({ primary: computeBlitzPoints(results), tiebreak: 0 });
  });

  it('fixed / full → correct answers, tiebreak = duration (faster better)', () => {
    const s = summary({ type: 'fixed', correct: 7, durationMs: 40000 });
    expect(duelScore('fixed', s)).toEqual({ primary: 7, tiebreak: 40000 });
    expect(duelScore('full', summary({ type: 'full', correct: 50, durationMs: 120000 }))).toEqual({
      primary: 50,
      tiebreak: 120000,
    });
  });

  it('survival → distance reached (total), tiebreak = duration', () => {
    const s = summary({ type: 'survival', total: 23, durationMs: 60000 });
    expect(duelScore('survival', s)).toEqual({ primary: 23, tiebreak: 60000 });
  });
});

describe('duelVerdict', () => {
  it('higher primary wins regardless of tiebreak', () => {
    expect(duelVerdict({ primary: 9, tiebreak: 99999 }, { primary: 8, tiebreak: 1 })).toBe('win');
    expect(duelVerdict({ primary: 7, tiebreak: 1 }, { primary: 8, tiebreak: 99999 })).toBe('loss');
  });

  it('equal primary → faster (lower tiebreak) wins', () => {
    expect(duelVerdict({ primary: 8, tiebreak: 30000 }, { primary: 8, tiebreak: 40000 })).toBe(
      'win',
    );
    expect(duelVerdict({ primary: 8, tiebreak: 50000 }, { primary: 8, tiebreak: 40000 })).toBe(
      'loss',
    );
  });

  it('equal on both is a tie (e.g. blitz points tie with tiebreak 0)', () => {
    expect(duelVerdict({ primary: 1200, tiebreak: 0 }, { primary: 1200, tiebreak: 0 })).toBe('tie');
  });
});

// --- helpers that reach the private wire shape via the public codec (tamper simulation) ---

/** The compact wire object matching a valid `payload()`, for tamper tests. */
function wire(): Record<string, unknown> {
  return {
    v: DUEL_PROTOCOL_VERSION,
    d: 'v1',
    m: 'flag-to-country',
    t: 'fixed',
    c: 4,
    s: 123,
    p: 'A',
    sp: 8,
    sb: 42000,
    r: 'Europe',
    n: 10,
  };
}

/** base64url of an arbitrary JSON string — mirrors the codec's own encoding so we can craft codes. */
function encodeDuelRaw(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
