// Grandmaster invite UI glue (Phase 46b) — the framework-light bridge between the pure invite codec
// (`domain/grandmaster-invite.ts`) and the routes/components. Builds the shareable payload, mints the
// `#/challenge-invite` link, renders the arena/ember scorecard-style invite image (with an embedded
// scan-to-play QR), and shares/copies it. Mirrors `duel.ts` and reuses its generic share plumbing so
// the two features stay consistent; anything DOM / `navigator` / canvas lives here, not in the domain.

import {
  GM_INVITE_PROTOCOL_VERSION,
  encodeGmInvite,
  type GrandmasterInvitePayload,
  type MasteryFamily,
} from '../domain';
import { duelQrModules } from './qr';
// Generic share/clipboard helpers + the shared card font — reused verbatim from the duel glue so the
// invite shares exactly like a duel (native sheet on mobile, link/clipboard on desktop).
import { CARD_FONT_STACK, canShareFiles, copyToClipboard, shareDuel } from './duel';
import type { DuelShareOutcome } from './duel';

/** Build the shareable {@link GrandmasterInvitePayload} for a certified `family × region`. */
export function buildInvitePayload(
  family: MasteryFamily,
  region: string,
  challengerName: string,
): GrandmasterInvitePayload {
  return { protocolVersion: GM_INVITE_PROTOCOL_VERSION, family, region, challengerName };
}

/**
 * Absolute, shareable URL for an invite code. Built from the current app URL (origin + path, so it
 * respects any static-host base path such as `/Orbi/`) with a fresh `#/challenge-invite?c=<code>` hash.
 */
export function challengeInviteLink(code: string): string {
  const base = typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : '';
  return `${base}#/challenge-invite?c=${code}`;
}

/** Read an invite code from a router querystring, or `null` if absent (there is no return leg). */
export function readChallengeInviteQuery(querystring: string | undefined): { code: string } | null {
  const code = new URLSearchParams(querystring ?? '').get('c');
  return code ? { code } : null;
}

/** One-tap link mint for a certified capstone (used where a full image share isn't wanted). */
export function inviteLinkFor(
  family: MasteryFamily,
  region: string,
  challengerName: string,
): string {
  return challengeInviteLink(encodeGmInvite(buildInvitePayload(family, region, challengerName)));
}

// ---- In-app PNG invite card (Phase 46b) ----------------------------------------------------
//
// The arena/ember "become a grandmaster too" card (direction C): the dark-teal gauntlet ground, the
// ember Challenger Orbi (the invite-mood mascot), and an embedded scan-to-play QR so the single image
// both reads as a branded dare *and* opens the receiver's arena when scanned. Canvas-rendered, no
// dependency; all text is pre-localised by the caller so this stays i18n-agnostic.

/** Pre-localised text drawn on the shared invite card. */
export interface InviteCardText {
  /** The dare line, e.g. "Sami challenges you" — drawn uppercase in the ember eyebrow. */
  eyebrow: string;
  /** Scope title, e.g. "Flags · Africa". */
  title: string;
  /** A short second line, e.g. "Carry the fire into the gauntlet." */
  subhead: string;
  /** QR call-to-action under the code, e.g. "Scan to accept". */
  hint: string;
  /** Brand wordmark footer, e.g. "Orbi". */
  brand: string;
}

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

/**
 * Draw the ember Challenger Orbi (the invite mascot) centred at (cx, cy), scaled from its native
 * 0..64 art space. A faithful canvas port of `ChallengerOrbi.svelte`: the mid-teal globe with its
 * graticule + land silhouettes, the determined game-face, and the ember→gold flame carried where the
 * crown will go. Kept in sync with that component (the shared house style).
 */
