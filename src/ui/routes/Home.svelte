<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { t } from '../../i18n';
  import { pendingConfig } from '../stores/game';
  import {
    loadRecommendations,
    loadTrainingPlan,
    prefs,
    storageReady,
    type TrainingPlan,
  } from '../stores/persistence';
  import type { Recommendation } from '../../domain';
  import Demo from '../components/Demo.svelte';
  import NextUpCard from '../components/NextUpCard.svelte';

  // The "Next up" card (Phase 14) is the hero: it reads the player's own state and, in one
  // tap, launches the highest-value action (due reviews → weak spot → a fresh round). We
  // recompute on mount (this route remounts on navigation, so it refreshes after each
  // session) and whenever storage finishes initializing. The full-backlog "train all my
  // mistakes" link is kept as a secondary escape hatch alongside custom play.
  let recs = $state<Recommendation[] | null>(null);
  let plan = $state<TrainingPlan | null>(null);

  $effect(() => {
    if ($storageReady) {
      void loadRecommendations().then((r) => (recs = r));
      void loadTrainingPlan().then((p) => (plan = p));
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

  <Demo />

  {#if recs && recs.length}
    <NextUpCard rec={recs[0]} />
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
