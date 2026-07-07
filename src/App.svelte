<script lang="ts">
  import { onMount } from 'svelte';
  import Router from 'svelte-spa-router';
  import routes from './ui/routes';
  import Nav from './ui/components/Nav.svelte';
  import { t } from './i18n';
  import { initPersistence, persistent, storageReady } from './ui/stores/persistence';

  onMount(() => {
    void initPersistence();
  });

  // Keep the browser tab title localized; re-runs whenever the locale changes.
  $effect(() => {
    document.title = $t('app.title');
  });
</script>

<div class="app-shell">
  <Nav />
  {#if $storageReady && !$persistent}
    <p class="storage-warning" role="alert">{$t('storage.unavailable')}</p>
  {/if}
  <main class="content">
    <Router {routes} />
  </main>
</div>

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  .storage-warning {
    margin: 0;
    padding: 0.6rem 1rem;
    text-align: center;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-wrong);
    background: var(--color-wrong-bg);
    border-bottom: 1px solid var(--color-wrong);
  }

  .content {
    flex: 1;
    width: 100%;
    max-width: var(--max-width);
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
  }
</style>
