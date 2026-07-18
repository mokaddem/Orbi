<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from '../../i18n';
  import {
    PREFS_BOUNDS,
    PLAYER_NAME_MAX_LENGTH,
    MAP_PROJECTIONS,
    isMapProjection,
  } from '../../data';
  import {
    prefs,
    updatePrefs,
    persistent,
    storageReady,
    clearHistory,
    clearTraining,
    hasSessions,
    hasTrainingData,
  } from '../stores/persistence';
  import LanguageSwitcher from '../components/LanguageSwitcher.svelte';
  import ConfirmDialog from '../components/ConfirmDialog.svelte';
  import CountryScopeNote from '../components/CountryScopeNote.svelte';

  const B = PREFS_BOUNDS;

  // App version, injected at build time from package.json (see vite.config.ts `define`).
  const APP_VERSION = __APP_VERSION__;

  function onNumber(field: 'fixedLength' | 'survivalLives' | 'choicesPerQuestion') {
    return (e: Event & { currentTarget: HTMLInputElement }) => {
      const value = Number(e.currentTarget.value);
      if (Number.isFinite(value)) updatePrefs({ [field]: value });
    };
  }

  // Map projection (Phase 28): a curated dropdown + a small live preview. The preview
  // reuses the real MapBoard so it matches gameplay exactly; lazy-imported (as Play does)
  // so d3-geo + the geometry chunk load only when Settings is opened, not app-wide.
  function onProjection(e: Event & { currentTarget: HTMLSelectElement }): void {
    const value = e.currentTarget.value;
    if (isMapProjection(value)) updatePrefs({ mapProjection: value });
  }

  let MapBoard = $state<typeof import('../components/MapBoard.svelte').default | null>(null);
  onMount(() => {
    void import('../components/MapBoard.svelte').then((m) => (MapBoard = m.default));
  });

  // "Data" section — scoped, separately-confirmed resets (Phase 13). Each control
  // disables once its store is empty, giving immediate on-screen feedback with no toast.
  let historyPresent = $state(false);
  let trainingPresent = $state(false);
  let historyDialogOpen = $state(false);
  let trainingDialogOpen = $state(false);

  // Route remounts on navigation, so this reflects data cleared elsewhere (e.g. History).
  $effect(() => {
    if ($storageReady) {
      void hasSessions().then((v) => (historyPresent = v));
      void hasTrainingData().then((v) => (trainingPresent = v));
    }
  });

  async function confirmClearHistory(): Promise<void> {
    await clearHistory();
    historyPresent = false;
    historyDialogOpen = false;
  }

  async function confirmResetTraining(): Promise<void> {
    await clearTraining();
    trainingPresent = false;
    trainingDialogOpen = false;
  }
</script>

