import { describe, it, expect } from 'vitest';
import {
  encodeFriendInvite,
  decodeFriendInvite,
  FRIEND_INVITE_PROTOCOL_VERSION,
} from './friend-invite';

describe('friend-invite codec', () => {
  it('round-trips a payload', () => {
    const p = { protocolVersion: FRIEND_INVITE_PROTOCOL_VERSION, uid: 'usr_123', name: 'Ada' };
    expect(decodeFriendInvite(encodeFriendInvite(p))).toEqual({ ok: true, payload: p });
  });

  it('defaults a missing name to empty (and stays valid)', () => {
    const code = encodeFriendInvite({ protocolVersion: 1, uid: 'usr_123', name: '' });
    const r = decodeFriendInvite(code);
    expect(r.ok && r.payload.name).toBe('');
    expect(r.ok && r.payload.uid).toBe('usr_123');
  });

  it('rejects a malformed (non-base64/JSON) code', () => {
    expect(decodeFriendInvite('@@@ not a code @@@')).toEqual({ ok: false, error: 'malformed' });
  });

  it('rejects an unsupported protocol version', () => {
    const code = encodeFriendInvite({ protocolVersion: 999, uid: 'usr_123', name: 'x' });
    expect(decodeFriendInvite(code)).toEqual({ ok: false, error: 'unsupported-protocol' });
  });

  it('rejects a structurally invalid payload (missing uid)', () => {
    const code = encodeFriendInvite({ protocolVersion: 1, uid: '', name: 'x' });
    expect(decodeFriendInvite(code)).toEqual({ ok: false, error: 'invalid' });
  });
});
