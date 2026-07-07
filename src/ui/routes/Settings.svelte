<script lang="ts">
  import { t } from '../../i18n';
  import { PREFS_BOUNDS } from '../../data';
  import { prefs, updatePrefs, persistent, storageReady } from '../stores/persistence';
  import LanguageSwitcher from '../components/LanguageSwitcher.svelte';

  const B = PREFS_BOUNDS;

  function onNumber(field: 'fixedLength' | 'survivalLives' | 'choicesPerQuestion') {
    return (e: Event & { currentTarget: HTMLInputElement }) => {
      const value = Number(e.currentTarget.value);
      if (Number.isFinite(value)) updatePrefs({ [field]: value });
    };
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
</section>

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
</style>
