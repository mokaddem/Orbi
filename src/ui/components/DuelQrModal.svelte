<script lang="ts">
  // Offline "Show QR" surface (Phase 46). A challenger opens this full-screen; a friend in the room
  // scans it with their camera and the QR opens `…#/duel?c=…`, which the cached PWA rebuilds locally —
  // no chat app, no network. Presentational: the caller builds the challenge `url` + card copy and
  // owns `open`. Modeled on DuelNamePrompt's modal idiom (Escape / backdrop / × all dismiss).
  //
  // The card mirrors the shared scorecard's "playroom" look, with the QR as the hero and a single
  // happy Orbi on a white badge in the centre. Encoded at level H so the centre logo doesn't break
  // the scan (see qr.ts).
  import { t } from '../../i18n';
  import { CARD_FONT_STACK } from '../duel';
  import { duelQrModules } from '../qr';

  let {
    open,
    url,
    eyebrow,
    context,
    onClose,
  }: {
    open: boolean;
    /** The `…#/duel?c=…` challenge link the QR encodes. */
    url: string;
    /** e.g. "Sami challenges you!" — drawn uppercase in the coral eyebrow. */
    eyebrow: string;
    /** e.g. "Flags · Europe · Beat 18/20". */
    context: string;
    onClose: () => void;
  } = $props();

  // The QR occupies a 500×500 box centred in the 1080 card, with generous white quiet-zone around it.
  const QR_X = 290;
  const QR_Y = 344;
  const QR_SIZE = 500;

  const modules = $derived(open && url ? duelQrModules(url) : null);

  // One <path> of all dark modules (crisp, and far lighter than a rect-per-module).
  const qrPath = $derived.by(() => {
    const m = modules;
    if (!m) return '';
    const n = m.length;
    const step = QR_SIZE / n;
    const s = +step.toFixed(3);
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (m[r][c]) {
          const x = +(QR_X + c * step).toFixed(3);
          const y = +(QR_Y + r * step).toFixed(3);
          d += `M${x} ${y}h${s}v${s}h-${s}z`;
        }
      }
    }
    return d;
  });

  let closeEl = $state<HTMLButtonElement | null>(null);
  $effect(() => {
    if (open) queueMicrotask(() => closeEl?.focus());
  });

  function onKeydown(e: KeyboardEvent): void {
    if (open && e.key === 'Escape') onClose();
  }

  function onBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) onClose();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <div class="backdrop" role="presentation" onclick={onBackdropClick}>
    <div class="dialog" role="dialog" aria-modal="true" aria-label={$t('duel.qrTitle')}>
      <button
        bind:this={closeEl}
        type="button"
        class="close"
        aria-label={$t('duel.close')}
        onclick={onClose}
      >
        ×
      </button>

      <svg class="qr-card" viewBox="0 0 1080 1080" aria-hidden="true">
        <defs>
          <radialGradient id="qr-ground" cx="540" cy="345" r="780" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#f2fdfb" />
            <stop offset="1" stop-color="#e2f6f2" />
          </radialGradient>
          <clipPath id="qr-orbi-clip"><circle cx="60" cy="56" r="32" /></clipPath>
        </defs>

        <rect width="1080" height="1080" fill="url(#qr-ground)" />
        <rect x="96" y="120" width="888" height="852" rx="60" fill="#0b7e7a" />
        <rect
          x="96"
          y="108"
          width="888"
          height="852"
          rx="60"
          fill="#ffffff"
          stroke="#d3efeb"
          stroke-width="3"
        />

        <g font-family={CARD_FONT_STACK} text-anchor="middle" font-weight="700">
          <text x="540" y="228" fill="#ff7a59" font-size="32" letter-spacing="7">
            {eyebrow.toUpperCase()}
          </text>
          <text x="540" y="292" fill="#123130" font-size="34">{context}</text>
        </g>

        <path d={qrPath} fill="#2a2320" shape-rendering="crispEdges" />

        <!-- Centre logo: a white badge (quiet zone) + a single happy Orbi. -->
        <rect x="474" y="528" width="132" height="132" rx="30" fill="#ffffff" />
        <g transform="translate(540,594) scale(1.625) translate(-60,-56)">
          <circle cx="60" cy="56" r="32" fill="#dbf3f1" stroke="#2a2320" stroke-width="3" />
          <path
            clip-path="url(#qr-orbi-clip)"
            fill="#10a5a0"
            d="M44 31 C37 32 35 40 41 43 C48 46 57 43 58 37 C59 31 51 30 44 31 Z M29 52 C25 54 26 62 32 62 C38 62 40 54 36 50 C34 48 31 50 29 52 Z M84 47 C79 45 75 50 78 55 C81 61 88 58 88 52 C88 48 87 48 84 47 Z M52 76 C48 77 48 83 53 83 C58 83 59 77 55 76 Z"
          />
          <circle cx="44" cy="61" r="3" fill="#f2a891" />
          <circle cx="76" cy="61" r="3" fill="#f2a891" />
          <circle cx="51" cy="54" r="3" fill="#2a2320" />
          <circle cx="69" cy="54" r="3" fill="#2a2320" />
          <circle cx="52.1" cy="52.9" r="0.9" fill="#ffffff" />
          <circle cx="70.1" cy="52.9" r="0.9" fill="#ffffff" />
          <path
            d="M52 63 Q60 70 68 63"
            fill="none"
            stroke="#2a2320"
            stroke-width="2.4"
            stroke-linecap="round"
          />
        </g>

        <g font-family={CARD_FONT_STACK} text-anchor="middle" font-weight="700">
          <text x="540" y="906" fill="#0b7e7a" font-size="32">{$t('duel.qrHint')}</text>
          <text x="540" y="950" fill="#6e8a88" font-size="26" letter-spacing="2"
            >{$t('app.title')}</text
          >
        </g>
      </svg>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgb(18 26 25 / 62%);
    animation: fade 0.14s ease;
  }

  .dialog {
    position: relative;
    width: 100%;
    max-width: min(94vw, 30rem);
    animation: pop 0.14s ease;
  }

  .qr-card {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 28px;
    box-shadow: 0 18px 48px rgb(11 40 42 / 45%);
  }

  .close {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: none;
    background: rgb(255 255 255 / 88%);
    color: #123130;
    font-size: 1.6rem;
    line-height: 1;
    cursor: pointer;
    box-shadow: 0 2px 8px rgb(11 40 42 / 22%);
  }

  .close:hover {
    background: #ffffff;
  }

  .close:focus-visible {
    outline: 3px solid #ff7a59;
    outline-offset: 2px;
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: scale(0.97);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .backdrop,
    .dialog {
      animation: none;
    }
  }
</style>
