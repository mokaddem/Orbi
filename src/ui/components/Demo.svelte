<script lang="ts">
  import { t } from '../../i18n';
</script>

<!-- Demo string proving runtime i18n: switches EN/FR with the language toggle. -->
<p class="demo" data-testid="demo">{$t('home.demo')}</p>

<style>
  .demo {
    margin: 1rem 0;
    padding: 0.75rem 1rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-muted);
  }
</style>
