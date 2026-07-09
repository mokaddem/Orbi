<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { t } from '../../i18n';
  import { pendingConfig } from '../stores/game';
  import {
    loadDailyState,
    loadMastery,
    loadRecommendations,
    loadStreak,
    loadTrainingPlan,
    prefs,
    storageReady,
    type DailyState,
    type TrainingPlan,
  } from '../stores/persistence';
  import type { MasteryResult, Recommendation, StreakInfo } from '../../domain';
  import Demo from '../components/Demo.svelte';
  import Icon from '../components/Icon.svelte';
  import Mascot from '../components/Mascot.svelte';
  import NextUpCard from '../components/NextUpCard.svelte';
  import StreakIndicator from '../components/StreakIndicator.svelte';
  import DailyChallengeCard from '../components/DailyChallengeCard.svelte';
  import WorldMasteryMeter from '../components/WorldMasteryMeter.svelte';

  // The "Next up" card (Phase 14) is the hero: it reads the player's own state and, in one
  // tap, launches the highest-value action (due reviews → weak spot → a fresh round). We
  // recompute on mount (this route remounts on navigation, so it refreshes after each
  // session) and whenever storage finishes initializing. The full-backlog "train all my
  // mistakes" link is kept as a secondary escape hatch alongside custom play.
  let recs = $state<Recommendation[] | null>(null);
  let plan = $state<TrainingPlan | null>(null);
  let streak = $state<StreakInfo | null>(null);
  let daily = $state<DailyState | null>(null);
  let mastery = $state<MasteryResult | null>(null);

  $effect(() => {
    if ($storageReady) {
      void loadRecommendations().then((r) => (recs = r));
      void loadTrainingPlan().then((p) => (plan = p));
      void loadStreak().then((s) => (streak = s));
      void loadDailyState().then((d) => (daily = d));
      void loadMastery().then((m) => (mastery = m));
    }
  });

  function trainAll(): void {
    if (!plan) return;
    const p = $prefs;
    pendingConfig.set({
      mode: plan.mode,
      type: 'training',
      answerPoolIso: plan.iso2s,
      fixedLength: plan.iso2s.length,
      choices: p.choicesPerQuestion,
    });
    push('/play');
  }
</script>

<section class="home">
  <header class="home-header">
    <Mascot pose="wave" size={84} />
    <div class="home-heading">
      <h1>{$t('home.title')}</h1>
      <p class="tagline">{$t('home.tagline')}</p>
    </div>
  </header>

  {#if streak}
    <div class="streak-row">
      <StreakIndicator {streak} />
    </div>
  {/if}

  <Demo />

  {#if recs && recs.length}
    <NextUpCard rec={recs[0]} />
  {/if}

  {#if daily}
    <div class="daily-row">
      <DailyChallengeCard challenge={daily.challenge} done={daily.done} result={daily.result} />
    </div>
  {/if}

  {#if mastery}
    <div class="mastery-row">
      <WorldMasteryMeter {mastery} compact />
    </div>
  {/if}

  <div class="actions">
    <a class="play-link" href="#/play">
      <Icon name="custom" size={16} />
      <span>{$t('home.playCustom')}</span>
    </a>
    {#if plan}
      <button type="button" class="train-link" onclick={trainAll}>
        <Icon name="train" size={16} />
        <span>{$t('home.trainAll', { count: plan.iso2s.length })}</span>
      </button>
    {/if}
  </div>
</section>

<style>
  /* Hero header: the globe mascot greets beside the title. It's decorative spot art (the
     mascot is aria-hidden), so the heading text still carries the screen. */
  .home-header {
    display: flex;
    align-items: center;
    gap: 0.9rem;
  }

  .home-heading {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .home-header h1 {
    margin: 0;
  }

  .tagline {
    color: var(--color-muted);
    font-size: 1.1rem;
    margin: 0;
  }

  /* A block row so the inline streak pill sits left-aligned with controlled spacing. */
  .streak-row {
    margin: 0.25rem 0 0;
  }

  /* Separate the Daily Challenge card from the Next-up card above it. */
  .daily-row {
    margin-top: 1rem;
  }

  /* The compact world-mastery glance sits below the daily card. */
  .mastery-row {
    margin-top: 1rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem 1.25rem;
    margin-top: 0.25rem;
  }

  .play-link,
  .train-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-muted);
    font-weight: 700;
    font-size: 0.95rem;
    text-decoration: none;
    cursor: pointer;
    transition: color 0.12s ease;
  }

  .play-link:hover,
  .train-link:hover {
    color: var(--color-accent);
    text-decoration: underline;
  }
</style>
