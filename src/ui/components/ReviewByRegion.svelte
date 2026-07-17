<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { t, localizedRegion } from '../../i18n';
  import { masteryFamilyOf, type GameMode, type RegionReview } from '../../domain';
  import { pendingReview } from '../stores/game';
  import type { TrainingPlan } from '../stores/persistence';
  import Icon from './Icon.svelte';
  import RegionIcon from './RegionIcon.svelte';
  import ModeIcon from './ModeIcon.svelte';

  // "Time to review" (Phase 26): the region-aware review surface. Lists the player's trainable
  // SR state grouped by top-level region, most-urgent first, so a Europe-focused learner can
  // review Europe without a polluted "World" backlog dragging in freshly-failed foreign items.
  // The first (most-urgent) region is styled as the pre-selected primary action; a
  // "review everything" row keeps the old global one-tap behaviour as an escape hatch.
  //
  // Phase 48: each row now names the **mode** (a glyph + the Map/Flags/Capitals family label) as
  // well as the region + count, and a tap stages the selection for the `#/review` preview screen
  // (the "Ready to review?" study card) rather than jumping straight into the game.
  let { reviews, plan }: { reviews: RegionReview[]; plan: TrainingPlan | null } = $props();

  /** Short family label (Map / Flags / Capitals) for a review's dominant mode. */
  function modeLabel(mode: GameMode): string {
    const family = masteryFamilyOf(mode) ?? 'map';
    return $t(`modes.group.${family}`);
  }

  /** Stage a region-scoped (or global) review and open the preview screen (Phase 48). */
  function startReview(mode: GameMode, iso2s: string[], region: string | null): void {
    pendingReview.set({ mode, iso2s, region });
    push('/review');
  }
</script>

<section class="review" aria-labelledby="review-title">
  <h2 class="eyebrow" id="review-title">{$t('home.review.title')}</h2>

  <ul class="rows">
    {#each reviews as review, i (review.region)}
      <li>
        <button
          type="button"
          class="row region"
          class:primary={i === 0}
          onclick={() => startReview(review.mode, review.iso2s, review.region)}
        >
          <span class="region-icon" aria-hidden="true"><RegionIcon region={review.region} /></span>
          <span class="meta">
            <span class="name">{$localizedRegion(review.region)}</span>
            <span class="mode">
              <span class="mode-ico" aria-hidden="true"><ModeIcon mode={review.mode} /></span>
              {modeLabel(review.mode)}
            </span>
          </span>
          <span class="count">{$t('home.review.regionCount', { count: review.total })}</span>
          <Icon name="chevron-right" size={18} />
        </button>
      </li>
    {/each}
  </ul>

  {#if plan}
    <button
      type="button"
      class="row everything"
      onclick={() => startReview(plan.mode, plan.iso2s, null)}
    >
      <span class="region-icon" aria-hidden="true"><Icon name="train" size={18} /></span>
      <span class="meta">
        <span class="name">{$t('home.review.everything', { count: plan.iso2s.length })}</span>
        <span class="mode">
          <span class="mode-ico" aria-hidden="true"><ModeIcon mode={plan.mode} /></span>
          {modeLabel(plan.mode)}
        </span>
      </span>
      <Icon name="chevron-right" size={18} />
    </button>
  {/if}
</section>

<style>
  .review {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 1.1rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .eyebrow {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-accent);
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  /* A review row: region silhouette · (name + mode) · count · chevron. Full-width tap target. */
  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.55rem 0.7rem;
    background: none;
    border: 2px solid transparent;
    border-radius: var(--radius);
    color: var(--color-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition:
      background 0.12s ease,
      border-color 0.12s ease,
      transform 0.12s ease;
  }

  .row:hover {
    background: var(--color-accent-weak);
  }

  .row:active {
    transform: translateY(1px);
  }

  /* The most-urgent region is pre-selected: accent-tinted with a solid border so it reads as
     the recommended one-tap action, matching the "Next up" hero treatment. */
  .row.primary {
    background: var(--color-accent-weak);
    border-color: var(--color-accent);
    color: var(--color-accent-strong);
  }

  .region-icon {
    flex: 0 0 auto;
    width: 1.75rem;
    height: 1.75rem;
    display: grid;
    place-items: center;
    color: var(--color-accent);
  }

  /* Name + mode stack in the flexible middle column; the count is pushed hard-right. */
  .meta {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.05rem;
  }

  .name {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* The mode line: a small glyph + the Map/Flags/Capitals family label. */
  .mode {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--color-muted);
  }

  .mode-ico {
    display: inline-flex;
  }

  .mode-ico :global(.mode-icon) {
    width: 0.95rem;
    height: 0.95rem;
  }

  .row.primary .mode {
    color: var(--color-accent-strong);
    opacity: 0.85;
  }

  /* Count sits hard-right, pushed there by the flexible meta column. */
  .count {
    margin-left: auto;
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--color-muted);
    flex: 0 0 auto;
  }

  .row.primary .count {
    color: var(--color-accent-strong);
  }

  /* The global escape hatch: a muted footer row under a hairline divider. */
  .everything {
    margin-top: 0.15rem;
    border-top: 1px solid var(--color-border);
    border-radius: 0;
    color: var(--color-muted);
  }

  .everything .name {
    font-size: 0.95rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .row {
      transition: none;
    }

    .row:active {
      transform: none;
    }
  }
</style>
