<script lang="ts">
  import { onMount } from 'svelte';
  import Router from 'svelte-spa-router';
  import routes from './ui/routes';
  import Nav from './ui/components/Nav.svelte';
  import Icon from './ui/components/Icon.svelte';
  import Mascot from './ui/components/Mascot.svelte';
  import LanguageSwitcher from './ui/components/LanguageSwitcher.svelte';
  import { t } from './i18n';
  import { initPersistence, persistent, prefs, storageReady } from './ui/stores/persistence';
  import { sound } from './ui/sound';

  onMount(() => {
    void initPersistence();

    // Autoplay-safe unlock (Phase 36): browsers block audio until a user gesture, so create /
    // resume the audio backend on the first interaction — then cues are free. Runs once; cues
    // that (unlikely) fire before this are silently dropped by the service, never queued.
    const unlock = (): void => {
      sound.unlock();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  });

  // Mirror the sound master toggle onto the service so muting is instant and global.
  $effect(() => {
    sound.setEnabled($prefs.sound);
  });

  // Keep the browser tab title localized; re-runs whenever the locale changes.
  $effect(() => {
    document.title = $t('app.title');
  });

  // In-app "reduce animation" toggle (Phase 33): mirror the pref onto the root element so a
  // single global CSS rule (see app.css) can neutralise every animation/transition app-wide,
  // in addition to the OS `prefers-reduced-motion` each component already honours.
  $effect(() => {
    document.documentElement.toggleAttribute('data-reduce-motion', $prefs.reduceMotion);
  });
</script>

<div class="app-shell">
  <!-- Slim top app-bar — mobile only (the desktop rail carries the brand/language/settings). -->
  <header class="appbar">
    <a class="appbar-brand" href="#/">
      <Mascot pose="wave" size={30} />
      <span>{$t('app.title')}</span>
    </a>
    <div class="appbar-actions">
      <LanguageSwitcher />
      <a class="appbar-settings" href="#/settings" aria-label={$t('nav.settings')}>
        <Icon name="settings" size={20} />
      </a>
    </div>
  </header>

  <Nav />

  <main class="content">
    <div class="content-inner">
      {#if $storageReady && !$persistent}
        <p class="storage-warning" role="alert">{$t('storage.unavailable')}</p>
      {/if}
      <Router {routes} />
    </div>
  </main>
</div>

<style>
  .app-shell {
    min-height: 100vh;
  }

  /* ---- Mobile top app-bar ------------------------------------------------------------- */
  .appbar {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: calc(0.55rem + env(safe-area-inset-top, 0px)) 1rem 0.55rem;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
  }

  .appbar-brand {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-weight: 800;
    font-size: 1.2rem;
    color: var(--color-accent);
  }

  .appbar-brand:hover {
    text-decoration: none;
  }

  .appbar-actions {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .appbar-settings {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 12px;
    color: var(--color-muted);
  }

  .appbar-settings:hover {
    text-decoration: none;
    background: var(--color-accent-weak);
    color: var(--color-accent-strong);
  }

  /* ---- Content ------------------------------------------------------------------------ */
  .content {
    /* Clear the fixed bottom tab bar on mobile. */
    padding: 1.25rem 1rem calc(var(--bottombar-h) + env(safe-area-inset-bottom, 0px) + 1.5rem);
  }

  .content-inner {
    width: 100%;
    max-width: var(--content-max);
    margin: 0 auto;
  }

  .storage-warning {
    margin: 0 0 1rem;
    padding: 0.6rem 1rem;
    text-align: center;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-wrong);
    background: var(--color-wrong-bg);
    border: 1px solid var(--color-wrong);
    border-radius: var(--radius);
  }

  @media (min-width: 860px) {
    .appbar {
      display: none;
    }

    .content {
      margin-left: var(--rail-width);
      padding: 2rem 2.5rem 3.5rem;
    }
  }
</style>
