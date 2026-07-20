// Grandmaster "become a grandmaster too" invite (Phase 46b) — pure, framework-agnostic codec.
//
// Where an async **duel** (`duel.ts`) turns a scored run into a seeded head-to-head, a Grandmaster
// **invite** is smaller and scoreless: a certified player dares a friend to sweep the *same*
// continent × family in the one-life arena. It's a mastery test over the whole set, so there is no
// seed and no question order to carry — the receiver's own arena rebuilds the board from their own
// bundle. The payload is just `{ family, region, challengerName }`, kept deliberately separate from
// the (larger, seed-bearing) `DuelPayload` and routed to `#/challenge-invite`, not `#/duel`.
//
// 100% client-side; knows nothing about the DOM, storage, or the dataset. The code is base64url of a
// compact short-key JSON (see `base64url.ts`). There is no score to trust, so — unlike the duel — no
// self-reported number rides along; the receiver simply plays their own certifying run (pass/fail).

import { fromBase64Url, toBase64Url } from './base64url';
import { FAMILIES, type MasteryFamily } from './modes';

/** Bumped only for a breaking change to the code's *structure* (keys/shape), not its data. */
export const GM_INVITE_PROTOCOL_VERSION = 1;

/** Is `value` one of the known mastery families (`map` | `flags` | `capitals`)? */
export function isMasteryFamily(value: unknown): value is MasteryFamily {
  return typeof value === 'string' && FAMILIES.some((f) => f.key === value);
}

/**
 * The decoded content of a Grandmaster invite code — everything needed to open the receiver's arena
 * for the same capstone. No seed (the whole continent is asked, order-independent) and no score (the
 * outcome is simply pass/fail on the receiver's own run).
 */
export interface GrandmasterInvitePayload {
  /** Structure version of the code (see {@link GM_INVITE_PROTOCOL_VERSION}). */
  protocolVersion: number;
  /** The certified family — one of the mastery families. */
  family: MasteryFamily;
  /** The continent's M49 region key (continents only — the arena's scope). */
  region: string;
  /** The challenger's display name (cosmetic; may be empty). */
  challengerName: string;
}

// ---- Codec -----------------------------------------------------------------------------------

/** The compact on-the-wire shape (short keys keep the code short). Mirrored by {@link decodeGmInvite}. */
interface GmInviteWire {
  v: number; // protocolVersion
  f: string; // family
  r: string; // region
  p: string; // challenger name
}

/** Why a code failed to decode. Mirrors {@link import('./duel').DuelDecodeError} for a consistent UI. */
export type GmInviteDecodeError = 'malformed' | 'unsupported-protocol' | 'invalid';

/** Result of {@link decodeGmInvite}: the payload, or a typed reason it failed (never throws). */
export type GmInviteDecodeResult =
  { ok: true; payload: GrandmasterInvitePayload } | { ok: false; error: GmInviteDecodeError };

/** Encode an invite payload into a compact, URL-safe code (goes into `#/challenge-invite?c=<code>`). */
export function encodeGmInvite(payload: GrandmasterInvitePayload): string {
  const wire: GmInviteWire = {
    v: payload.protocolVersion,
    f: payload.family,
    r: payload.region,
    p: payload.challengerName,
  };
  return toBase64Url(JSON.stringify(wire));
}

const isFiniteNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/**
 * Decode an invite code back into a {@link GrandmasterInvitePayload}, or a typed failure. Never
 * throws: a corrupt, hand-mangled, or foreign code returns `{ ok: false, error }` so the UI can show
 * a friendly "this invite link looks broken" state (mirrors {@link import('./duel').decodeDuel}).
 */
export function decodeGmInvite(code: string): GmInviteDecodeResult {
  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(code.trim()));
  } catch {
    return { ok: false, error: 'malformed' };
  }
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'malformed' };
  const w = raw as Record<string, unknown>;

  // Version first: a code from a newer protocol we can't read fails distinctly from junk.
  if (!isFiniteNumber(w.v)) return { ok: false, error: 'malformed' };
  if (w.v !== GM_INVITE_PROTOCOL_VERSION) return { ok: false, error: 'unsupported-protocol' };

  if (!isMasteryFamily(w.f)) return { ok: false, error: 'invalid' };
  if (typeof w.r !== 'string' || w.r.length === 0) return { ok: false, error: 'invalid' };
  if (typeof w.p !== 'string') return { ok: false, error: 'invalid' };

  return {
    ok: true,
    payload: {
      protocolVersion: w.v,
      family: w.f,
      region: w.r,
      challengerName: w.p,
    },
  };
}
