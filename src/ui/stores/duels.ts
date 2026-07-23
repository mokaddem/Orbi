// Duel-inbox orchestration (Phase 54) — the reactive inbox + history the `#/duels` route reads, and
// the actions the Summary send-flow and the inbox accept/finish call. It composes the backend duel
// seam (`backend/duels.ts`), the backend config (`backend/client.ts`), the friend graph (for the
// send-time friend pre-check + resolving "who am I" from the seam) and the identity store (the account
// gate). It holds the pending inbox + completed history as RENDER-READY entries: the transport row is
// decoded (the Phase-46 `challenge` → scope + challenger name) and the verdict is computed from MY
// perspective, so the route is a thin renderer.
//
// Contract (inherited): everything is best-effort and never throws. With no backend configured, or an
// anonymous identity (Tier < account), the lists are empty and actions no-op with a stable code — the
// full Phase-46 link/QR/code duel is unaffected (it lives entirely on the Summary route). No timers,
// no idle polling: refresh is on load + focus/online (the App re-probe wiring) + after each action.

import { get, writable, derived, type Readable } from 'svelte/store';
import {
  decodeDuel,
  duelVerdict,
  type DuelPayload,
  type DuelScore,
  type DuelVerdict,
} from '../../domain';
import { isBackendConfigured } from '../../backend/client';
import {
  sendDuel,
  submitResult,
  listInbox,
  listOutbox,
  listHistory,
  dismissDuel,
  type DuelRecordView,
} from '../../backend/duels';
import { currentUserId } from '../../backend/friends';
import { identity } from './identity';
import { friends } from './friends';

/** A render-ready duel from MY perspective — the decoded scope + names + my verdict. */
export interface DuelEntry {
  id: string;
  status: 'pending' | 'complete';
  /** True when I sent this duel (I'm the challenger); false when I received it. */
  iAmChallenger: boolean;
  /** The OTHER endpoint's `users` id — the key for the per-friend W/L tally. */
  otherUserId: string;
  /** The other player's display name (from the payload or the denormalized column). */
  otherName: string;
  /** Decoded challenge — scope (mode/type/region/subregion) + seed, for rendering and relaunch. */
  payload: DuelPayload;
  /** The raw encoded challenge, re-decoded by the accept path (exactly like a Phase-46 link). */
  code: string;
  /** My score — `null` for a pending duel I haven't played yet. */
  myScore: DuelScore | null;
  /** The other player's score. */
  theirScore: DuelScore | null;
  /** My head-to-head verdict when complete, else `null`. */
  verdict: DuelVerdict | null;
  /** Outbox only: `true` when the opponent DECLINED this still-pending challenge (never played it). */
  declined: boolean;
}

const inboxStore = writable<DuelEntry[]>([]);
const outboxStore = writable<DuelEntry[]>([]);
const historyStore = writable<DuelEntry[]>([]);

/** Pending duels awaiting MY play (I'm the opponent), newest first. */
export const inbox: Readable<DuelEntry[]> = { subscribe: inboxStore.subscribe };
/** Pending duels I SENT (I'm the challenger): "waiting for them" + any they declined. Newest first. */
export const outbox: Readable<DuelEntry[]> = { subscribe: outboxStore.subscribe };
/** Completed duels I own, minus the ones I dismissed, newest first. */
export const history: Readable<DuelEntry[]> = { subscribe: historyStore.subscribe };
/** Count of pending inbox duels — drives the Home "duels" card badge. */
export const pendingCount: Readable<number> = derived(inboxStore, (rows) => rows.length);

/**
 * The `duels` row id of the inbox duel the player is currently playing, staged by the inbox accept and
 * read by the Summary on finish (or a quit) to write the result back to the SAME row — the server
 * analogue of Phase-46's `pendingDuel`. `null` for an ordinary run or a Phase-46 link duel.
 */
export const pendingInboxDuelId = writable<string | null>(null);

/** Stable result codes the UI localises. */
export type DuelSendResult = 'ok' | 'no-backend' | 'no-account' | 'not-friends' | 'failed';
export type DuelSubmitResult = 'ok' | 'no-backend' | 'no-account' | 'failed';

/** The inbox + history require a real account and a configured backend (inherited from Phase 53). */
function gatedOff(): boolean {
  return !isBackendConfigured() || get(identity).tier !== 'account';
}

