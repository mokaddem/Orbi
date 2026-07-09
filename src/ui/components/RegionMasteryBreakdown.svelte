<script lang="ts">
  import { t, localizedRegion } from '../../i18n';
  import type { RegionMastery } from '../../domain';
  import RegionIcon from './RegionIcon.svelte';

  // Per-region mastery breakdown (Phase 16): one row per M49 region with its continent
  // silhouette, localized name, mastered/total count, and a progress bar. Rows arrive
  // pre-ordered least-complete first (from `computeMastery`), so this stays presentational.
  let { regions }: { regions: RegionMastery[] } = $props();
</script>

<ul class="regions" data-testid="region-mastery">
  {#each regions as r (r.region)}
    {@const pct = r.total === 0 ? 0 : (r.mastered / r.total) * 100}
    <li>
      <span class="icon" aria-hidden="true"><RegionIcon region={r.region} /></span>
      <div class="body">
        <div class="line">
          <span class="name">{$localizedRegion(r.region)}</span>
          <span class="count"
            >{$t('progress.mastery.regionCount', { mastered: r.mastered, total: r.total })}</span
          >
        </div>
        <div
          class="track"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax={r.total}
          aria-valuenow={r.mastered}
          aria-label={$localizedRegion(r.region)}
        >
          <div class="fill" style="width:{pct}%"></div>
        </div>
      </div>
    </li>
  {/each}
</ul>

<style>
  .regions {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .regions li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .icon {
    flex: 0 0 auto;
    width: 2rem;
    height: 2rem;
    display: grid;
    place-items: center;
    color: var(--color-accent);
  }

  .body {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-width: 0;
  }

  .line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .name {
    font-weight: 700;
  }

  .count {
    font-size: 0.85rem;
    color: var(--color-muted);
    white-space: nowrap;
  }

  .track {
    height: 0.55rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    overflow: hidden;
  }

  .fill {
    height: 100%;
    background: var(--color-accent);
  }
</style>
