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
  /** The challenge line, e.g. "Sami challenges you" — drawn uppercase in the coral eyebrow. */
  eyebrow: string;
  /** The headline score inside the pill, e.g. "9/12" or "1,240". */
  scoreValue: string;
  /** A small unit under the score, e.g. "pts" (empty for correct-count / distance formats). */
  scoreUnit: string;
  /** Scope chip, e.g. "Flags · Europe". */
  scope: string;
  /** Call-to-action, e.g. "Can you beat it?". */
  cta: string;
  /** Brand wordmark footer, e.g. "Orbi". */
  brand: string;
}

// The app's rounded system-font stack (see src/app.css) — rounded where the OS has SF Pro Rounded,
// friendly fallbacks elsewhere. Reused verbatim so the card matches the app and needs no webfont
// fetch (offline/PWA-safe) and no async font-load before toBlob.
const CARD_FONT_STACK =
  "ui-rounded, 'SF Pro Rounded', 'Segoe UI', system-ui, 'Trebuchet MS', -apple-system, Roboto, Helvetica, Arial, sans-serif";

/** Rounded-rect path (uses native roundRect where available, else a manual fallback). */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw the Orbi globe mascot (the favicon), fitted into a `size`×`size` box at (x, y). */
function drawOrbi(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.save();
  // The favicon art lives in viewBox "25 21 70 70"; map it into the target box.
  const s = size / 70;
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.translate(-25, -21);

  // Globe disc + ink outline.
  ctx.beginPath();
  ctx.arc(60, 56, 32, 0, Math.PI * 2);
  ctx.fillStyle = '#dbf3f1';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2a2320';
  ctx.stroke();

  // Teal "continents", clipped to the disc.
  ctx.save();
  ctx.beginPath();
  ctx.arc(60, 56, 32, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#10a5a0';
  ctx.beginPath();
  ctx.moveTo(44, 31);
  ctx.bezierCurveTo(37, 32, 35, 40, 41, 43);
  ctx.bezierCurveTo(48, 46, 57, 43, 58, 37);
  ctx.bezierCurveTo(59, 31, 51, 30, 44, 31);
  ctx.moveTo(29, 52);
  ctx.bezierCurveTo(25, 54, 26, 62, 32, 62);
  ctx.bezierCurveTo(38, 62, 40, 54, 36, 50);
  ctx.bezierCurveTo(34, 48, 31, 50, 29, 52);
  ctx.moveTo(84, 47);
  ctx.bezierCurveTo(79, 45, 75, 50, 78, 55);
  ctx.bezierCurveTo(81, 61, 88, 58, 88, 52);
  ctx.bezierCurveTo(88, 48, 87, 48, 84, 47);
  ctx.moveTo(52, 76);
  ctx.bezierCurveTo(48, 77, 48, 83, 53, 83);
  ctx.bezierCurveTo(58, 83, 59, 77, 55, 76);
  ctx.fill();
  ctx.restore();

  // Cheeks, eyes (+ highlights), smile.
  ctx.fillStyle = '#f2a891';
  for (const cx of [44, 76]) {
    ctx.beginPath();
    ctx.arc(cx, 61, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#2a2320';
  for (const cx of [51, 69]) {
    ctx.beginPath();
    ctx.arc(cx, 54, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  for (const cx of [52.1, 70.1]) {
    ctx.beginPath();
    ctx.arc(cx, 52.9, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#2a2320';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(52, 63);
  ctx.quadraticCurveTo(60, 70, 68, 63);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw the duel scorecard (Design A — "Orbi playroom") to a PNG blob (1080×1080), or `null` if canvas
 * is unavailable. Mirrors the app's chunky rounded look: a mint ground, an offset-shadow white card,
 * the Orbi mascot, a coral challenge eyebrow, the score in a teal pill, a scope chip and a CTA.
 */
export async function renderDuelCard(text: DuelCardText): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const font = (weight: number, px: number) => `${weight} ${px}px ${CARD_FONT_STACK}`;
  /** Shrink `str` until it fits `maxW`, set the font, and return the size used. */
  const fitFont = (str: string, weight: number, px: number, maxW: number): number => {
    let size = px;
    ctx.font = font(weight, size);
    while (size > 20 && ctx.measureText(str).width > maxW) {
      size -= 4;
      ctx.font = font(weight, size);
    }
    return size;
  };

  // Mint ground.
  const bg = ctx.createRadialGradient(540, 345, 0, 540, 345, 780);
  bg.addColorStop(0, '#f2fdfb');
  bg.addColorStop(1, '#e2f6f2');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Chunky offset shadow + white card.
  roundRectPath(ctx, 96, 120, 888, 852, 60);
  ctx.fillStyle = '#0b7e7a';
  ctx.fill();
  roundRectPath(ctx, 96, 108, 888, 852, 60);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#d3efeb';
  ctx.stroke();

  drawOrbi(ctx, 440, 150, 200);

  ctx.textAlign = 'center';

  // Coral challenge eyebrow (uppercase, tracked).
  ctx.fillStyle = '#ff7a59';
  ctx.letterSpacing = '8px';
  fitFont(text.eyebrow.toUpperCase(), 700, 34, 780);
  ctx.fillText(text.eyebrow.toUpperCase(), W / 2, 410);
  ctx.letterSpacing = '0px';

  // Score pill.
  roundRectPath(ctx, 300, 452, 480, 220, 48);
  ctx.fillStyle = '#10a5a0';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  if (text.scoreUnit) {
    fitFont(text.scoreValue, 700, 132, 420);
    ctx.fillText(text.scoreValue, W / 2, 596);
    ctx.fillStyle = '#d6f4f0';
    ctx.font = font(700, 42);
    ctx.fillText(text.scoreUnit, W / 2, 650);
  } else {
    fitFont(text.scoreValue, 700, 150, 420);
    ctx.fillText(text.scoreValue, W / 2, 622);
  }

  // Scope chip — width hugs the text.
  const scopeSize = fitFont(text.scope, 700, 34, 640);
  const chipW = Math.min(660, ctx.measureText(text.scope).width + 96);
  roundRectPath(ctx, W / 2 - chipW / 2, 720, chipW, 72, 36);
  ctx.fillStyle = '#d6f4f0';
  ctx.fill();
  ctx.fillStyle = '#0b7e7a';
  ctx.font = font(700, scopeSize);
  ctx.fillText(text.scope, W / 2, 768);

  // CTA + brand footer.
  ctx.fillStyle = '#123130';
  fitFont(text.cta, 700, 46, 720);
  ctx.fillText(text.cta, W / 2, 892);

  ctx.fillStyle = '#6e8a88';
  ctx.letterSpacing = '2px';
  ctx.font = font(700, 30);
  ctx.fillText(text.brand, W / 2, 944);
  ctx.letterSpacing = '0px';

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
