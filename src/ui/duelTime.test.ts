import { describe, it, expect } from 'vitest';
import { parseCreated, duelAge, duelExpiry, DUEL_EXPIRY_MS } from './duelTime';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = Date.parse('2024-07-21T12:00:00.000Z');

describe('parseCreated', () => {
  it('parses ISO timestamps', () => {
    expect(parseCreated('2024-07-21T12:00:00.000Z')).toBe(NOW);
  });

  it('normalizes the PocketBase space-separated autodate form', () => {
    expect(parseCreated('2024-07-21 12:00:00.000Z')).toBe(NOW);
  });

  it('returns null for empty or unparseable input', () => {
    expect(parseCreated('')).toBeNull();
    expect(parseCreated('not-a-date')).toBeNull();
  });
});

describe('duelAge', () => {
  it('buckets by minute / hour / day', () => {
    expect(duelAge(NOW - 30 * 1000, NOW)).toEqual({ unit: 'now' });
    expect(duelAge(NOW - 5 * MIN, NOW)).toEqual({ unit: 'min', n: 5 });
    expect(duelAge(NOW - 2 * HOUR, NOW)).toEqual({ unit: 'hour', n: 2 });
    expect(duelAge(NOW - 3 * DAY, NOW)).toEqual({ unit: 'day', n: 3 });
  });

  it('floors within a bucket', () => {
    expect(duelAge(NOW - (2 * HOUR + 59 * MIN), NOW)).toEqual({ unit: 'hour', n: 2 });
  });

  it('clamps a future timestamp (clock skew) to "now"', () => {
    expect(duelAge(NOW + HOUR, NOW)).toEqual({ unit: 'now' });
  });
});

describe('duelExpiry', () => {
  it('reports days remaining when over 24h are left', () => {
    // Sent 1 day ago against a 7-day window → ~6 days left.
    expect(duelExpiry(NOW - DAY, NOW)).toEqual({ state: 'ok', days: 6 });
  });

  it('warms to "soon" (hours) under 24h remaining', () => {
    const created = NOW - (DUEL_EXPIRY_MS - 22 * HOUR); // 22h left
    expect(duelExpiry(created, NOW)).toEqual({ state: 'soon', hours: 22 });
  });

  it('marks a past-window challenge expired', () => {
    expect(duelExpiry(NOW - 8 * DAY, NOW)).toEqual({ state: 'expired' });
    expect(duelExpiry(NOW - DUEL_EXPIRY_MS, NOW)).toEqual({ state: 'expired' });
  });

  it('never shows 0h while still alive', () => {
    const created = NOW - (DUEL_EXPIRY_MS - 20 * MIN); // 20 min left
    expect(duelExpiry(created, NOW)).toEqual({ state: 'soon', hours: 1 });
  });
});
