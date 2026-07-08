<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { t, localizedRegion } from '../../i18n';
  import { formatPercent } from '../format';
  import type { Recommendation } from '../../domain';
  import { pendingConfig, recommendationToConfig } from '../stores/game';
  import { prefs } from '../stores/persistence';
  import ModeIcon from './ModeIcon.svelte';
  import RegionIcon from './RegionIcon.svelte';

  // The "Next up" card (Phase 14): renders the single top recommendation and starts it in
  // one tap. Presentational + self-contained — given a `rec` it maps the kind to a title,
  // reason, icon and CTA, then stages the right RunConfig (or routes to the setup screen
  // for the fresh-start fallback). Used on Home and Summary.
  let { rec }: { rec: Recommendation } = $props();

  // Interpolation values the reason/title strings need, assembled per kind. Region names
  // are localized here (the engine only carries the raw M49 key), percent is formatted.
  let params: Record<string, string | number> = $derived.by((): Record<string, string | number> => {
    if (rec.kind === 'weak-spot') {
      return {
        region: rec.regionKey ? $localizedRegion(rec.regionKey) : '',
        percent: formatPercent(rec.accuracy ?? 0),
      };
    }
    if (rec.kind === 'due') return { count: rec.count ?? 0 };
    return {};
  });

  // Map the kind onto its i18n key stem (recommend.due / recommend.weakSpot / recommend.fresh).
  const stem = $derived(
    rec.kind === 'due'
      ? 'recommend.due'
      : rec.kind === 'weak-spot'
        ? 'recommend.weakSpot'
        : 'recommend.fresh',
  );

  function start(): void {
    const cfg = recommendationToConfig(rec, $prefs);
    // fresh-start has no config → clear any staged one so Play shows its setup screen.
    pendingConfig.set(cfg);
    push('/play');
  }
</script>

<div class="next-up" data-testid="next-up-card" data-kind={rec.kind}>
  <span class="eyebrow">{$t('recommend.label')}</span>
  <div class="body">
    <span class="icon" aria-hidden="true">
      {#if rec.kind === 'due' && rec.mode}
        <ModeIcon mode={rec.mode} />
      {:else if rec.kind === 'weak-spot'}
        <RegionIcon region={rec.iconRegion ?? 'World'} />
      {:else}
        <RegionIcon region="World" />
      {/if}
    </span>
    <div class="text">
      <h2 class="title">{$t(`${stem}.title`, params)}</h2>
      <p class="reason">{$t(`${stem}.reason`, params)}</p>
    </div>
  </div>
  <button type="button" class="start" onclick={start}>{$t(`${stem}.cta`)}</button>
</div>

<style>
  .next-up {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 1.1rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .eyebrow {
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-accent);
  }

  .body {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }

  .icon {
    flex: 0 0 auto;
    width: 2.6rem;
    height: 2.6rem;
    display: grid;
    place-items: center;
    color: var(--color-accent);
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
  }

  .title {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 800;
    line-height: 1.2;
  }

  .reason {
    margin: 0;
    font-size: 0.9rem;
    color: var(--color-muted);
  }

  .start {
    align-self: flex-start;
    padding: 0.55rem 1.3rem;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border-radius: var(--radius);
    font-weight: 800;
    box-shadow: var(--shadow-chunky);
    transition:
      transform 0.12s ease,
      box-shadow 0.12s ease;
  }

  .start:hover {
    transform: translateY(-2px);
  }

  .start:active {
    transform: translateY(2px);
    box-shadow: var(--shadow-chunky-press);
  }

  @media (prefers-reduced-motion: reduce) {
    .start {
      transition: none;
    }

    .start:hover {
      transform: none;
    }
  }
</style>
