<script lang="ts">
  import { t } from '../../i18n';
  import type { XpResult, RankProgress } from '../../domain';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  // Compact Explorer-rank glance for Home (Phase 43): the rank badge, name, total XP and a slim bar
  // toward the next rank — the continuous progression cue sitting next to the streak. The full
  // breakdown lives on Progress (RankPanel). Presentational.
  let { xp, progress }: { xp: XpResult; progress: RankProgress } = $props();

  const pct = $derived(Math.round(progress.fraction * 100));
  const rankName = $derived($t(`rank.names.${progress.rank.key}`));
  const nextName = $derived(progress.next ? $t(`rank.names.${progress.next.key}`) : '');

  const RANK_ICONS: readonly IconName[] = [
    'shield',
    'shield',
    'award',
    'award',
    'medal',
    'medal',
    'gem',
    'gem',
    'crown',
    'crown',
  ];
  const rankIcon = $derived(RANK_ICONS[progress.rank.index] ?? 'award');
</script>

<div class="chip" data-testid="rank-chip">
  <span class="badge" aria-hidden="true"><Icon name={rankIcon} size={20} /></span>
  <div class="body">
    <div class="line">
      <span class="name">{rankName}</span>
      <span class="xp">{$t('rank.xp', { xp: xp.total.toLocaleString() })}</span>
    </div>
    <div
      class="track"
      role="progressbar"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={pct}
      aria-label={$t('rank.title')}
    >
      <div class="fill" style="width:{pct}%"></div>
    </div>
    <span class="to-next">
      {#if progress.next}
        {$t('rank.toNext', { xp: progress.xpToNext.toLocaleString(), rank: nextName })}
      {:else}
        {$t('rank.max')}
      {/if}
    </span>
  </div>
</div>

<style>
  .chip {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.7rem 0.9rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .badge {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 999px;
    background: var(--color-accent-weak);
    color: var(--color-accent-strong);
    border: 2px solid var(--color-accent);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    flex: 1 1 auto;
    min-width: 0;
  }

  .line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.15rem 0.6rem;
    /* On a very narrow chip (streak + chip on one row, small phone) let the XP drop below the
       name as a whole token rather than breaking the number mid-digits. */
    flex-wrap: wrap;
  }

  .name {
    font-weight: 800;
    font-size: 0.98rem;
    white-space: nowrap;
  }

  .xp {
    font-weight: 800;
    font-size: 0.85rem;
    color: var(--color-accent);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .track {
    height: 0.5rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-accent), var(--color-accent-strong));
    border-radius: 999px;
    transition: width 0.4s cubic-bezier(0.2, 0.8, 0.3, 1);
  }

  .to-next {
    font-size: 0.75rem;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-reduced-motion: reduce) {
    .fill {
      transition: none;
    }
  }
</style>
