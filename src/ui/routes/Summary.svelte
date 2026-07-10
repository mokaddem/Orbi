<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { t, localizedName, localizedRegion } from '../../i18n';
  import { formatDuration, formatPercent } from '../format';
  import { play, lastSummary, pendingConfig } from '../stores/game';
  import { loadRecommendations, prefs, storageReady } from '../stores/persistence';
  import type { Recommendation } from '../../domain';
  import Flag from '../components/Flag.svelte';
  import Icon from '../components/Icon.svelte';
  import Mascot from '../components/Mascot.svelte';
  import ModeIcon from '../components/ModeIcon.svelte';
  import RegionIcon from '../components/RegionIcon.svelte';
  import NextUpCard from '../components/NextUpCard.svelte';

  // A forward-looking "Next up" suggestion, computed from the player's overall state
  // (distinct from the session-specific Retry / Train-these actions below). Refreshed on
  // mount; the just-finished session's SR writes may still be settling, so it's a soft
  // nudge that becomes exact on the next Home visit.
  let recs = $state<Recommendation[] | null>(null);

  $effect(() => {
    if ($storageReady) void loadRecommendations().then((r) => (recs = r));
  });

  const MODE_LABEL: Record<string, string> = {
    'flag-to-country': 'modes.flagToCountry',
    'country-to-flag': 'modes.countryToFlag',
    'map-highlight': 'modes.mapHighlight',
    'map-locate': 'modes.mapLocate',
    'capital-to-country': 'modes.capitalToCountry',
    'country-to-capital': 'modes.countryToCapital',
    'country-to-languages': 'modes.countryToLanguages',
    'country-to-industry': 'modes.mainIndustries',
  };

  function retry(): void {
    const s = $lastSummary;
    if (!s) return;
    const p = $prefs;
    // A training session has no region filter; reuse the same drilled countries
    // (every distinct country asked) so "Retry" re-runs the same set.
    if (s.type === 'training') {
      const iso2s = [...new Set(s.results.map((r) => r.countryIso2))];
      pendingConfig.set({
        mode: s.mode,
        type: 'training',
        answerPoolIso: iso2s,
        fixedLength: iso2s.length,
        choices: p.choicesPerQuestion,
      });
      push('/play');
      return;
    }
    pendingConfig.set({
      mode: s.mode,
      type: s.type,
      filter: s.regionFilter,
      fixedLength: p.fixedLength,
      lives: p.survivalLives,
      choices: p.choicesPerQuestion,
    });
    push('/play');
  }

  function trainMissed(): void {
    const s = $lastSummary;
    if (!s || s.missed.length === 0) return;
    const p = $prefs;
    // Re-drill exactly the countries just missed, in the same mode. Distractors are
    // drawn from the whole world (see the session's answer-pool handling), and each
    // missed country is asked once (fixedLength = pool size).
    pendingConfig.set({
      mode: s.mode,
      type: 'training',
      answerPoolIso: s.missed.map((c) => c.iso2),
      fixedLength: s.missed.length,
      choices: p.choicesPerQuestion,
    });
    push('/play');
  }

  function newGame(): void {
    play.reset();
    pendingConfig.set(null);
    push('/play');
  }
</script>

