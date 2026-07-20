import { describe, it, expect } from 'vitest';
import { decodeGmInvite, GM_INVITE_PROTOCOL_VERSION } from '../domain';
import {
  buildInvitePayload,
  challengeInviteLink,
  inviteLinkFor,
  readChallengeInviteQuery,
  renderInviteCard,
} from './challenge-invite';

describe('buildInvitePayload', () => {
  it('stamps the protocol version and carries family / region / name', () => {
    expect(buildInvitePayload('flags', 'Africa', 'Sami')).toEqual({
      protocolVersion: GM_INVITE_PROTOCOL_VERSION,
      family: 'flags',
      region: 'Africa',
      challengerName: 'Sami',
    });
  });
});

describe('challengeInviteLink / readChallengeInviteQuery', () => {
  it('mints a #/challenge-invite link and reads the code back', () => {
    const url = challengeInviteLink('ABC123');
    expect(url).toContain('#/challenge-invite?c=ABC123');
    expect(readChallengeInviteQuery('c=ABC123')).toEqual({ code: 'ABC123' });
    expect(readChallengeInviteQuery('')).toBeNull();
    expect(readChallengeInviteQuery(undefined)).toBeNull();
    // No return leg — an `r=` code is not an invite.
    expect(readChallengeInviteQuery('r=ZZZ')).toBeNull();
  });
});

describe('inviteLinkFor', () => {
  it('round-trips: the minted link carries a code that decodes to the same capstone', () => {
    const url = inviteLinkFor('capitals', 'Asia', 'Zoé 🌍');
    const query = readChallengeInviteQuery(url.split('?')[1]);
    expect(query).not.toBeNull();
    const decoded = decodeGmInvite(query!.code);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.payload.family).toBe('capitals');
      expect(decoded.payload.region).toBe('Asia');
      expect(decoded.payload.challengerName).toBe('Zoé 🌍');
    }
  });
});

describe('renderInviteCard', () => {
  it('resolves to null (never throws) when canvas 2D is unavailable (jsdom)', async () => {
    const blob = await renderInviteCard(
      {
        eyebrow: 'Sami challenges you',
        title: 'Flags · Africa',
        subhead: '…',
        hint: 'Scan',
        brand: 'Orbi',
      },
      'https://example.test/#/challenge-invite?c=ABC',
    );
    // jsdom has no 2D context, so the renderer bails gracefully rather than throwing.
    expect(blob).toBeNull();
  });
});
