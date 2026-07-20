// Async friend duels (Phase 46) — pure, framework-agnostic, unit-testable.
//
// A **Duel** turns a completed run into a seeded, shareable challenge: a compact code carries
// everything needed to reproduce the *exact* round — mode, format, region scope, option count, life
// count, and the run's seed — plus the challenger's name and score. A friend decodes it, plays the
// identical questions (same order + distractors, because `(config, seed)` is deterministic — see
// `daily.ts` for the precedent), and the two scores are compared.
//
// This module is 100% client-side and knows nothing about the DOM, storage, or the dataset. The
// code is base64url of a compact JSON with short keys; the caller supplies a `dataVersion`
// fingerprint (see `duelDataVersion` in the UI layer) so a decode against a different bundle can
// warn (but is allowed — the PWA auto-updates, so a mismatch is rare). Scores are **self-reported**:
// the code can be edited by hand. That is acceptable for friendly play and stated in the UI; real
// verification would need a server and is explicitly future work.

import type { SessionSummary, SessionType } from './types';
import { computeBlitzPoints } from './blitz';
import { fromBase64Url, toBase64Url } from './base64url';

/** Bumped only for a breaking change to the code's *structure* (keys/shape), not its data. */
export const DUEL_PROTOCOL_VERSION = 1;

/**
 * Minimum questions answered for a run to be duel-able (OQ1). Below this a duel is meaningless (a
 * 2-question survival death, a tiny blitz). Read by the Summary gate.
 */
export const MIN_DUEL_QUESTIONS = 10;

/**
 * Formats a duel can be issued from — reproducible, prefs-independent runs (OQ2). `training` and the
 * Grandmaster `challenge` are excluded: training draws an SR-derived pool that can't reproduce
 * cross-player, and the Grandmaster capstone has its own "become a grandmaster too" invite (Phase
 * 46b). The Daily is a `fixed` run but is filtered out at the gate (it has its own flow).
 */
export type DuelType = Extract<SessionType, 'fixed' | 'survival' | 'full' | 'blitz'>;

const DUEL_TYPES: readonly DuelType[] = ['fixed', 'survival', 'full', 'blitz'];

/** Is `type` a format a duel can be built from? */
export function isDuelType(type: SessionType): type is DuelType {
  return (DUEL_TYPES as readonly string[]).includes(type);
}

/**
 * A comparable score, format-agnostic. `primary` is the headline number (higher wins); `tiebreak`
 * breaks an equal `primary` with **lower** being better (faster total time). See {@link duelScore}
 * for how each format maps onto it, and {@link duelVerdict} for the comparison.
 */
export interface DuelScore {
  primary: number;
  tiebreak: number;
}

/** The head-to-head outcome from the challengee's point of view (or as computed for either side). */
export type DuelVerdict = 'win' | 'loss' | 'tie';

/**
 * The decoded content of a duel code — everything needed to reproduce the challenger's round and
 * show the head-to-head. Region/subregion are absent for a whole-world run; `length` is set only for
 * `fixed` (the question count), `lives` only for `survival` (the end condition); `full` derives its
 * length from the region + dataset and `blitz` is time-boxed, so neither carries a count.
 */
export interface DuelPayload {
  /** Structure version of the code (see {@link DUEL_PROTOCOL_VERSION}). */
  protocolVersion: number;
  /** Opaque dataset/app fingerprint; questions only match on the same bundle (compared, not trusted). */
  dataVersion: string;
  mode: SessionSummary['mode'];
  type: DuelType;
  region?: string;
  subregion?: string;
  /** `fixed` only — number of questions. */
  length?: number;
  /** `survival` only — number of lives. */
  lives?: number;
  /** Options per question (distractor sampling). */
  choices: number;
  /** The run's RNG seed — reproduces question order + distractors. */
  seed: number;
  /** The challenger's display name (cosmetic; may be empty). */
  challengerName: string;
  /** The challenger's score, for the head-to-head. */
  challengerScore: DuelScore;
  /**
   * Return leg only (Phase 46): the responder's name — present on a `#/duel?r=…` code the challengee
   * sends back so the original challenger sees who took the challenge. Absent on an outgoing `c=` code.
   */
  opponentName?: string;
  /** Return leg only: the responder's score, for the head-to-head. Absent on an outgoing `c=` code. */
  opponentScore?: DuelScore;
}

/**
 * Map a finished run onto its comparable {@link DuelScore} (OQ2):
 * - **blitz** → points (its whole point); no tiebreak (equal points is a genuine tie).
 * - **fixed / full** → correct answers; tiebreak = faster total time.
 * - **survival** → distance reached (questions faced before the run ended); tiebreak = faster time.
 *
 * `tiebreak` is stored as the raw duration in ms (lower = faster = better); blitz stores `0` so an
 * equal-points blitz is a tie, never broken by time.
 */
export function duelScore(type: DuelType, summary: SessionSummary): DuelScore {
  switch (type) {
    case 'blitz':
      return { primary: computeBlitzPoints(summary.results), tiebreak: 0 };
    case 'survival':
      // Distance reached = questions faced. With an identical seed + lives, getting further means
      // surviving more of the same sequence; a faster clear/run breaks a tie.
      return { primary: summary.total, tiebreak: summary.durationMs };
    case 'fixed':
    case 'full':
      return { primary: summary.correct, tiebreak: summary.durationMs };
  }
}

/**
 * Compare two scores. Higher `primary` wins; on a tie, **lower** `tiebreak` (faster) wins; equal on
 * both is a genuine `tie`. `mine` is the reference side, so the verdict reads from its perspective.
 */
