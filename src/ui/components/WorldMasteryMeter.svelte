<script lang="ts">
  import { t } from '../../i18n';
  import { masteryFraction, type MasteryResult } from '../../domain';
  import { formatPercent } from '../format';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  // World-mastery meter (Phase 16): "how much of the world have I learned". A segmented
  // progress bar — solid for mastered countries, a lighter band for those still in
  // learning — plus a count. `compact` is the slimmer variant shown on Home; the full
  // variant is a titled card on History. Presentational: given the computed rollup.
  //
  // `titleKey` / `learnedKey` / `icon` default to the country-mastery labels but let the
  // same meter render the separate capital-mastery rollup (Phase 24).
  let {
    mastery,
    compact = false,
    titleKey = 'progress.mastery.title',
    learnedKey = 'progress.mastery.learned',
    icon = 'globe',
  }: {
    mastery: MasteryResult;
    compact?: boolean;
    titleKey?: string;
    learnedKey?: string;
    icon?: IconName;
  } = $props();

  const overall = $derived(mastery.overall);
  const total = $derived(Math.max(1, overall.total)); // guard div-by-zero for the widths
  const masteredPct = $derived((overall.mastered / total) * 100);
  const learningPct = $derived((overall.learning / total) * 100);
  const pctLabel = $derived(formatPercent(masteryFraction(overall)));
</script>

<div class="meter" class:compact data-testid="mastery-meter">
  <div class="head">
    <span class="title"><Icon name={icon} size="1.1em" />{$t(titleKey)}</span>
    <span class="pct">{pctLabel}</span>
  </div>
  <div
    class="track"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax={overall.total}
    aria-valuenow={overall.mastered}
    aria-label={$t(titleKey)}
  >
    <div class="fill mastered" style="width:{masteredPct}%"></div>
    <div class="fill learning" style="width:{learningPct}%"></div>
  </div>
  <span class="sub">{$t(learnedKey, { mastered: overall.mastered, total: overall.total })}</span>
</div>

<style>
  .meter {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 1.1rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .meter.compact {
    gap: 0.35rem;
    padding: 0.7rem 0.9rem;
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .title {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 800;
    font-size: 1.05rem;
  }

  .title :global(.icon) {
    color: var(--color-accent);
  }

  .compact .title {
    font-size: 0.95rem;
  }

  .pct {
    font-weight: 800;
    color: var(--color-accent);
  }

  .track {
    display: flex;
    height: 0.7rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    overflow: hidden;
  }

  .compact .track {
    height: 0.55rem;
  }

  .fill {
    height: 100%;
  }

  .fill.mastered {
    background: var(--color-accent);
  }

  .fill.learning {
    background: var(--color-accent-weak);
  }

  .sub {
    font-size: 0.82rem;
    color: var(--color-muted);
  }
</style>
