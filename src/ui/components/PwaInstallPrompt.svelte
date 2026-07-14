<script lang="ts">
  // "Add Orbi to your home screen" hint — mobile only.
  //
  // Orbi is an installable, offline PWA, but the install affordance is buried in the browser
  // chrome and differs per platform, so most phone visitors never find it. This bottom-sheet
  // surfaces device-specific steps (iOS Safari's Share sheet vs. Android's ⋮ menu) and, where
  // the browser supports it (Chromium/Android), a genuine one-tap Install button.
  //
  // Visibility: shown once per page load on a real mobile OS that isn't already running the
  // installed app; hidden entirely on desktop and when launched from the home screen. It does
  // NOT persist a "seen" flag — per the spec it reappears on each reload, but only once per
  // load (a single mount, and the SPA never remounts on in-app navigation).
  import { onMount } from 'svelte';
  import { t } from '../../i18n';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';
  import {
    appInstalled,
    detectMobilePlatform,
    installPromptEvent,
    isStandalone,
    shouldShowInstallHint,
    type MobilePlatform,
  } from '../pwa-install';

  // Resolved once on mount — a device doesn't change OS mid-session. 'other' keeps us hidden.
  let platform = $state<MobilePlatform>('other');
  let open = $state(false);
  let sheetEl = $state<HTMLElement | null>(null);

  // A glyph mirroring the real control the user taps at each step, so they can recognise it:
  // [locate the menu/share, the "add" row, done].
  const STEP_ICONS: Record<'ios' | 'android', [IconName, IconName, IconName]> = {
    ios: ['share', 'add-home', 'check'],
    android: ['menu-dots', 'add-home', 'check'],
  };

  const steps = $derived(
    platform === 'ios' || platform === 'android'
      ? ([1, 2, 3] as const).map((n, i) => ({
          icon: STEP_ICONS[platform as 'ios' | 'android'][i],
          text: $t(`pwa.${platform}.step${n}`),
        }))
      : [],
  );

  onMount(() => {
    if (typeof navigator === 'undefined') return;
    const p = detectMobilePlatform(
      navigator.userAgent ?? '',
      navigator.platform ?? '',
      navigator.maxTouchPoints ?? 0,
    );
    platform = p;
    if (shouldShowInstallHint(p, isStandalone(window, navigator))) open = true;
  });

  // If the app gets installed while the sheet is open (e.g. via the native prompt), dismiss it.
  $effect(() => {
    if ($appInstalled) open = false;
  });

  // Land focus inside the sheet when it opens (accessible modal behaviour).
  $effect(() => {
    if (open) sheetEl?.focus();
  });

  function close(): void {
    open = false;
  }

  function onKeydown(e: KeyboardEvent): void {
    if (open && e.key === 'Escape') close();
  }

  /** Dismiss only when the click lands on the backdrop itself, not the sheet. */
  function onBackdropClick(e: MouseEvent): void {
    if (e.target === e.currentTarget) close();
  }

  // One-tap install where the browser offers it (Chromium/Android). The deferred event is
  // single-use, so drop it afterwards regardless of the user's choice.
  async function install(): Promise<void> {
    const evt = $installPromptEvent;
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice;
    installPromptEvent.set(null);
    close();
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
  <div class="backdrop" role="presentation" onclick={onBackdropClick}>
    <div
      class="sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-title"
      aria-describedby="pwa-subtitle"
      tabindex="-1"
      bind:this={sheetEl}
    >
      <button type="button" class="close" onclick={close} aria-label={$t('pwa.close')}>
        <Icon name="close" size={22} />
      </button>

      <div class="head">
        <span class="badge"><Icon name="smartphone" size={26} /></span>
        <div>
          <h2 id="pwa-title">{$t('pwa.title')}</h2>
          <p id="pwa-subtitle">{$t('pwa.subtitle')}</p>
        </div>
      </div>

      <p class="lead">{$t(`pwa.${platform}.lead`)}</p>
      <ol class="steps">
        {#each steps as step, i (i)}
          <li>
            <span class="num">{i + 1}</span>
            <span class="step-icon"><Icon name={step.icon} size={20} /></span>
            <span class="step-text">{step.text}</span>
          </li>
        {/each}
      </ol>

      <div class="actions">
        {#if $installPromptEvent}
          <button type="button" class="btn install" onclick={install}>
            <Icon name="install" size={20} />
            {$t('pwa.install')}
          </button>
          <p class="install-hint">{$t('pwa.installHint')}</p>
        {/if}
        <button type="button" class="btn dismiss" onclick={close}>{$t('pwa.dismiss')}</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 60; /* above ConfirmDialog (50) and the tab bar */
    display: flex;
    align-items: flex-end; /* dock the sheet to the bottom, like a native install prompt */
    justify-content: center;
    background: rgb(18 49 48 / 45%);
    animation: fade 0.15s ease;
  }

  .sheet {
    position: relative;
    width: 100%;
    max-width: 30rem;
    max-height: 88dvh;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 1.25rem 1.25rem calc(1.25rem + env(safe-area-inset-bottom, 0px));
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 22px 22px 0 0;
    box-shadow: 0 -10px 30px -12px rgb(18 49 48 / 35%);
    animation: slide-up 0.2s ease;
  }

  .close {
    position: absolute;
    top: 0.6rem;
    right: 0.6rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border: none;
    border-radius: 12px;
    background: transparent;
    color: var(--color-muted);
  }

  .close:hover {
    background: var(--color-accent-weak);
    color: var(--color-accent-strong);
  }

  .head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding-right: 2.5rem; /* clear the close button */
  }

  .badge {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    border-radius: 14px;
    background: var(--color-accent-weak);
    color: var(--color-accent-strong);
  }

  .head h2 {
    margin: 0;
    font-size: 1.15rem;
  }

  .head p {
    margin: 0.15rem 0 0;
    font-size: 0.9rem;
    color: var(--color-muted);
  }

  .lead {
    margin: 0.15rem 0 0;
    font-weight: 600;
  }

  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .steps li {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .num {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    font-size: 0.85rem;
    font-weight: 800;
  }

  .step-icon {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    color: var(--color-accent-strong);
  }

  .step-text {
    flex: 1 1 auto;
    font-size: 0.95rem;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-top: 0.35rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.7rem 1rem;
    border-radius: var(--radius);
    border: 1px solid transparent;
    font-weight: 700;
  }

  .install {
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    box-shadow: var(--shadow-chunky);
  }

  .install:hover {
    filter: brightness(1.04);
  }

  .install:active {
    transform: translateY(2px);
    box-shadow: var(--shadow-chunky-press);
  }

  .install-hint {
    margin: 0 0 0.25rem;
    text-align: center;
    font-size: 0.8rem;
    color: var(--color-muted);
  }

  .dismiss {
    background: transparent;
    color: var(--color-muted);
    font-weight: 600;
  }

  .dismiss:hover {
    color: var(--color-text);
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }

  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .backdrop,
    .sheet {
      animation: none;
    }
  }
</style>
