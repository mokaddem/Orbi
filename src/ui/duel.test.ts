import { describe, it, expect } from 'vitest';
import type { SessionSummary } from '../domain';
import { decodeDuel, encodeDuel } from '../domain';
import {
  buildDuelPayload,
  buildReturnPayload,
  duelDataVersion,
  duelLink,
  duelToRunConfig,
  readDuelQuery,
} from './duel';

function summary(over: Partial<SessionSummary> = {}): SessionSummary {
  return {
    mode: 'flag-to-country',
    type: 'fixed',
    regionFilter: { region: 'Europe' },
    total: 12,
    correct: 9,
    accuracy: 0.75,
    bestStreak: 5,
    startedAt: 1000,
    finishedAt: 61000,
    durationMs: 60000,
    missed: [],
    results: [],
    choices: 4,
    seed: 0x1234abcd,
    ...over,
  };
}

describe('duelDataVersion', () => {
  it('is a stable, non-empty fingerprint', () => {
    const a = duelDataVersion();
    expect(a).toBeTruthy();
    expect(duelDataVersion()).toBe(a);
  });
});

describe('buildDuelPayload', () => {
  it('encodes a fixed region run (length = total, region, choices, seed, score)', () => {
    const p = buildDuelPayload(summary(), 'Sami', 'v1');
    expect(p).toMatchObject({
      mode: 'flag-to-country',
      type: 'fixed',
      region: 'Europe',
      length: 12,
      choices: 4,
      seed: 0x1234abcd,
      challengerName: 'Sami',
      dataVersion: 'v1',
    });
    // fixed/full score = correct answers.
    expect(p!.challengerScore.primary).toBe(9);
  });

  it('carries lives (not length) for a survival run', () => {
    const p = buildDuelPayload(summary({ type: 'survival', lives: 3 }), 'A', 'v1');
    expect(p!.lives).toBe(3);
    expect(p!.length).toBeUndefined();
  });

  it('returns null for a non-duel-able format or an unseeded run', () => {
    expect(buildDuelPayload(summary({ type: 'training' }), 'A', 'v1')).toBeNull();
    expect(buildDuelPayload(summary({ seed: undefined }), 'A', 'v1')).toBeNull();
  });
});

describe('duelToRunConfig', () => {
  it('maps region/length/choices/seed onto a launchable config (seed drives the RNG)', () => {
    const p = buildDuelPayload(summary(), 'Sami', 'v1')!;
    const cfg = duelToRunConfig(p);
    expect(cfg).toMatchObject({
      mode: 'flag-to-country',
      type: 'fixed',
      filter: { region: 'Europe' },
      fixedLength: 12,
      choices: 4,
      seed: 0x1234abcd,
    });
    // The seed rides in, not a pre-built rng, so play.start derives mulberry32(seed).
    expect('rng' in cfg).toBe(false);
  });

  it('omits filter for a whole-world run and length for full/survival', () => {
    const world = duelToRunConfig(
      buildDuelPayload(summary({ type: 'full', regionFilter: undefined }), 'A', 'v1')!,
    );
    expect(world.filter).toBeUndefined();
    expect(world.fixedLength).toBeUndefined();
  });
});

describe('buildReturnPayload', () => {
  it('attaches the responder name + score to the original challenge', () => {
    const challenge = buildDuelPayload(summary(), 'Sami', 'v1')!;
    const ret = buildReturnPayload(challenge, 'Alex', summary({ correct: 11 }));
    expect(ret.challengerName).toBe('Sami');
    expect(ret.opponentName).toBe('Alex');
    expect(ret.opponentScore?.primary).toBe(11);
  });

  it('survives a codec round-trip (return leg carries both scores)', () => {
    const challenge = buildDuelPayload(summary(), 'Sami', 'v1')!;
    const ret = buildReturnPayload(challenge, 'Alex', summary({ correct: 11 }));
    const decoded = decodeDuel(encodeDuel(ret));
    expect(decoded.ok && decoded.payload.opponentScore?.primary).toBe(11);
    expect(decoded.ok && decoded.payload.opponentName).toBe('Alex');
  });
});

describe('duelLink / readDuelQuery', () => {
  it('mints a #/duel link for a leg and reads it back', () => {
    const url = duelLink('ABC123', 'c');
    expect(url).toContain('#/duel?c=ABC123');
    expect(readDuelQuery('c=ABC123')).toEqual({ leg: 'c', code: 'ABC123' });
    expect(readDuelQuery('r=ZZZ')).toEqual({ leg: 'r', code: 'ZZZ' });
    expect(readDuelQuery('')).toBeNull();
    expect(readDuelQuery(undefined)).toBeNull();
  });
});
