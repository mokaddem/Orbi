<script lang="ts">
  import { t } from '../../i18n';
  import { PREFS_BOUNDS } from '../../data';
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

  const B = PREFS_BOUNDS;

  function onNumber(field: 'fixedLength' | 'survivalLives' | 'choicesPerQuestion') {
    return (e: Event & { currentTarget: HTMLInputElement }) => {
      const value = Number(e.currentTarget.value);
      if (Number.isFinite(value)) updatePrefs({ [field]: value });
    };
  }

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
