<script lang="ts">
  import { locale, setLocale, SUPPORTED_LOCALES, t } from '../../i18n';
</script>

<div class="lang-switch" role="group" aria-label={$t('settings.language')}>
  {#each SUPPORTED_LOCALES as option (option.code)}
    <button
      type="button"
      class:selected={$locale === option.code}
      aria-pressed={$locale === option.code}
      onclick={() => setLocale(option.code)}
    >
      {option.code.toUpperCase()}
    </button>
  {/each}
</div>

<style>
  .lang-switch {
    display: inline-flex;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .lang-switch button {
    border: 0;
    background: var(--color-surface);
    color: var(--color-muted);
    padding: 0.3rem 0.6rem;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .lang-switch button + button {
    border-left: 1px solid var(--color-border);
  }

  .lang-switch button.selected {
    background: var(--color-accent);
    color: var(--color-accent-contrast);
  }
</style>
