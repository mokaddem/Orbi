<script lang="ts">
  import { t } from '../../i18n';
  import { RANKS, type XpResult, type RankProgress, type XpSourceKey } from '../../domain';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';
  import RankMedal from './RankMedal.svelte';

  // Full Explorer-rank surface (Phase 43): the rank badge + name, a big XP progress bar toward the
  // next rank, and a breakdown of where the XP came from. The continuous progression line that sits
  // alongside the milestone badges. Presentational — `xp`/`progress` are pure domain rollups.
  let { xp, progress }: { xp: XpResult; progress: RankProgress } = $props();

  const pct = $derived(Math.round(progress.fraction * 100));
  const rankName = $derived($t(`rank.names.${progress.rank.key}`));
  const nextName = $derived(progress.next ? $t(`rank.names.${progress.next.key}`) : '');

  const SOURCE_ICON: Record<XpSourceKey, IconName> = {
    correct: 'check',
    questions: 'target',
    sessions: 'play',
    streakBonus: 'flame',
    streak: 'calendar',
    badges: 'trophy',
  };
  // Only the sources that actually contributed, biggest first.
  const breakdown = $derived(xp.bySource.filter((s) => s.xp > 0).sort((a, b) => b.xp - a.xp));
</script>

<div class="rank" data-testid="rank-panel">
  <div class="rank-head">
    <RankMedal index={progress.rank.index} size={54} />
    <div class="rank-id">
      <span class="rank-name">{rankName}</span>
      <span class="rank-level">
        {$t('rank.level', { n: progress.rank.index + 1, total: RANKS.length })}
      </span>
    </div>
    <span class="rank-xp">{$t('rank.xpTotal', { xp: xp.total.toLocaleString() })}</span>
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

  {#if breakdown.length > 0}
    <h3 class="subhead">{$t('rank.breakdownTitle')}</h3>
    <ul class="sources">
      {#each breakdown as s (s.key)}
        <li class="src-row">
          <span class="src-ico" aria-hidden="true"
            ><Icon name={SOURCE_ICON[s.key]} size={16} /></span
          >
          <span class="src-label">
            <span class="src-name">{$t(`rank.source.${s.key}`)}</span>
            <span class="src-count">{s.count.toLocaleString()}</span>
          </span>
          <span class="src-xp">{$t('rank.earned', { xp: s.xp.toLocaleString() })}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .rank {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .rank-head {
    display: flex;
    align-items: center;
    gap: 0.7rem;
  }

  .rank-id {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1 1 auto;
  }

  .rank-name {
    font-weight: 800;
    font-size: 1.15rem;
    line-height: 1.15;
  }

  .rank-level {
    font-size: 0.8rem;
    color: var(--color-muted);
  }

  .rank-xp {
    flex: 0 0 auto;
    font-weight: 800;
    color: var(--color-accent);
    font-variant-numeric: tabular-nums;
    font-size: 0.95rem;
  }

  .track {
    height: 0.7rem;
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
    font-size: 0.82rem;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  .subhead {
    margin: 0.35rem 0 0;
    font-size: 0.9rem;
    color: var(--color-muted);
  }

  .sources {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .src-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .src-ico {
    flex: 0 0 auto;
    display: inline-flex;
    color: var(--color-accent);
  }

  .src-label {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    flex: 1 1 auto;
    min-width: 0;
  }

  .src-name {
    font-size: 0.9rem;
    font-weight: 600;
  }

  .src-count {
    font-size: 0.78rem;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  .src-xp {
    flex: 0 0 auto;
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--color-accent-strong);
    font-variant-numeric: tabular-nums;
  }

  @media (prefers-reduced-motion: reduce) {
    .fill {
      transition: none;
    }
  }
</style>
