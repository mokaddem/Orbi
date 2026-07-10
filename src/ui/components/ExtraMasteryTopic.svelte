<script lang="ts">
  import { t } from '../../i18n';
  import type { MasteryResult } from '../../domain';
  import WorldMasteryMeter from './WorldMasteryMeter.svelte';
  import RegionMasteryBreakdown from './RegionMasteryBreakdown.svelte';
  import type { IconName } from './icons';

  // One topic row inside the combined "extra knowledge" panel (Phase 23): a compact mastery
  // meter for a non-country topic (capitals, languages, later industries), with its per-region
  // breakdown tucked behind a toggle so several topics stack without dominating the page.
  // Country mastery keeps its own full-size primary panel; this keeps the extras lean.
  let {
    mastery,
    titleKey,
    learnedKey,
    regionsTitleKey,
    icon,
  }: {
    mastery: MasteryResult;
    titleKey: string;
    learnedKey: string;
    regionsTitleKey: string;
    icon: IconName;
  } = $props();

  let expanded = $state(false);
</script>

<div class="topic">
  <WorldMasteryMeter {mastery} compact {titleKey} {learnedKey} {icon} />
  <button
    type="button"
    class="toggle"
    aria-expanded={expanded}
    onclick={() => (expanded = !expanded)}
  >
    {expanded ? $t('progress.extras.hideRegions') : $t('progress.extras.showRegions')}
  </button>
  {#if expanded}
    <div class="regions">
      <h4 class="subhead">{$t(regionsTitleKey)}</h4>
      <RegionMasteryBreakdown regions={mastery.byRegion} />
    </div>
  {/if}
</div>

<style>
  .topic {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .toggle {
    align-self: flex-start;
    padding: 0.2rem 0.55rem;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-muted);
    font-size: 0.78rem;
    font-weight: 600;
  }

  .toggle:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .regions {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.2rem;
  }

  .subhead {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--color-muted);
  }
</style>
