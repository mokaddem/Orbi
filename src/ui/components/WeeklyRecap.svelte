<script lang="ts">
  import { t } from '../../i18n';
  import type { WeeklyRecap } from '../../domain';
  import { formatPercent } from '../format';

  // Weekly recap (Phase 16): a compact "this week" summary — sessions, accuracy, questions,
  // newly-mastered countries, and the current day-streak. Falls back to a nudge when the
  // week has no play yet. Presentational: given the computed recap.
  let { recap }: { recap: WeeklyRecap } = $props();

  const hasPlay = $derived(recap.sessions > 0);
</script>

<div class="recap" data-testid="weekly-recap" data-empty={!hasPlay}>
  {#if !hasPlay}
    <p class="empty">{$t('progress.recap.empty')}</p>
  {:else}
    <dl class="chips">
      <div class="chip">
        <dt>{$t('progress.recap.sessions')}</dt>
        <dd>{recap.sessions}</dd>
      </div>
      <div class="chip">
        <dt>{$t('progress.recap.accuracy')}</dt>
        <dd>{formatPercent(recap.accuracy)}</dd>
      </div>
      <div class="chip">
        <dt>{$t('progress.recap.questions')}</dt>
        <dd>{recap.questions}</dd>
      </div>
      <div class="chip">
        <dt>{$t('progress.recap.mastered')}</dt>
        <dd>+{recap.masteredThisWeek}</dd>
      </div>
      <div class="chip">
        <dt>{$t('progress.recap.streak')}</dt>
        <dd>{recap.currentStreak}</dd>
      </div>
    </dl>
  {/if}
</div>

<style>
  .empty {
    margin: 0;
    color: var(--color-muted);
  }

  .chips {
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
    gap: 0.6rem;
  }

  .chip {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    padding: 0.6rem 0.4rem;
    background: var(--color-bg);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
  }

  .chip dt {
    font-size: 0.72rem;
    color: var(--color-muted);
    text-align: center;
  }

  .chip dd {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 800;
  }
</style>
