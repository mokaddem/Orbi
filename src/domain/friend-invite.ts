// Friend invite codec (Phase 53) — pure, framework-agnostic, unit-testable.
//
// A friend invite is a tiny, shareable payload carrying the INVITER's `users` record id (so the
// receiver knows who to connect with) plus their display name (so the received screen can greet them).
// It rides in a `#/friend-invite?c=<code>` link / QR (reusing the Phase-46 share surfaces). Opening a
// fresh invite while signed into an account establishes an instant mutual friendship (OQ3) — the link
// is the consent. Ids aren't exposed anywhere else in the app, so possession of the link is the
// capability; anti-cheat is a non-goal, so no server-side token is enforced this slice (a rotatable
// guard token is future hardening — see the PRD OQ2).
//
// Like the duel codec, this is 100% client-side (no DOM/storage/dataset) and NEVER throws on decode: a
// corrupt or foreign code returns a typed failure so the UI can show a friendly "broken link" state.

import { fromBase64Url, toBase64Url } from './base64url';

/** Bumped only for a breaking change to the code's structure (keys/shape). */
export const FRIEND_INVITE_PROTOCOL_VERSION = 1;

/** The decoded content of a friend-invite code. */
export interface FriendInvitePayload {
  protocolVersion: number;
  /** The inviter's `users` record id — who the receiver connects with. */
  uid: string;
  /** The inviter's display name (cosmetic; may be empty). */
  name: string;
}

/** Compact on-the-wire shape (short keys keep the code short). Mirrored by {@link decodeFriendInvite}. */
interface FriendInviteWire {
  v: number; // protocolVersion
  u: string; // uid
  n?: string; // name
}

/** Why a code failed to decode. */
export type FriendInviteDecodeError = 'malformed' | 'unsupported-protocol' | 'invalid';

/** Result of {@link decodeFriendInvite}: the payload, or a typed reason it failed (never throws). */
export type FriendInviteDecodeResult =
  { ok: true; payload: FriendInvitePayload } | { ok: false; error: FriendInviteDecodeError };

/** Encode a friend-invite payload into a compact, URL-safe code (goes into `#/friend-invite?c=<code>`). */
export function encodeFriendInvite(payload: FriendInvitePayload): string {
  const wire: FriendInviteWire = {
    v: payload.protocolVersion,
    u: payload.uid,
    ...(payload.name ? { n: payload.name } : {}),
  };
  return toBase64Url(JSON.stringify(wire));
}

/**
 * Decode a friend-invite code back into a {@link FriendInvitePayload}, or a typed failure. Never
 * throws: a corrupt, hand-mangled, or foreign code returns `{ ok: false, error }`.
 */
export function decodeFriendInvite(code: string): FriendInviteDecodeResult {
  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(code.trim()));
  } catch {
    return { ok: false, error: 'malformed' };
  }
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'malformed' };
  const w = raw as Record<string, unknown>;

  if (typeof w.v !== 'number' || !Number.isFinite(w.v)) return { ok: false, error: 'malformed' };
  if (w.v !== FRIEND_INVITE_PROTOCOL_VERSION) return { ok: false, error: 'unsupported-protocol' };

  // A usable uid is required; the name is optional.
  if (typeof w.u !== 'string' || w.u.trim() === '') return { ok: false, error: 'invalid' };
  if (w.n !== undefined && typeof w.n !== 'string') return { ok: false, error: 'invalid' };

  return {
    ok: true,
    payload: {
      protocolVersion: w.v,
      uid: w.u,
      name: typeof w.n === 'string' ? w.n : '',
    },
  };
}