export function duelVerdict(mine: DuelScore, theirs: DuelScore): DuelVerdict {
  if (mine.primary !== theirs.primary) return mine.primary > theirs.primary ? 'win' : 'loss';
  if (mine.tiebreak !== theirs.tiebreak) return mine.tiebreak < theirs.tiebreak ? 'win' : 'loss';
  return 'tie';
}

// ---- Codec -----------------------------------------------------------------------------------

/** The compact on-the-wire shape (short keys keep the code short). Mirrored by {@link decodeDuel}. */
interface DuelWire {
  v: number; // protocolVersion
  d: string; // dataVersion
  m: string; // mode
  t: string; // type
  r?: string; // region
  b?: string; // subregion
  n?: number; // length (fixed)
  l?: number; // lives (survival)
  c: number; // choices
  s: number; // seed
  p: string; // challenger name
  sp: number; // score.primary
  sb: number; // score.tiebreak
  op?: string; // opponent (responder) name — return leg
  oq?: number; // opponent score.primary — return leg
  ob?: number; // opponent score.tiebreak — return leg
}

/** Why a code failed to decode. `malformed`: not valid base64url/JSON. `unsupported-protocol`: a
 * newer/older structure we can't read. `invalid`: parsed but structurally wrong (bad/missing field). */
export type DuelDecodeError = 'malformed' | 'unsupported-protocol' | 'invalid';

/** Result of {@link decodeDuel}: the payload, or a typed reason it failed (never throws). */
export type DuelDecodeResult =
  { ok: true; payload: DuelPayload } | { ok: false; error: DuelDecodeError };

/** Encode a duel payload into a compact, URL-safe code (goes into `#/duel?c=<code>`). */
export function encodeDuel(payload: DuelPayload): string {
  const wire: DuelWire = {
    v: payload.protocolVersion,
    d: payload.dataVersion,
    m: payload.mode,
    t: payload.type,
    c: payload.choices,
    s: payload.seed >>> 0,
    p: payload.challengerName,
    sp: payload.challengerScore.primary,
    sb: payload.challengerScore.tiebreak,
    ...(payload.region ? { r: payload.region } : {}),
    ...(payload.subregion ? { b: payload.subregion } : {}),
    ...(payload.length !== undefined ? { n: payload.length } : {}),
    ...(payload.lives !== undefined ? { l: payload.lives } : {}),
    ...(payload.opponentName !== undefined ? { op: payload.opponentName } : {}),
    ...(payload.opponentScore
      ? { oq: payload.opponentScore.primary, ob: payload.opponentScore.tiebreak }
      : {}),
  };
  return toBase64Url(JSON.stringify(wire));
}

const isFiniteNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/**
 * Decode a duel code back into a {@link DuelPayload}, or a typed failure. Never throws: a corrupt,
 * hand-mangled, or foreign code returns `{ ok: false, error }` so the UI can show a friendly
 * "this challenge link looks broken" state (OQ per Technical notes — deep-link robustness).
 */
export function decodeDuel(code: string): DuelDecodeResult {
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
  if (w.v !== DUEL_PROTOCOL_VERSION) return { ok: false, error: 'unsupported-protocol' };

  if (typeof w.t !== 'string' || !isDuelType(w.t as SessionType))
    return { ok: false, error: 'invalid' };
  const type = w.t as DuelType;

  if (typeof w.m !== 'string' || typeof w.d !== 'string' || typeof w.p !== 'string') {
    return { ok: false, error: 'invalid' };
  }
  if (
    !isFiniteNumber(w.c) ||
    !isFiniteNumber(w.s) ||
    !isFiniteNumber(w.sp) ||
    !isFiniteNumber(w.sb)
  ) {
    return { ok: false, error: 'invalid' };
  }
  if (w.r !== undefined && typeof w.r !== 'string') return { ok: false, error: 'invalid' };
  if (w.b !== undefined && typeof w.b !== 'string') return { ok: false, error: 'invalid' };
  if (w.n !== undefined && !isFiniteNumber(w.n)) return { ok: false, error: 'invalid' };
  if (w.l !== undefined && !isFiniteNumber(w.l)) return { ok: false, error: 'invalid' };
  if (w.op !== undefined && typeof w.op !== 'string') return { ok: false, error: 'invalid' };
  if (w.oq !== undefined && !isFiniteNumber(w.oq)) return { ok: false, error: 'invalid' };
  if (w.ob !== undefined && !isFiniteNumber(w.ob)) return { ok: false, error: 'invalid' };

  const payload: DuelPayload = {
    protocolVersion: w.v,
    dataVersion: w.d,
    mode: w.m as DuelPayload['mode'],
    type,
    choices: w.c,
    seed: w.s >>> 0,
    challengerName: w.p,
    challengerScore: { primary: w.sp, tiebreak: w.sb },
    ...(typeof w.r === 'string' ? { region: w.r } : {}),
    ...(typeof w.b === 'string' ? { subregion: w.b } : {}),
    ...(isFiniteNumber(w.n) ? { length: w.n } : {}),
    ...(isFiniteNumber(w.l) ? { lives: w.l } : {}),
    ...(typeof w.op === 'string' ? { opponentName: w.op } : {}),
    ...(isFiniteNumber(w.oq) && isFiniteNumber(w.ob)
      ? { opponentScore: { primary: w.oq, tiebreak: w.ob } }
      : {}),
  };
  return { ok: true, payload };
}
