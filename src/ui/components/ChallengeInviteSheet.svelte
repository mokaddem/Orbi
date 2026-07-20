<script lang="ts">
  // Grandmaster invite share sheet (Phase 46b) — a slide-from-bottom panel that mirrors the duel
  // Summary's "Challenge a friend" card, but for the "become a Grandmaster too" invite. It renders the
  // arena/ember card **inline** (so the image is visible on desktop, where the OS share sheet can't
  // show a file) and offers the same actions: Share, Copy image, Copy link, Show QR. Opened from the
  // in-arena victory bloom and from each certified Progress capstone; the caller resolves the player
  // name (one-time prompt) before opening, and owns `open`.
  import { t, localizedRegion } from '../../i18n';
  import type { MasteryFamily } from '../../domain';
  import {
    inviteLinkFor,
    renderInviteCard,
    shareInviteSmart,
    type InviteCardText,
  } from '../challenge-invite';
  import { copyImageToClipboard, copyToClipboard } from '../duel';
  import Icon from './Icon.svelte';
  import DuelQrModal from './DuelQrModal.svelte';

  let {
    open,
    family,
    region,
    name,
    onClose,
  }: {
    open: boolean;
    family: MasteryFamily;
    region: string;
    /** The challenger's display name (resolved by the caller; may be empty). */
    name: string;
    onClose: () => void;
  } = $props();

  const scope = $derived(`${$t(`modes.group.${family}`)} · ${$localizedRegion(region)}`);
  const url = $derived(inviteLinkFor(family, region, name));

  function cardText(): InviteCardText {
    return {
      eyebrow: name
        ? $t('challenge.friendInvite.cardEyebrow', { name })
        : $t('challenge.friendInvite.cardEyebrowAnon'),
      title: scope,
      subhead: $t('challenge.friendInvite.cardSubhead'),
      hint: $t('challenge.friendInvite.cardHint'),
      brand: $t('app.title'),
    };
  }

  // Live preview of the exact card that gets shared — confirms what's sent and is directly
  // copy/paste-able on desktop. Re-renders when the scope / name changes; null until it's ready
  // (or when canvas is unavailable, e.g. in tests).
  let previewUrl = $state<string | null>(null);
  $effect(() => {
    if (!open) return;
    const c = cardText();
    const u = url;
    let stale = false;
    void renderInviteCard(c, u).then((blob) => {
      if (stale || !blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(blob);
    });
    return () => {
      stale = true;
    };
  });

  // A transient status line ("Link copied!", …).
  let feedback = $state<string | null>(null);
  let feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  function flash(key: string): void {
    feedback = key;
    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => (feedback = null), 2400);
  }

  let qrOpen = $state(false);

  async function share(): Promise<void> {
    const outcome = await shareInviteSmart(cardText(), {
      title: $t('challenge.friendInvite.shareTitle'),
      text: $t('challenge.friendInvite.shareText', { scope }),
      url,
    });
    if (outcome === 'copied') flash('duel.linkCopied');
    else if (outcome === 'failed') flash('duel.imageFailed');
  }

  async function copyLink(): Promise<void> {
    if (await copyToClipboard(url)) flash('duel.linkCopied');
  }

  async function copyImage(): Promise<void> {
    const blob = await renderInviteCard(cardText(), url);
    flash(blob && (await copyImageToClipboard(blob)) ? 'duel.imageCopied' : 'duel.imageFailed');
  }

  let panelEl = $state<HTMLDivElement | null>(null);
  $effect(() => {
    if (open) queueMicrotask(() => panelEl?.focus());
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
  <div class="sheet-backdrop" role="presentation" onclick={onBackdropClick}>
    <div
      class="sheet"
      role="dialog"
      aria-modal="true"
      aria-label={$t('challenge.friendInvite.share')}
      tabindex="-1"
      bind:this={panelEl}
    >
      <button type="button" class="close" aria-label={$t('duel.close')} onclick={onClose}>×</button>
      <span class="grip" aria-hidden="true"></span>

      <h2 class="title">{$t('challenge.friendInvite.share')}</h2>
      <p class="scope">{scope}</p>

      {#if previewUrl}
        <img class="preview" src={previewUrl} alt={$t('challenge.friendInvite.subtitle')} />
      {/if}

      <button type="button" class="primary" onclick={share}>
        <Icon name="share" size="1.15em" />
        {$t('challenge.friendInvite.share')}
      </button>

      <div class="fallback">
        {#if previewUrl}
          <button type="button" class="linkish" onclick={copyImage}>{$t('duel.copyImage')}</button>
          <span aria-hidden="true">·</span>
        {/if}
        <button type="button" class="linkish" onclick={copyLink}>{$t('duel.copyLink')}</button>
        <span aria-hidden="true">·</span>
        <button type="button" class="linkish" onclick={() => (qrOpen = true)}>
          {$t('duel.showQr')}
        </button>
      </div>

      <p class="feedback" role="status" aria-live="polite">{feedback ? $t(feedback) : ''}</p>
    </div>
  </div>

  <DuelQrModal
    open={qrOpen}
    {url}
    eyebrow={cardText().eyebrow}
    context={scope}
    onClose={() => (qrOpen = false)}
  />
{/if}

<style>
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgb(6 20 18 / 62%);
    animation: sheet-fade 0.16s ease;
  }

  .sheet {
    width: 100%;
    max-width: 30rem;
    max-height: 92vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
    padding: 1.4rem 1.2rem calc(1.4rem + env(safe-area-inset-bottom));
    text-align: center;
    color: var(--g-ink);
    background: var(--g-entry);
    border: 1px solid var(--g-line);
    border-radius: 20px 20px 0 0;
    box-shadow: 0 -18px 48px rgb(0 0 0 / 45%);
    animation: sheet-up 0.26s cubic-bezier(0.2, 0.7, 0.2, 1) both;
  }

  .grip {
    position: absolute;
    top: 8px;
    width: 40px;
    height: 4px;
    border-radius: 999px;
    background: var(--g-line);
  }

  .close {
    position: absolute;
    top: 10px;
    right: 12px;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border: none;
    background: transparent;
    color: var(--g-dim);
    font-size: 1.6rem;
    line-height: 1;
    cursor: pointer;
  }

  .close:hover {
    color: var(--g-ink);
  }

  .title {
    margin: 0.6rem 0 0;
    font-family: var(--g-display, inherit);
    font-size: 1.3rem;
    font-weight: 700;
    background: var(--gold-metal);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .scope {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--g-teal);
  }

  .preview {
    width: 100%;
    max-width: 20rem;
    height: auto;
    margin: 0.4rem 0;
    border-radius: 16px;
    box-shadow: 0 10px 30px rgb(0 0 0 / 40%);
  }

  .primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    width: 100%;
    max-width: 20rem;
    padding: 0.8rem 1.2rem;
    border-radius: 999px;
    font-weight: 700;
    font-size: 1rem;
    color: #4a2f00;
    background: var(--g-cta);
    border: none;
    box-shadow: var(--g-cta-shadow);
  }

  .primary:hover {
    filter: brightness(1.04);
  }

  .primary:active {
    transform: translateY(2px);
    box-shadow: 0 2px 0 #9c7328;
  }

  .fallback {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 0.2rem;
    color: var(--g-faint);
  }

  .linkish {
    padding: 0.2rem 0.1rem;
    background: none;
    border: none;
    color: var(--g-teal);
    font-weight: 600;
    text-decoration: underline;
    cursor: pointer;
  }

  .linkish:hover {
    color: var(--g-ink);
  }

  .feedback {
    min-height: 1.2rem;
    margin: 0.1rem 0 0;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--g-gold);
  }

  @keyframes sheet-fade {
    from {
      opacity: 0;
    }
  }

  @keyframes sheet-up {
    from {
      transform: translateY(100%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .sheet-backdrop,
    .sheet {
      animation: none;
    }
  }
</style>
