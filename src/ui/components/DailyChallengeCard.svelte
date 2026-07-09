<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { t, localizedRegion } from '../../i18n';
  import type { DailyChallenge, GameMode } from '../../domain';
  import type { DailyResult } from '../../data';
  import { pendingConfig, dailyToConfig } from '../stores/game';
  import Icon from './Icon.svelte';
  import Mascot from './Mascot.svelte';
  import ModeIcon from './ModeIcon.svelte';
  import RegionIcon from './RegionIcon.svelte';

  // The Daily Challenge card (Phase 15): a date-seeded round that's the same all day. Given
  // today's `challenge` it shows the mode + region theme and launches a seeded RunConfig in
  // one tap. Once completed today (`done`), it flips to a finished state with the score and a
  // low-key "play again" (a replay is practice — it doesn't un-complete the day).
  let {
    challenge,
    done = false,
    result,
  }: { challenge: DailyChallenge; done?: boolean; result?: DailyResult } = $props();

  const MODE_LABEL: Record<GameMode, string> = {
    'flag-to-country': 'modes.flagToCountry',
    'country-to-flag': 'modes.countryToFlag',
    'map-highlight': 'modes.mapHighlight',
    'map-locate': 'modes.mapLocate',
  };

  const region = $derived(challenge.filter?.region ?? null);
  const themeLabel = $derived(region ? $localizedRegion(region) : $t('daily.world'));

  function start(): void {
    pendingConfig.set(dailyToConfig(challenge));
    push('/play');
  }
</script>

<div class="daily" class:done data-testid="daily-card" data-done={done}>
  <span class="eyebrow"><Icon name="calendar-check" size="0.95em" /> {$t('daily.label')}</span>
  <div class="body">
    <span class="icon" aria-hidden="true">
      {#if region}
        <RegionIcon {region} />
      {:else}
        <ModeIcon mode={challenge.mode} />
      {/if}
    </span>
    <div class="text">
      <h2 class="title">{$t('daily.title')}</h2>
      <p class="theme">
        <span>{$t(MODE_LABEL[challenge.mode])}</span>
        <span class="dot" aria-hidden="true">·</span>
        <span>{themeLabel}</span>
      </p>
    </div>
    <Mascot pose="daily" size={54} />
  </div>

  {#if done}
    <div class="result">
      <span class="badge">{$t('daily.done')}</span>
      {#if result}
        <span class="score"
          >{$t('daily.score', { correct: result.correct, total: result.total })}</span
        >
      {/if}
      <button type="button" class="again" onclick={start}>{$t('daily.playAgain')}</button>
    </div>
  {:else}
    <button type="button" class="start" onclick={start}>{$t('daily.play')}</button>
  {/if}
</div>

<style>
  .daily {
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
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
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

  /* Let the text take the middle so the daily mascot sits at the far right. */
  .body .text {
    flex: 1 1 auto;
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

  .theme {
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    font-size: 0.9rem;
    color: var(--color-muted);
  }

  .dot {
    opacity: 0.6;
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

  .result {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem 0.9rem;
  }

  .badge {
    font-weight: 800;
    color: var(--color-correct);
  }

  .score {
    font-size: 0.9rem;
    color: var(--color-muted);
  }

  .again {
    margin-left: auto;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-muted);
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    transition: color 0.12s ease;
  }

  .again:hover {
    color: var(--color-accent);
    text-decoration: underline;
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
