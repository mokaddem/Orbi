<script lang="ts">
  import { t } from '../../i18n';

  // Phase 21 (Stage A): an honest, localised disclaimer of what the app counts as a
  // "country" — the 195 UN members + observers baseline, and what it leaves out. Copy
  // only, no gameplay/data change. Rendered in Settings and at the foot of the Atlas.
  // The scope rule itself lives in scripts/build-data.mjs (`unMember` + OBSERVERS={PS}).
</script>

<section class="scope-note" aria-labelledby="country-scope-heading">
  <h2 id="country-scope-heading">{$t('settings.scope.title')}</h2>
  <p>{$t('settings.scope.body')}</p>
  <p>{$t('settings.scope.excludes')}</p>
  <p class="muted">{$t('settings.scope.note')}</p>
</section>

<style>
  .scope-note {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 40rem;
    padding: 0.9rem 1.1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  .scope-note h2 {
    margin: 0;
    font-size: 1rem;
    color: var(--color-text);
  }

  .scope-note p {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.5;
    color: var(--color-muted);
  }

  .scope-note p.muted {
    font-style: italic;
  }
</style>
