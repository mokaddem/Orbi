<script lang="ts">
  // Friend-invite share sheet (Phase 53). The signed-in account opens this to share their invite: a
  // link + a scan-to-add QR, with Copy / Share actions. A friend opening the link (or scanning) lands
  // on `#/friend-invite?c=…` and is connected instantly (OQ3). Presentational: the caller builds the
  // `url` and owns `open`. Modeled on DuelQrModal's idiom (Escape / backdrop / × dismiss); the QR is
  // encoded at level H (see qr.ts).
  import { t } from '../../i18n';
  import { duelQrModules } from '../qr';
  import { copyFriendInvite, shareFriendInvite } from '../friend-invite';

  let { open, url, onClose }: { open: boolean; url: string; onClose: () => void } = $props();

  const QR = 240;
  const modules = $derived(open && url ? duelQrModules(url) : null);
  const qrPath = $derived.by(() => {
    const m = modules;
    if (!m) return '';
    const n = m.length;
    const step = QR / n;
    const s = +step.toFixed(3);
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (m[r][c]) d += `M${+(c * step).toFixed(3)} ${+(r * step).toFixed(3)}h${s}v${s}h-${s}z`;
      }
    }
    return d;
  });

  let copied = $state(false);
  async function onCopy(): Promise<void> {
    const ok = await copyFriendInvite(url);
    if (ok) {
      copied = true;
      setTimeout(() => (copied = false), 1600);
    }
  }
  async function onShare(): Promise<void> {
    await shareFriendInvite(url, {
      title: $t('friends.invite.shareTitle'),
      text: $t('friends.invite.shareText'),
    });
  }

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
    <div class="sheet" role="dialog" aria-modal="true" aria-label={$t('friends.invite.shareTitle')}>
      <button
        bind:this={closeEl}
        type="button"
        class="close"
        aria-label={$t('friends.close')}
        onclick={onClose}
      >
        ×
      </button>

      <h2>{$t('friends.invite.shareTitle')}</h2>
      <p class="sub">{$t('friends.invite.shareSub')}</p>

      <div class="qr-wrap">
        <svg viewBox="0 0 {QR} {QR}" width={QR} height={QR} aria-hidden="true">
          <rect width={QR} height={QR} fill="#ffffff" />
          <path d={qrPath} fill="#141414" shape-rendering="crispEdges" />
        </svg>
      </div>

      <p class="link" title={url}>{url}</p>

      <div class="actions">
        <button type="button" class="btn ghost" onclick={onCopy}>
          {copied ? $t('friends.invite.copied') : $t('friends.invite.copy')}
        </button>
        <button type="button" class="btn primary" onclick={onShare}
          >{$t('friends.invite.share')}</button
        >
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgb(18 26 25 / 55%);
    animation: fade 0.14s ease;
  }

  .sheet {
    position: relative;
    width: 100%;
    max-width: 22rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.6rem;
    padding: 1.6rem 1.3rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
    animation: pop 0.14s ease;
  }

  h2 {
    margin: 0;
    font-size: 1.15rem;
  }

  .sub {
    margin: 0;
    font-size: 0.88rem;
    color: var(--color-muted);
  }

  .qr-wrap {
    padding: 0.6rem;
    background: #ffffff;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    line-height: 0;
  }

  .qr-wrap svg {
    display: block;
    width: 200px;
    height: 200px;
  }

  .link {
    width: 100%;
    margin: 0;
    padding: 0.5rem 0.6rem;
    font-size: 0.78rem;
    color: var(--color-muted);
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    gap: 0.6rem;
    width: 100%;
  }

  .btn {
    flex: 1 1 0;
    padding: 0.6rem 1rem;
    border-radius: var(--radius);
    font-weight: 800;
    font-size: 0.92rem;
    border: 2px solid transparent;
    cursor: pointer;
  }

  .primary {
    color: var(--color-accent-contrast);
    background: var(--color-accent);
    box-shadow: var(--shadow-chunky);
  }

  .primary:active {
    transform: translateY(2px);
    box-shadow: var(--shadow-chunky-press);
  }

  .ghost {
    color: var(--color-text);
    background: transparent;
    border-color: var(--color-border);
  }

  .ghost:hover {
    border-color: var(--color-accent);
  }

  .close {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: none;
    background: var(--color-bg);
    color: var(--color-text);
    font-size: 1.5rem;
    line-height: 1;
    cursor: pointer;
  }

  .close:hover {
    background: var(--color-border);
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
    .sheet {
      animation: none;
    }
  }
</style>
