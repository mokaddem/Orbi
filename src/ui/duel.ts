// Duel UI glue (Phase 46) — the framework-light bridge between the pure codec (`domain/duel.ts`) and
// the routes/components. Builds a shareable payload from a finished run, turns a decoded payload back
// into a launchable `RunConfig`, mints share links, and shares/copies them. The domain layer stays
// pure; anything that touches the dataset, the URL, `navigator`, or the clipboard lives here.

import {
  DUEL_PROTOCOL_VERSION,
  duelScore,
  isDuelType,
  type DuelPayload,
  type DuelScore,
} from '../domain';
import type { SessionSummary } from '../domain';
import { getCountries } from '../data';
import type { RunConfig } from './stores/game';

/**
 * A short, opaque fingerprint of the bundled dataset + app build (Phase 46). Two clients reproduce
 * identical questions only on the same bundle, so a decoded duel whose `dataVersion` differs can warn
 * (but is allowed — warn-and-allow per OQ6). Combines the app version (generator logic) with an
 * FNV-1a hash of the sorted ISO set (the country data), so it changes whenever either does.
 */
export function duelDataVersion(): string {
  const isos = getCountries()
    .map((c) => c.iso2)
    .sort()
    .join(',');
  let h = 0x811c9dc5;
  for (let i = 0; i < isos.length; i += 1) {
    h ^= isos.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const appv = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0';
  return `${appv}-${(h >>> 0).toString(36)}`;
}

/**
 * Build the shareable {@link DuelPayload} from a finished run's {@link SessionSummary} + the
 * challenger's display name. Returns `null` when the run can't be dueled (not a duel-able format, or
 * unseeded). The Summary's *gate* (min questions, not-daily, not pool-scoped) is applied separately —
 * this only encodes a run already deemed duel-able.
 */
export function buildDuelPayload(
  summary: SessionSummary,
  challengerName: string,
  dataVersion: string = duelDataVersion(),
): DuelPayload | null {
  if (!isDuelType(summary.type) || summary.seed === undefined) return null;
  const type = summary.type;
  return {
    protocolVersion: DUEL_PROTOCOL_VERSION,
    dataVersion,
    mode: summary.mode,
    type,
    ...(summary.regionFilter?.region ? { region: summary.regionFilter.region } : {}),
    ...(summary.regionFilter?.subregion ? { subregion: summary.regionFilter.subregion } : {}),
    // `fixed` needs its question count; `full` derives it from the region + dataset and `survival`
    // ends on lives/clear, so neither carries a length. `survival` carries its life count instead.
    ...(type === 'fixed' ? { length: summary.total } : {}),
    ...(type === 'survival' && summary.lives !== undefined ? { lives: summary.lives } : {}),
    choices: summary.choices,
    seed: summary.seed,
    challengerName,
    challengerScore: duelScore(type, summary),
  };
}

/**
 * Build the **return-leg** payload the challengee sends back (Phase 46): the original challenge with
 * the responder's name + score attached, so the challenger's `#/duel?r=…` screen shows the
 * head-to-head. The scope/seed/challenger fields ride along unchanged from the original challenge.
 */
export function buildReturnPayload(
  challenge: DuelPayload,
  responderName: string,
  responderSummary: SessionSummary,
): DuelPayload {
  return {
    ...challenge,
    opponentName: responderName,
    opponentScore: duelScore(challenge.type, responderSummary),
  };
}

/**
 * Turn a decoded {@link DuelPayload} into a launchable {@link RunConfig} for the receiving player.
 * The encoded params (region, option count, life count, seed) **override** the challengee's own prefs
 * so both play the identical round — exactly as the Daily Challenge ignores personal settings. The
 * `seed` (not a pre-built `rng`) flows through `play.start`, which derives `mulberry32(seed)`.
 */
export function duelToRunConfig(payload: DuelPayload): RunConfig {
  const filter =
    payload.region || payload.subregion
      ? {
          ...(payload.region ? { region: payload.region } : {}),
          ...(payload.subregion ? { subregion: payload.subregion } : {}),
        }
      : undefined;
  return {
    mode: payload.mode,
    type: payload.type,
    ...(filter ? { filter } : {}),
    ...(payload.length !== undefined ? { fixedLength: payload.length } : {}),
    ...(payload.lives !== undefined ? { lives: payload.lives } : {}),
    choices: payload.choices,
    seed: payload.seed,
  };
}

/** Which leg of a duel a code represents: `c` an incoming challenge, `r` a returned result. */
export type DuelLeg = 'c' | 'r';

/**
 * Absolute, shareable URL for a duel code. Built from the current app URL (origin + path, so it
 * respects any static-host base path such as `/Orbi/`) with a fresh `#/duel?<leg>=<code>` hash.
 */
export function duelLink(code: string, leg: DuelLeg = 'c'): string {
  const base = typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '';
  return `${base}#/duel?${leg}=${code}`;
}

/** Read a duel code + which leg it is from a router querystring, or `null` if neither is present. */
export function readDuelQuery(
  querystring: string | undefined,
): { leg: DuelLeg; code: string } | null {
  const params = new URLSearchParams(querystring ?? '');
  const c = params.get('c');
  if (c) return { leg: 'c', code: c };
  const r = params.get('r');
  if (r) return { leg: 'r', code: r };
  return null;
}

/** Outcome of {@link shareDuel}: native share, clipboard fallback, user-cancelled, or failed. */
export type DuelShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Copy `text` to the clipboard, with a legacy `execCommand` fallback. Resolves to success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Clipboard API refused (permissions / insecure context) — fall through to the legacy path.
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Share a duel via the native share sheet where available, else copy the link to the clipboard.
 * A user-dismissed share sheet returns `'cancelled'` (a no-op, not a failure) so the UI stays quiet.
 */
export async function shareDuel(
  url: string,
  opts: { title: string; text: string },
): Promise<DuelShareOutcome> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: opts.title, text: opts.text, url });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Any other share error (e.g. not-allowed) falls back to copying the link.
    }
  }
  return (await copyToClipboard(`${opts.text}\n${url}`)) ? 'copied' : 'failed';
}

