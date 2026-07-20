import { describe, it, expect } from 'vitest';
import {
  GM_INVITE_PROTOCOL_VERSION,
  type GrandmasterInvitePayload,
  decodeGmInvite,
  encodeGmInvite,
  isMasteryFamily,
} from './grandmaster-invite';
import { toBase64Url } from './base64url';

function payload(overrides: Partial<GrandmasterInvitePayload> = {}): GrandmasterInvitePayload {
  return {
    protocolVersion: GM_INVITE_PROTOCOL_VERSION,
    family: 'flags',
    region: 'Africa',
    challengerName: 'Sami',
    ...overrides,
  };
}

describe('isMasteryFamily', () => {
  it('accepts the three mastery families and rejects everything else', () => {
    expect(isMasteryFamily('map')).toBe(true);
    expect(isMasteryFamily('flags')).toBe(true);
    expect(isMasteryFamily('capitals')).toBe(true);
    expect(isMasteryFamily('languages')).toBe(false);
    expect(isMasteryFamily('blitz')).toBe(false);
    expect(isMasteryFamily('')).toBe(false);
    expect(isMasteryFamily(undefined)).toBe(false);
    expect(isMasteryFamily(3)).toBe(false);
  });
});

describe('encodeGmInvite / decodeGmInvite', () => {
  it('round-trips a flags × Africa invite', () => {
    const p = payload();
    const decoded = decodeGmInvite(encodeGmInvite(p));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.payload).toEqual(p);
  });

  it('round-trips every family', () => {
    for (const family of ['map', 'flags', 'capitals'] as const) {
      const p = payload({ family, region: 'Asia' });
      const decoded = decodeGmInvite(encodeGmInvite(p));
      expect(decoded.ok).toBe(true);
      if (decoded.ok) expect(decoded.payload.family).toBe(family);
    }
  });

  it('preserves an accented / unicode challenger name', () => {
    const p = payload({ challengerName: 'Zoé 🌍 Þórdís' });
    const decoded = decodeGmInvite(encodeGmInvite(p));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.payload.challengerName).toBe('Zoé 🌍 Þórdís');
  });

  it('accepts an empty challenger name (anonymous invite)', () => {
    const decoded = decodeGmInvite(encodeGmInvite(payload({ challengerName: '' })));
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.payload.challengerName).toBe('');
  });

  it('the code is URL-safe (no +, /, or = padding)', () => {
    const code = encodeGmInvite(payload({ challengerName: 'Zoé 🌍 Þórdís' }));
    expect(code).not.toMatch(/[+/=]/);
  });

  it('produces a distinct, smaller code than a duel (no seed/score)', () => {
    // A sanity check that the invite stays compact — comfortably QR-able.
    expect(encodeGmInvite(payload()).length).toBeLessThan(80);
  });
});

describe('decodeGmInvite — graceful failure', () => {
  it('reports malformed for junk / non-base64url / non-JSON', () => {
    expect(decodeGmInvite('not a code!!!').ok).toBe(false);
    expect(decodeGmInvite('').ok).toBe(false);
    const decoded = decodeGmInvite('%%%');
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.error).toBe('malformed');
  });

  it('reports malformed for a JSON payload that is not an object', () => {
    const decoded = decodeGmInvite(toBase64Url(JSON.stringify(42)));
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.error).toBe('malformed');
  });

  it('reports unsupported-protocol for a newer version', () => {
    const code = toBase64Url(
      JSON.stringify({ v: GM_INVITE_PROTOCOL_VERSION + 1, f: 'flags', r: 'Africa', p: 'Sami' }),
    );
    const decoded = decodeGmInvite(code);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.error).toBe('unsupported-protocol');
  });

  it('reports invalid for an unknown family', () => {
    const code = toBase64Url(
      JSON.stringify({ v: GM_INVITE_PROTOCOL_VERSION, f: 'languages', r: 'Africa', p: 'Sami' }),
    );
    const decoded = decodeGmInvite(code);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.error).toBe('invalid');
  });

  it('reports invalid for a missing / empty region', () => {
    for (const r of [undefined, '', 5]) {
      const code = toBase64Url(
        JSON.stringify({ v: GM_INVITE_PROTOCOL_VERSION, f: 'flags', r, p: 'Sami' }),
      );
      const decoded = decodeGmInvite(code);
      expect(decoded.ok).toBe(false);
      if (!decoded.ok) expect(decoded.error).toBe('invalid');
    }
  });

  it('reports invalid for a non-string name', () => {
    const code = toBase64Url(
      JSON.stringify({ v: GM_INVITE_PROTOCOL_VERSION, f: 'flags', r: 'Africa', p: 7 }),
    );
    const decoded = decodeGmInvite(code);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) expect(decoded.error).toBe('invalid');
  });

  it('tolerates leading/trailing whitespace in a code', () => {
    const code = encodeGmInvite(payload());
    expect(decodeGmInvite(`  ${code}  `).ok).toBe(true);
  });
});
