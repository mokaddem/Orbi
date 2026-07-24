// Backend duel-inbox operations (Phase 54) — thin, never-throwing pb ops over the `duels` collection
// (see the `1721590000_created_duels` migration), built on the Foundation seam.
//
// Like `board.ts`/`friends.ts`, this talks to PocketBase but is NOT the SDK importer: it uses the
// shared client from `client.ts` and imports SDK *types* only. It carries no Svelte stores and no
// local persistence — the orchestration (gating on backend + account tier, the reactive inbox/history,
// the friend pre-check) lives one layer up in `ui/stores/duels.ts`.
//
// Every function is best-effort: it resolves to a value / `null` / `false` / `[]` on ANY failure (no
// backend, offline, not signed in, a rule denial) and NEVER throws. The signed-in user's id is
// resolved INSIDE this seam from the cached auth record — callers pass only the *other* endpoint's id
// (from the friend list) and the already-encoded challenge, never their own id.
//
// The duel DOMAIN (`src/domain/duel.ts`) is reused verbatim: the `challenge` column stores exactly the
// Phase-46 `encodeDuel(payload)` string (the challenger's name + score ride inside it), so this module
// deals only in the *transport* — the two `DuelScore`s as int columns, the status, and the per-side
// dismiss flags. Decoding the challenge (scope + challenger name) happens one layer up.

import type { RecordModel } from 'pocketbase';
import type { DuelScore } from '../domain';
import { getClient } from './client';

/** The projection of a raw `duels` row the store/UI consumes. The challenger's name + the run scope
 *  live inside {@link challenge} (decoded upstream); this view carries only the transport fields. */
export interface DuelRecordView {
  id: string;
  challengerId: string;
  opponentId: string;
  /** The exact Phase-46 `encodeDuel(payload)` string — decoded upstream for scope + challenger name. */
  challenge: string;
  challengerScore: DuelScore;
  /** The opponent's score once they've played; `null` while `status === 'pending'`. */
  opponentScore: DuelScore | null;
  status: 'pending' | 'complete';
  /** Denormalized so the challenger's history renders without a join. */
  opponentName: string;
  challengerDismissed: boolean;
  opponentDismissed: boolean;
  /** PocketBase autodate — when the duel was created. Drives the outbox "sent Xago". */
  created: string;
  /** Server-stamped invite lifetime (created + 7d). Empty on pre-TTL rows (treated as no expiry). */
  expiresAt: string;
}

/** Clamp to a non-negative integer — the server score fields are `min: 0, onlyInt` (the `stats`
 *  pattern). A malformed local value can never violate the collection's field constraints. */
function nat(n: number): number {
  return Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));
}