// ---- In-app PNG scorecard (Phase 46, OQ4) --------------------------------------------------
//
// A personalised picture the player shares via the OS share sheet as an image *file* — distinct from
// the static OG card (which is what a pasted *link* unfurls to). Canvas-rendered, no dependency. All
// text is pre-localised by the caller so this stays i18n-agnostic.

/** Pre-localised text drawn on the shared duel scorecard. */
export interface DuelCardText {
  /** Brand wordmark, e.g. "Orbi". */
  brand: string;
  /** Card subtitle, e.g. "Duel a friend". */
  caption: string;
  /** Challenger display name (or a generic label when anonymous). */
  name: string;
  /** The headline score, e.g. "8/10" or "1,234". */
  scoreValue: string;
  /** A small unit beneath the score, e.g. "pts" (may be empty). */
  scoreUnit: string;
  /** Scope line, e.g. "Flags · Europe". */
  scope: string;
  /** Call to action footer, e.g. "Can you beat it?". */
  cta: string;
}

/** Draw the duel scorecard to a PNG blob (1080×1080), or `null` if canvas is unavailable. */
export async function renderDuelCard(text: DuelCardText): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const font = (weight: number, px: number) =>
    `${weight} ${px}px 'Segoe UI', 'DejaVu Sans', Arial, sans-serif`;

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#12b1ab');
  bg.addColorStop(1, '#0c807c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';

  // Shrink a line's font until it fits within `maxW`.
  const fitText = (str: string, weight: number, px: number, maxW: number): number => {
    let size = px;
    ctx.font = font(weight, size);
    while (ctx.measureText(str).width > maxW && size > 24) {
      size -= 4;
      ctx.font = font(weight, size);
    }
    return size;
  };

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = font(700, 52);
  ctx.fillText(text.brand.toUpperCase(), W / 2, 150);

  ctx.fillStyle = '#e6faf8';
  ctx.font = font(600, 44);
  ctx.fillText(text.caption, W / 2, 220);

  ctx.fillStyle = '#ffffff';
  fitText(text.name, 700, 76, W - 160);
  ctx.fillText(text.name, W / 2, 400);

  ctx.fillStyle = '#ffffff';
  fitText(text.scoreValue, 800, 240, W - 200);
  ctx.fillText(text.scoreValue, W / 2, 660);

  if (text.scoreUnit) {
    ctx.fillStyle = '#cdefec';
    ctx.font = font(600, 54);
    ctx.fillText(text.scoreUnit, W / 2, 740);
  }

  ctx.fillStyle = '#e6faf8';
  fitText(text.scope, 500, 44, W - 160);
  ctx.fillText(text.scope, W / 2, 850);

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = font(700, 50);
  ctx.fillText(text.cta, W / 2, 970);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/** Download a blob as `filename` (fallback when file-sharing isn't available). */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Share the duel scorecard as a PNG file via the native share sheet (with the link in the caption so
 * it stays actionable). Falls back to downloading the image + copying the link where file-sharing
 * isn't supported. Returns `'failed'` if the image couldn't be rendered at all.
 */
export async function shareDuelImage(
  text: DuelCardText,
  opts: { title: string; text: string; url: string },
): Promise<DuelShareOutcome> {
  const blob = await renderDuelCard(text);
  if (!blob) return 'failed';
  const file = new File([blob], 'orbi-duel.png', { type: 'image/png' });
  const caption = `${opts.text}\n${opts.url}`;
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    navigator.canShare?.({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: opts.title, text: caption });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Any other share error falls through to the download + link-copy path.
    }
  }
  triggerDownload(blob, 'orbi-duel.png');
  await copyToClipboard(opts.url);
  return 'copied';
}

/** Re-export the score shape for consumers that display a head-to-head. */
export type { DuelScore };