<section class="summary">
  <h1>{$t('summary.title')}</h1>

  {#if !$lastSummary}
    <div class="empty-state">
      <Mascot pose="thinking" size={116} />
      <p class="empty">{$t('summary.empty')}</p>
      <a class="cta" href="#/play">{$t('summary.playNow')}</a>
    </div>
  {:else}
    {@const s = $lastSummary}
    {@const regionKey = s.regionFilter?.subregion ?? s.regionFilter?.region ?? null}
    <p class="meta">
      <span class="meta-ico" aria-hidden="true"><ModeIcon mode={s.mode} /></span>
      <span>{$t(MODE_LABEL[s.mode] ?? s.mode)}</span>
      <span class="dot" aria-hidden="true">·</span>
      <span>{$t(`sessionType.${s.type}`)}</span>
      {#if regionKey}
        <span class="dot" aria-hidden="true">·</span>
        <span class="meta-region">
          <span class="meta-region-ico" aria-hidden="true"
            ><RegionIcon region={s.regionFilter?.region ?? ''} /></span
          >
          {$localizedRegion(regionKey)}
        </span>
      {/if}
    </p>

    <div class="stats">
      <div class="stat">
        <span class="stat-ico" aria-hidden="true"><Icon name="trophy" size={18} /></span>
        <span class="value">{s.correct}/{s.total}</span>
        <span class="label">{$t('summary.score')}</span>
      </div>
      <div class="stat">
        <span class="stat-ico" aria-hidden="true"><Icon name="target" size={18} /></span>
        <span class="value">{formatPercent(s.accuracy)}</span>
        <span class="label">{$t('summary.accuracy')}</span>
      </div>
      <div class="stat">
        <span class="stat-ico" aria-hidden="true"><Icon name="clock" size={18} /></span>
        <span class="value">{formatDuration(s.durationMs)}</span>
        <span class="label">{$t('summary.time')}</span>
      </div>
      <div class="stat">
        <span class="stat-ico" aria-hidden="true"><Icon name="flame" size={18} /></span>
        <span class="value">{s.bestStreak}</span>
        <span class="label">{$t('summary.bestStreak')}</span>
      </div>
    </div>

    <div class="missed">
      {#if s.missed.length === 0}
        <div class="perfect-state">
          <Mascot pose="celebrate" size={104} />
          <p class="perfect">{$t('summary.noneMissed')}</p>
        </div>
      {:else}
        <h2>{$t('summary.missedTitle', { count: s.missed.length })}</h2>
        <ul class="missed-list">
          {#each s.missed as country (country.iso2)}
            <li>
              <span class="missed-flag"><Flag {country} alt={$localizedName(country)} /></span>
              <span class="missed-name">{$localizedName(country)}</span>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

    {#if recs && recs.length}
      <NextUpCard rec={recs[0]} />
    {/if}

    <div class="actions">
      <button type="button" class="primary" onclick={retry}>
        <Icon name="repeat" size="1em" />
        {$t('summary.retry')}
      </button>
      <button
        type="button"
        class="secondary"
        onclick={trainMissed}
        disabled={s.missed.length === 0}
        title={s.missed.length === 0 ? $t('summary.trainNone') : $t('summary.trainThese')}
      >
        <Icon name="train" size="1em" />
        {$t('summary.train')}
      </button>
      <button type="button" class="ghost" onclick={newGame}>
        <Icon name="play" size="1em" />
        {$t('summary.newGame')}
      </button>
    </div>
  {/if}
</section>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .empty {
    color: var(--color-muted);
  }

  /* No-result / perfect states: centre the mascot above its message. */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.7rem;
    padding: 1.5rem 1rem 0.5rem;
  }

  .empty-state .cta {
    align-self: center;
  }

  .cta {
    align-self: flex-start;
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

  .meta {
    margin: -0.5rem 0 0;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
    color: var(--color-muted);
    font-weight: 600;
  }

  .meta-ico {
    display: inline-flex;
    width: 1.15rem;
    height: 1.15rem;
    color: var(--color-accent);
  }

  .meta-region {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .meta-region-ico {
    display: inline-flex;
    width: 1.35rem;
    height: 1.35rem;
    color: var(--color-accent);
  }

  .dot {
    opacity: 0.6;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    padding: 1rem 0.5rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .stat-ico {
    display: inline-flex;
    color: var(--color-accent);
  }

  .stat .value {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .stat .label {
    font-size: 0.8rem;
    color: var(--color-muted);
  }

  .perfect-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.5rem;
    padding: 0.5rem 0;
  }

  .perfect {
    color: var(--color-correct);
    font-weight: 600;
  }

  .missed-list {
    list-style: none;
    margin: 0.5rem 0 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.5rem;
  }

  .missed-list li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0.6rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .missed-flag {
    flex: 0 0 auto;
    width: 40px;
  }

  .missed-name {
    font-size: 0.9rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .actions button {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.55rem 1.3rem;
    border-radius: var(--radius);
    font-weight: 700;
    border: 2px solid transparent;
    transition:
      transform 0.12s ease,
      border-color 0.12s ease,
      box-shadow 0.12s ease;
  }

  .primary {
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    box-shadow: var(--shadow-chunky);
  }

  .primary:hover {
    transform: translateY(-2px);
  }

  .primary:active {
    transform: translateY(2px);
    box-shadow: var(--shadow-chunky-press);
  }

  .secondary {
    background: var(--color-surface);
    border-color: var(--color-border);
    color: var(--color-text);
  }

  .secondary:hover:not(:disabled) {
    border-color: var(--color-accent);
    transform: translateY(-2px);
  }

  .secondary:disabled {
    color: var(--color-muted);
    cursor: not-allowed;
  }

  .ghost {
    background: transparent;
    border-color: var(--color-border);
    color: var(--color-text);
  }

  @media (prefers-reduced-motion: reduce) {
    .cta,
    .actions button {
      transition: none;
    }

    .cta:hover,
    .primary:hover,
    .secondary:hover:not(:disabled) {
      transform: none;
    }
  }

  @media (max-width: 560px) {
    .stats {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