/** Escape a value for safe interpolation into a PocketBase filter string literal. */
function filterQuote(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

const relId = (v: unknown): string => (typeof v === 'string' ? v : '');
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const bool = (v: unknown): boolean => v === true;

/** Map a raw `duels` record to the app's view. The opponent's score is surfaced only once the duel is
 *  `complete` (the columns read 0 while pending — `status`, not a nullable score, marks "not played"). */
export function duelViewFromRecord(record: RecordModel): DuelRecordView {
  const status = record.status === 'complete' ? 'complete' : 'pending';
  return {
    id: str(record.id),
    challengerId: relId(record.challenger),
    opponentId: relId(record.opponent),
    challenge: str(record.challenge),
    challengerScore: {
      primary: num(record.challengerPrimary),
      tiebreak: num(record.challengerTiebreak),
    },
    opponentScore:
      status === 'complete'
        ? { primary: num(record.opponentPrimary), tiebreak: num(record.opponentTiebreak) }
        : null,
    status,
    opponentName: str(record.opponentName),
    challengerDismissed: bool(record.challengerDismissed),
    opponentDismissed: bool(record.opponentDismissed),
    created: str(record.created),
    expiresAt: str(record.expiresAt),
  };
}

/**
 * Send a duel to an accepted friend: create a `pending` row with the caller as `challenger`, the
 * already-encoded Phase-46 `challenge`, and the challenger's score. The `challenger` relation is bound
 * from the cached auth record — never from the caller. Returns the new row id, or `null` with no
 * backend / not signed in / a rule denial (e.g. `opponentId` is not an accepted friend — the server's
 * friend-gated create rule rejects it). Never throws.
 */
export async function sendDuel(
  opponentId: string,
  challenge: string,
  challengerScore: DuelScore,
  opponentName: string,
): Promise<string | null> {
  const pb = await getClient();
  if (!pb) return null;
  const me = pb.authStore.record?.id;
  if (!me || !opponentId || opponentId === me) return null;
  try {
    const row = await pb.collection('duels').create({
      challenger: me,
      opponent: opponentId,
      challenge,
      challengerPrimary: nat(challengerScore.primary),
      challengerTiebreak: nat(challengerScore.tiebreak),
      status: 'pending',
      opponentName: opponentName.slice(0, 24),
    });
    return typeof row.id === 'string' ? row.id : null;
  } catch {
    return null; // offline, not-a-friend (create rule), validation, …
  }
}

/**
 * Pending duels awaiting MY play (I'm the opponent), newest first. `[]` on any failure. Never throws.
 * A DECLINED duel — one I set `opponentDismissed` on without playing — is excluded, so declining takes
 * it out of my inbox (it stays `pending`, so the challenger's outbox can still show it as declined).
 */
export async function listInbox(): Promise<DuelRecordView[]> {
  const pb = await getClient();
  if (!pb) return [];
  const me = pb.authStore.record?.id;
  if (!me) return [];
  try {
    const rows = await pb.collection('duels').getFullList({
      // The expiry guard drops invites past their TTL server-side (an expired challenge disappears
      // from the inbox); `expiresAt = ""` keeps pre-TTL rows (no stamp) visible rather than hiding
      // legitimate in-flight duels. The sender still sees expired ones in their outbox.
      filter: `opponent = "${filterQuote(me)}" && status = "pending" && opponentDismissed != true && (expiresAt = "" || expiresAt > @now)`,
      sort: '-created',
      // Distinct requestKey per list: the inbox + history refresh CONCURRENTLY
      // (`runRefresh` Promise.all) and hit the same `duels` endpoint, so the SDK's default
      // auto-cancellation would abort one of the pair ("Fetch request failed") and it would
      // silently return []. A unique key stops them cancelling each other while still
      // letting a newer refresh of THIS list supersede a stale in-flight one.
      requestKey: 'duels-inbox',
    });
    return rows.map(duelViewFromRecord);
  } catch {
    return [];
  }
}

/**
 * Pending duels I SENT, awaiting the opponent (I'm the challenger), newest first. Never throws. These
 * are the challenger's "waiting for them to play" list; one the opponent declined (its
 * `opponentDismissed` flag) still appears here (still `pending`) so the UI can show it as declined —
 * until I clear it with my own `challengerDismissed` flag, which drops it from this list.
 */
export async function listOutbox(): Promise<DuelRecordView[]> {
  const pb = await getClient();
  if (!pb) return [];
  const me = pb.authStore.record?.id;
  if (!me) return [];
  try {
    const rows = await pb.collection('duels').getFullList({
      filter: `challenger = "${filterQuote(me)}" && status = "pending" && challengerDismissed != true`,
      sort: '-created',
      requestKey: 'duels-outbox', // see listInbox — avoid the concurrent auto-cancel collision
    });
    return rows.map(duelViewFromRecord);
  } catch {
    return [];
  }
}

/**
 * Write MY result to a duel I received and flip it to `complete` (I'm the opponent). Best-effort:
 * `false` with no backend / not signed in / on failure. Never throws. (The server's endpoints-only
 * update rule allows only the two endpoints; anti-cheat is a non-goal, so no field-level enforcement.)
 */
export async function submitResult(duelId: string, opponentScore: DuelScore): Promise<boolean> {
  const pb = await getClient();
  if (!pb) return false;
  if (!pb.authStore.record?.id || !duelId) return false;
  try {
    await pb.collection('duels').update(duelId, {
      opponentPrimary: nat(opponentScore.primary),
      opponentTiebreak: nat(opponentScore.tiebreak),
      status: 'complete',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Completed duels I'm an endpoint of, minus the ones I've dismissed (per-side flag), newest first.
 * `[]` on any failure. Never throws.
 */
export async function listHistory(): Promise<DuelRecordView[]> {
  const pb = await getClient();
  if (!pb) return [];
  const me = pb.authStore.record?.id;
  if (!me) return [];
  const q = filterQuote(me);
  try {
    const rows = await pb.collection('duels').getFullList({
      filter:
        `status = "complete" && (` +
        `(challenger = "${q}" && challengerDismissed != true)` +
        ` || (opponent = "${q}" && opponentDismissed != true))`,
      sort: '-created',
      requestKey: 'duels-history', // see listInbox — avoid the concurrent auto-cancel collision
    });
    return rows.map(duelViewFromRecord);
  } catch {
    return [];
  }
}

/**
 * Hide a completed duel from MY history by setting my own per-side dismiss flag (never a hard delete —
 * the other endpoint keeps their record). Reads the row to learn which side I am, then flips the
 * matching flag. Best-effort; `false` on any failure. Never throws.
 */
export async function dismissDuel(duelId: string): Promise<boolean> {
  const pb = await getClient();
  if (!pb) return false;
  const me = pb.authStore.record?.id;
  if (!me || !duelId) return false;
  try {
    const row = await pb.collection('duels').getOne(duelId);
    const field =
      relId(row.challenger) === me
        ? 'challengerDismissed'
        : relId(row.opponent) === me
          ? 'opponentDismissed'
          : null;
    if (!field) return false; // not an endpoint — nothing we could dismiss
    await pb.collection('duels').update(duelId, { [field]: true });
    return true;
  } catch {
    return false;
  }
}