/** Build a render-ready entry from a raw row + my id, or `null` if the challenge won't decode. */
function toEntry(view: DuelRecordView, me: string): DuelEntry | null {
  const decoded = decodeDuel(view.challenge);
  if (!decoded.ok) return null; // corrupt / foreign code — unusable (can't show scope or relaunch)
  const payload = decoded.payload;
  const iAmChallenger = view.challengerId === me;
  const myScore = iAmChallenger ? view.challengerScore : view.opponentScore;
  const theirScore = iAmChallenger ? view.opponentScore : view.challengerScore;
  return {
    id: view.id,
    status: view.status,
    iAmChallenger,
    otherUserId: iAmChallenger ? view.opponentId : view.challengerId,
    // The challenger's name rides inside the payload; the opponent's is the denormalized column.
    otherName: iAmChallenger ? view.opponentName : payload.challengerName,
    payload,
    code: view.challenge,
    myScore,
    theirScore,
    verdict:
      view.status === 'complete' && myScore && theirScore ? duelVerdict(myScore, theirScore) : null,
    // A still-pending duel the opponent dismissed = declined (meaningful for the challenger's outbox;
    // a declined duel is filtered out of the opponent's own inbox server-side).
    declined: view.status === 'pending' && view.opponentDismissed,
  };
}

// Coalesce bursts (load + focus + post-action can fire together) without timers: while a refresh is in
// flight, remember one more was asked for and run exactly one follow-up afterwards (the board pattern).
let inFlight: Promise<void> | null = null;
let again = false;

async function runRefresh(): Promise<void> {
  if (gatedOff()) {
    inboxStore.set([]);
    outboxStore.set([]);
    historyStore.set([]);
    return;
  }
  const me = await currentUserId();
  if (!me) {
    inboxStore.set([]);
    outboxStore.set([]);
    historyStore.set([]);
    return;
  }
  // All three hit the same `duels` endpoint concurrently — each list has a distinct requestKey so the
  // SDK's auto-cancellation doesn't abort one of the trio (see `backend/duels.ts`).
  const [inboxRows, outboxRows, historyRows] = await Promise.all([
    listInbox(),
    listOutbox(),
    listHistory(),
  ]);
  inboxStore.set(inboxRows.map((r) => toEntry(r, me)).filter((e): e is DuelEntry => e !== null));
  outboxStore.set(outboxRows.map((r) => toEntry(r, me)).filter((e): e is DuelEntry => e !== null));
  historyStore.set(
    historyRows.map((r) => toEntry(r, me)).filter((e): e is DuelEntry => e !== null),
  );
}

/**
 * Refresh the inbox + outbox + history from the server. No-op (clears all lists) with no backend or
 * an anonymous identity. Coalesced; best-effort; never throws.
 */
export function refreshDuels(): Promise<void> {
  if (inFlight) {
    again = true;
    return inFlight;
  }
  inFlight = runRefresh().finally(() => {
    inFlight = null;
    if (again) {
      again = false;
      void refreshDuels();
    }
  });
  return inFlight;
}

/**
 * Send a duel to an accepted friend (the Summary "Challenge a friend" action). Requires a real account
 * (like friending) and pre-checks the friend graph so a stranger target reports `not-friends` rather
 * than a swallowed server denial. Refreshes on success. Never throws.
 */
export async function send(
  opponentId: string,
  code: string,
  challengerScore: DuelScore,
  opponentName: string,
): Promise<DuelSendResult> {
  if (!isBackendConfigured()) return 'no-backend';
  if (get(identity).tier !== 'account') return 'no-account';
  if (!get(friends).some((f) => f.userId === opponentId)) return 'not-friends';
  const id = await sendDuel(opponentId, code, challengerScore, opponentName);
  if (!id) return 'failed';
  void refreshDuels();
  return 'ok';
}

/**
 * Write my result to a received inbox duel and flip it to complete (called on finish OR a mid-run quit
 * with the partial score). Refreshes on success. Never throws.
 */
export async function submit(duelId: string, opponentScore: DuelScore): Promise<DuelSubmitResult> {
  if (!isBackendConfigured()) return 'no-backend';
  if (get(identity).tier !== 'account') return 'no-account';
  const ok = await submitResult(duelId, opponentScore);
  if (!ok) return 'failed';
  void refreshDuels();
  return 'ok';
}

/** Hide a completed duel from my history (my own per-side flag; never a hard delete). Never throws.
 *  Also clears a declined challenge from my outbox when I'm the challenger. */
export async function dismiss(duelId: string): Promise<boolean> {
  const ok = await dismissDuel(duelId);
  if (ok) void refreshDuels();
  return ok;
}

/**
 * Decline a received inbox duel without playing it (I'm the opponent). Sets my per-side dismiss flag
 * on the still-`pending` row, which takes it out of my inbox while leaving the challenger's outbox to
 * show it as declined. Same backend op as {@link dismiss}; named for the distinct intent. Never throws.
 */
export async function decline(duelId: string): Promise<boolean> {
  const ok = await dismissDuel(duelId);
  if (ok) void refreshDuels();
  return ok;
}

/** Reset store + module state. Test seam only — not used by the app. */
export function __resetDuelsForTests(): void {
  inboxStore.set([]);
  outboxStore.set([]);
  historyStore.set([]);
  pendingInboxDuelId.set(null);
  inFlight = null;
  again = false;
}
