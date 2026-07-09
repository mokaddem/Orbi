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
  <h1>{$t('home.title')}</h1>
  <p class="tagline">{$t('home.tagline')}</p>

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
    <a class="play-link" href="#/play">{$t('home.playCustom')}</a>
    {#if plan}
      <button type="button" class="train-link" onclick={trainAll}>
        {$t('home.trainAll', { count: plan.iso2s.length })}
      </button>
    {/if}
  </div>
</section>

<style>
  .tagline {
    color: var(--color-muted);
    font-size: 1.1rem;
    margin-top: -0.25rem;
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
