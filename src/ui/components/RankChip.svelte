<script lang="ts">
  import { t } from '../../i18n';
  import type { XpResult, RankProgress } from '../../domain';
  import RankMedal from './RankMedal.svelte';

  // Compact Explorer-rank glance for Home (Phase 43): the rank medal, name, total XP and a slim bar
  // toward the next rank — the continuous progression cue sitting next to the streak. The full
  // breakdown (incl. the "N XP to <next>" text) lives on Progress (RankPanel). Presentational.
  //
  // Deliberately terse: the medal leads (the reward you're chasing), and the slim bar carries the
  // "progress toward next" meaning on its own — so the textual "N XP to <next>" footnote is dropped
  // here to keep the chip a two-line glance and give the badge room.
  let { xp, progress }: { xp: XpResult; progress: RankProgress } = $props();

  const pct = $derived(Math.round(progress.fraction * 100));
  const rankName = $derived($t(`rank.names.${progress.rank.key}`));
</script>

<div class="chip" data-testid="rank-chip">
  <RankMedal index={progress.rank.index} size={70} />
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
  </div>
</div>

<style>
  .chip {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    /* Trim the left inset so the enlarged medal can sit closer to the card edge (reclaimed space)
       without crowding the name/XP block. */
    padding: 0.5rem 0.85rem 0.5rem 0.55rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
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

  @media (prefers-reduced-motion: reduce) {
    .fill {
      transition: none;
    }
  }
</style>