function drawChallengerOrbi(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  s: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.translate(-32, -34); // the art's rough visual centre

  // Globe body.
  ctx.beginPath();
  ctx.arc(32, 43.5, 17.5, 0, Math.PI * 2);
  ctx.fillStyle = '#17564e';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#58d6c9';
  ctx.stroke();

  // Clipped interior: sheen, graticules, land silhouettes.
  ctx.save();
  ctx.beginPath();
  ctx.arc(32, 43.5, 17.5, 0, Math.PI * 2);
  ctx.clip();

  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(26, 37, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = '#58d6c9';
  ctx.lineWidth = 1.1;
  ctx.globalAlpha = 0.24;
  ctx.beginPath();
  ctx.moveTo(15, 43.5);
  ctx.quadraticCurveTo(32, 50.5, 49, 43.5);
  ctx.stroke();
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.moveTo(32, 26);
  ctx.quadraticCurveTo(43, 43.5, 32, 61);
  ctx.moveTo(32, 26);
  ctx.quadraticCurveTo(21, 43.5, 32, 61);
  ctx.stroke();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#8ff0e6';
  ctx.beginPath();
  ctx.moveTo(19.5, 51);
  ctx.bezierCurveTo(15.5, 52, 15.5, 57, 20, 57);
  ctx.bezierCurveTo(24.5, 57, 24.5, 51.5, 21.5, 51);
  ctx.closePath();
  ctx.moveTo(42.5, 50.5);
  ctx.bezierCurveTo(39, 50, 37, 54, 40, 57);
  ctx.bezierCurveTo(43, 59, 46, 55.5, 45, 52.5);
  ctx.bezierCurveTo(44.4, 50.8, 43.4, 50.5, 42.5, 50.5);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Game-face: determined brows, focused eyes + highlights, a confident grin, blush.
  ctx.strokeStyle = '#eafbf8';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(23.8, 40.2);
  ctx.lineTo(28.6, 41.8);
  ctx.moveTo(40.2, 40.2);
  ctx.lineTo(35.4, 41.8);
  ctx.stroke();

  ctx.fillStyle = '#eafbf8';
  for (const ex of [26.7, 37.3]) {
    ctx.beginPath();
    ctx.arc(ex, 44.6, 2.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  for (const ex of [27.5, 38.1]) {
    ctx.beginPath();
    ctx.arc(ex, 43.8, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = '#eafbf8';
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  ctx.moveTo(27.5, 50);
  ctx.quadraticCurveTo(32, 52.4, 36.5, 50);
  ctx.stroke();

  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#f2a891';
  for (const cxx of [22.6, 41.4]) {
    ctx.beginPath();
    ctx.arc(cxx, 48.5, 1.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Drifting sparks.
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#ffcf6b';
  ctx.beginPath();
  ctx.arc(40, 16, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#f5a23c';
  ctx.beginPath();
  ctx.arc(24.5, 19, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Ember flame in the crown's spot: ember→gold outer flame + bright inner core.
  const flame = ctx.createLinearGradient(32, 24.8, 33, 6.5);
  flame.addColorStop(0, '#e0803f');
  flame.addColorStop(0.55, '#f5b23c');
  flame.addColorStop(1, '#ffe08a');
  ctx.beginPath();
  ctx.moveTo(32, 6.5);
  ctx.bezierCurveTo(27, 13.5, 26, 17.7, 27.8, 21.6);
  ctx.bezierCurveTo(28.8, 23.6, 30.3, 24.8, 32, 24.8);
  ctx.bezierCurveTo(33.7, 24.8, 35.2, 23.6, 36.2, 21.6);
  ctx.bezierCurveTo(38, 17.7, 37, 13.5, 32, 6.5);
  ctx.closePath();
  ctx.fillStyle = flame;
  ctx.fill();
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = '#c9611f';
  ctx.stroke();

  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.moveTo(32, 12.3);
  ctx.bezierCurveTo(29.5, 16, 29, 18.7, 30.3, 21);
  ctx.bezierCurveTo(30.8, 22, 31.4, 22.5, 32, 22.5);
  ctx.bezierCurveTo(32.6, 22.5, 33.2, 22, 33.7, 21);
  ctx.bezierCurveTo(35, 18.7, 34.5, 16, 32, 12.3);
  ctx.closePath();
  ctx.fillStyle = '#fff2c8';
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();
}

/** Draw the embedded QR for `url` inside a white panel, with a small centre Orbi badge. */
function drawInviteQr(ctx: CanvasRenderingContext2D, url: string, cx: number, cy: number): void {
  const PANEL = 320;
  const px = cx - PANEL / 2;
  const py = cy - PANEL / 2;
  roundRectPath(ctx, px, py, PANEL, PANEL, 28);
  ctx.fillStyle = '#fdfffe';
  ctx.fill();

  const modules = duelQrModules(url);
  const n = modules.length;
  const pad = 26;
  const area = PANEL - pad * 2;
  const step = area / n;
  ctx.fillStyle = '#221d1a';
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (modules[r][c])
        ctx.fillRect(px + pad + c * step, py + pad + r * step, step + 0.5, step + 0.5);
    }
  }

  // Centre quiet-zone badge + a tiny happy Orbi (level H tolerates the ~18% cover).
  const badge = 62;
  roundRectPath(ctx, cx - badge / 2, cy - badge / 2, badge, badge, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.fillStyle = '#10a5a0';
  ctx.fill();
  ctx.fillStyle = '#0c2a28';
  for (const dx of [-7, 7]) {
    ctx.beginPath();
    ctx.arc(cx + dx, cy - 2, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#0c2a28';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy + 6);
  ctx.quadraticCurveTo(cx, cy + 11, cx + 7, cy + 6);
  ctx.stroke();
}

/**
 * Render the invite card (direction C — arena/ember) to a PNG blob (1080×1080), or `null` if canvas
 * is unavailable. The `url` is embedded as a scan-to-play QR, so the single image is both the branded
 * dare and the way in.
 */
export async function renderInviteCard(text: InviteCardText, url: string): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const W = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = W;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const font = (weight: number, px: number) => `${weight} ${px}px ${CARD_FONT_STACK}`;
  const fitFont = (str: string, weight: number, px: number, maxW: number): number => {
    let size = px;
    ctx.font = font(weight, size);
    while (size > 18 && ctx.measureText(str).width > maxW) {
      size -= 4;
      ctx.font = font(weight, size);
    }
    return size;
  };

  // Dark arena ground (matches --g-bg / --g-bg2).
  const bg = ctx.createLinearGradient(0, 0, W, W);
  bg.addColorStop(0, '#123b35');
  bg.addColorStop(0.55, '#18463f');
  bg.addColorStop(1, '#0f342f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, W);

  // Ember glow behind the mascot.
  const glow = ctx.createRadialGradient(540, 320, 0, 540, 320, 460);
  glow.addColorStop(0, 'rgba(224,128,63,0.26)');
  glow.addColorStop(1, 'rgba(224,128,63,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, W);

  // Gold hairline frame.
  roundRectPath(ctx, 30, 30, W - 60, W - 60, 40);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(230,197,121,0.34)';
  ctx.stroke();

  ctx.textAlign = 'center';

  // Ember eyebrow (uppercase, tracked).
  ctx.fillStyle = '#f0a35c';
  ctx.letterSpacing = '8px';
  fitFont(text.eyebrow.toUpperCase(), 700, 34, 800);
  ctx.fillText(text.eyebrow.toUpperCase(), W / 2, 150);
  ctx.letterSpacing = '0px';

  // Challenger Orbi hero.
  drawChallengerOrbi(ctx, 540, 300, 5.0);

  // Title + subhead.
  ctx.fillStyle = '#f4faf7';
  fitFont(text.title, 800, 74, 860);
  ctx.fillText(text.title, W / 2, 500);

  ctx.fillStyle = '#a6c9c1';
  fitFont(text.subhead, 600, 32, 820);
  ctx.fillText(text.subhead, W / 2, 552);

  // Embedded scan-to-play QR.
  drawInviteQr(ctx, url, 540, 748);

  // Hint + brand footer.
  ctx.fillStyle = '#f0a35c';
  ctx.font = font(700, 32);
  ctx.fillText(text.hint, W / 2, 960);
  ctx.fillStyle = '#79978f';
  ctx.letterSpacing = '4px';
  ctx.font = font(700, 26);
  ctx.fillText(text.brand.toUpperCase(), W / 2, 1004);
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
 * Share the invite card as a PNG file via the native share sheet (with the link in the caption so it
 * stays actionable). Falls back to downloading the image + copying the link where file-sharing isn't
 * supported. Returns `'failed'` if the image couldn't be rendered at all.
 */
export async function shareInviteImage(
  text: InviteCardText,
  opts: { title: string; text: string; url: string },
): Promise<DuelShareOutcome> {
  const blob = await renderInviteCard(text, opts.url);
  if (!blob) return 'failed';
  const file = new File([blob], 'orbi-grandmaster-invite.png', { type: 'image/png' });
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
  triggerDownload(blob, 'orbi-grandmaster-invite.png');
  await copyToClipboard(opts.url);
  return 'copied';
}

/**
 * The one-tap "Challenge a friend" action for a Grandmaster capstone: share the personalised invite
 * image with the link in the caption where file-sharing is supported (mostly mobile), else share/copy
 * the link (mostly desktop — it unfurls to the branded OG card and stays tappable).
 */
export async function shareInviteSmart(
  card: InviteCardText,
  opts: { title: string; text: string; url: string },
): Promise<DuelShareOutcome> {
  if (canShareFiles()) return shareInviteImage(card, opts);
  return shareDuel(opts.url, { title: opts.title, text: opts.text });
}