<section class="settings">
  <h1>{$t('settings.title')}</h1>

  {#if $storageReady && !$persistent}
    <p class="warning" role="alert">{$t('settings.notPersisted')}</p>
  {/if}

  <div class="row">
    <span class="label">{$t('settings.language')}</span>
    <LanguageSwitcher />
  </div>

  <h2>{$t('settings.gameplay')}</h2>

  <div class="row">
    <label class="label" for="pref-fixed">{$t('settings.fixedLength')}</label>
    <input
      id="pref-fixed"
      type="number"
      min={B.fixedLength.min}
      max={B.fixedLength.max}
      value={$prefs.fixedLength}
      onchange={onNumber('fixedLength')}
    />
  </div>

  <div class="row">
    <label class="label" for="pref-lives">{$t('settings.survivalLives')}</label>
    <input
      id="pref-lives"
      type="number"
      min={B.survivalLives.min}
      max={B.survivalLives.max}
      value={$prefs.survivalLives}
      onchange={onNumber('survivalLives')}
    />
  </div>

  <div class="row">
    <label class="label" for="pref-choices">{$t('settings.choices')}</label>
    <input
      id="pref-choices"
      type="number"
      min={B.choicesPerQuestion.min}
      max={B.choicesPerQuestion.max}
      value={$prefs.choicesPerQuestion}
      onchange={onNumber('choicesPerQuestion')}
    />
  </div>

  <p class="hint">{$t('settings.hint')}</p>

  <h2>{$t('settings.motion')}</h2>

  <div class="row">
    <label class="label" for="pref-reduce-motion">{$t('settings.reduceMotion')}</label>
    <input
      id="pref-reduce-motion"
      type="checkbox"
      checked={$prefs.reduceMotion}
      onchange={(e) => updatePrefs({ reduceMotion: e.currentTarget.checked })}
    />
  </div>

  <p class="hint">{$t('settings.reduceMotionHint')}</p>

  <h2>{$t('settings.sound')}</h2>

  <div class="row">
    <label class="label" for="pref-sound">{$t('settings.soundEffects')}</label>
    <input
      id="pref-sound"
      type="checkbox"
      checked={$prefs.sound}
      onchange={(e) => updatePrefs({ sound: e.currentTarget.checked })}
    />
  </div>

  <p class="hint">{$t('settings.soundEffectsHint')}</p>

  <h2>{$t('duel.settingsTitle')}</h2>

  <div class="row">
    <label class="label" for="pref-duel-name">{$t('duel.settingsLabel')}</label>
    <input
      id="pref-duel-name"
      type="text"
      autocomplete="nickname"
      maxlength={PLAYER_NAME_MAX_LENGTH}
      placeholder={$t('duel.namePlaceholder')}
      value={$prefs.playerName ?? ''}
      oninput={(e) => updatePrefs({ playerName: e.currentTarget.value })}
    />
  </div>

  <p class="hint">{$t('duel.settingsHelp')}</p>

  <h2>{$t('settings.map')}</h2>

  <div class="row">
    <label class="label" for="pref-projection">{$t('settings.mapProjection')}</label>
    <select id="pref-projection" value={$prefs.mapProjection} onchange={onProjection}>
      {#each MAP_PROJECTIONS as p (p)}
        <option value={p}>{$t(`settings.projection.${p}`)}</option>
      {/each}
    </select>
  </div>

  <div class="map-preview" aria-hidden="true">
    {#if MapBoard}
      <MapBoard projection={$prefs.mapProjection} />
    {:else}
      <div class="map-preview-placeholder"></div>
    {/if}
  </div>

  <h2>{$t('settings.data.title')}</h2>

  <div class="data-row">
    <div class="data-info">
      <span class="label">{$t('settings.data.historyLabel')}</span>
      <span class="sub">{$t('settings.data.historyHint')}</span>
    </div>
    <button
      type="button"
      class="danger"
      disabled={!historyPresent}
      onclick={() => (historyDialogOpen = true)}
    >
      {$t('settings.data.clearHistory')}
    </button>
  </div>

  <div class="data-row">
    <div class="data-info">
      <span class="label">{$t('settings.data.trainingLabel')}</span>
      <span class="sub">{$t('settings.data.trainingHint')}</span>
    </div>
    <button
      type="button"
      class="danger"
      disabled={!trainingPresent}
      onclick={() => (trainingDialogOpen = true)}
    >
      {$t('settings.data.resetTraining')}
    </button>
  </div>

  <CountryScopeNote />

  <h2>{$t('settings.about')}</h2>

  <div class="row">
    <span class="label">{$t('settings.version')}</span>
    <span class="version-value">{APP_VERSION}</span>
  </div>
</section>

<ConfirmDialog
  open={historyDialogOpen}
  title={$t('settings.data.clearHistoryTitle')}
  message={$t('settings.data.clearHistoryMessage')}
  confirmLabel={$t('settings.data.clearHistory')}
  onconfirm={confirmClearHistory}
  oncancel={() => (historyDialogOpen = false)}
/>

<ConfirmDialog
  open={trainingDialogOpen}
  title={$t('settings.data.resetTrainingTitle')}
  message={$t('settings.data.resetTrainingMessage')}
  confirmLabel={$t('settings.data.resetTraining')}
  onconfirm={confirmResetTraining}
  oncancel={() => (trainingDialogOpen = false)}
/>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    /* A single comfortable centred column on desktop (Phase 34). */
    max-width: 640px;
    margin-inline: auto;
    width: 100%;
  }

  h2 {
    margin: 0.75rem 0 0;
    font-size: 1.05rem;
    color: var(--color-muted);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    max-width: 26rem;
  }

  .label {
    font-weight: 600;
  }

  input[type='number'] {
    width: 5rem;
    padding: 0.4rem 0.55rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    font: inherit;
    text-align: right;
  }

  input[type='number']:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  select {
    padding: 0.4rem 0.55rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    font: inherit;
  }

  select:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  input[type='checkbox'] {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: var(--color-accent);
    cursor: pointer;
  }

  /* A small, non-interactive world thumbnail that re-projects as the pref changes,
     so the chosen projection is visible without opening a map game. */
  .map-preview {
    max-width: 26rem;
  }

  .map-preview-placeholder {
    aspect-ratio: 980 / 500;
    width: 100%;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  .warning {
    margin: 0;
    padding: 0.6rem 0.8rem;
    color: var(--color-wrong);
    background: var(--color-wrong-bg);
    border: 1px solid var(--color-wrong);
    border-radius: var(--radius);
    font-size: 0.9rem;
    font-weight: 600;
  }

  .hint {
    margin: 0.25rem 0 0;
    color: var(--color-muted);
    font-size: 0.85rem;
  }

  .version-value {
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  /* Data section */
  .data-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    max-width: 34rem;
  }

  .data-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .sub {
    color: var(--color-muted);
    font-size: 0.85rem;
  }

  .danger {
    flex: 0 0 auto;
    padding: 0.4rem 0.9rem;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-muted);
    font-weight: 600;
  }

  .danger:hover:not(:disabled) {
    border-color: var(--color-wrong);
    color: var(--color-wrong);
  }

  .danger:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
