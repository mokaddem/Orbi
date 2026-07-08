<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { t } from '../../i18n';
  import { pendingConfig } from '../stores/game';
  import { loadTrainingPlan, prefs, storageReady, type TrainingPlan } from '../stores/persistence';
  import Demo from '../components/Demo.svelte';

  // "Train my mistakes" is available once there are weak items to drill. Recompute on
  // mount (this route remounts on navigation, so the count refreshes after each session)
  // and whenever storage finishes initializing.
  let plan = $state<TrainingPlan | null>(null);

  $effect(() => {
    if ($storageReady) void loadTrainingPlan().then((p) => (plan = p));
  });

  function train(): void {
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

  <div class="actions">
    <a class="cta" href="#/play">{$t('home.play')}</a>
    {#if plan}
      <button type="button" class="train" onclick={train}>
        {$t('home.trainCount', { count: plan.iso2s.length })}
      </button>
    {:else}
      <button type="button" class="train" disabled>{$t('home.train')}</button>
    {/if}
  </div>
  {#if !plan}
    <p class="train-hint">{$t('home.trainHint')}</p>
  {/if}
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
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .cta {
    display: inline-block;
    padding: 0.6rem 1.2rem;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border-radius: var(--radius);
    font-weight: 800;
    box-shadow: var(--shadow-chunky);
    transition:
      transform 0.12s ease,
      box-shadow 0.12s ease;
  }

  .cta:hover {
    text-decoration: none;
    transform: translateY(-2px);
  }

  .cta:active {
    transform: translateY(2px);
    box-shadow: var(--shadow-chunky-press);
  }

  .train {
    padding: 0.6rem 1.2rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-text);
    font-weight: 700;
    box-shadow: var(--shadow-card);
    transition:
      transform 0.12s ease,
      border-color 0.12s ease,
      box-shadow 0.12s ease;
  }

  .train:hover:not(:disabled) {
    border-color: var(--color-accent);
    transform: translateY(-2px);
  }

  .train:disabled {
    color: var(--color-muted);
    cursor: not-allowed;
  }

  .train-hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-muted);
  }

  @media (prefers-reduced-motion: reduce) {
    .cta,
    .train {
      transition: none;
    }

    .cta:hover,
    .train:hover:not(:disabled) {
      transform: none;
    }
  }
</style>
