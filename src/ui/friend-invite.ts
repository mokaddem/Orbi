// Friend invite UI glue (Phase 53) — the framework-light bridge between the pure invite codec
// (`domain/friend-invite.ts`) and the routes/components. Builds the shareable payload, mints the
// `#/friend-invite` link, and reuses the generic duel share/clipboard plumbing so a friend invite
// shares exactly like a duel (native sheet on mobile, link/clipboard on desktop). Anything
// DOM / `navigator` lives here, not in the domain.

import {
  FRIEND_INVITE_PROTOCOL_VERSION,
  encodeFriendInvite,
  type FriendInvitePayload,
} from '../domain';
// Generic share/clipboard helpers — reused verbatim from the duel glue.
import { shareDuel, copyToClipboard } from './duel';
import type { DuelShareOutcome } from './duel';

/** Build the shareable {@link FriendInvitePayload} for the signed-in user. */
export function buildFriendInvitePayload(uid: string, name: string): FriendInvitePayload {
  return { protocolVersion: FRIEND_INVITE_PROTOCOL_VERSION, uid, name };
}

/**
 * Absolute, shareable URL for an invite code. Built from the current app URL (origin + path, so it
 * respects any static-host base path such as `/Orbi/`) with a fresh `#/friend-invite?c=<code>` hash.
 */
export function friendInviteLink(code: string): string {
  const base = typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '';
  return `${base}#/friend-invite?c=${code}`;
}

/** Read an invite code from a router querystring, or `null` if absent. */
export function readFriendInviteQuery(querystring: string | undefined): { code: string } | null {
  const code = new URLSearchParams(querystring ?? '').get('c');
  return code ? { code } : null;
}

/** One-tap link mint for the signed-in user's invite. */
export function friendInviteLinkFor(uid: string, name: string): string {
  return friendInviteLink(encodeFriendInvite(buildFriendInvitePayload(uid, name)));
}

/**
 * Share a friend-invite link via the native share sheet (mobile) or copy it (desktop). Returns the
 * outcome so the caller can show a "copied" hint. Never throws.
 */
export async function shareFriendInvite(
  url: string,
  opts: { title: string; text: string },
): Promise<DuelShareOutcome> {
  return shareDuel(url, opts);
}

/** Copy an invite link to the clipboard. Returns success. */
export async function copyFriendInvite(url: string): Promise<boolean> {
  return copyToClipboard(url);
}
