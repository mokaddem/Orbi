<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { t, localizedName, localizedRegion } from '../../i18n';
  import { formatDuration, formatPercent } from '../format';
  import { play, lastSummary, pendingConfig } from '../stores/game';
  import { prefs } from '../stores/persistence';
  import Flag from '../components/Flag.svelte';

  const MODE_LABEL: Record<string, string> = {
    'flag-to-country': 'modes.flagToCountry',
    'country-to-flag': 'modes.countryToFlag',
    'map-highlight': 'modes.mapHighlight',
    'map-locate': 'modes.mapLocate',
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
    <p class="empty">{$t('summary.empty')}</p>
    <a class="cta" href="#/play">{$t('summary.playNow')}</a>
  {:else}
    {@const s = $lastSummary}
    {@const regionKey = s.regionFilter?.subregion ?? s.regionFilter?.region ?? null}
    <p class="meta">
      {$t(MODE_LABEL[s.mode] ?? s.mode)} · {$t(`sessionType.${s.type}`)}{regionKey
        ? ` · ${$localizedRegion(regionKey)}`
        : ''}
    </p>

    <div class="stats">
      <div class="stat">
        <span class="value">{s.correct}/{s.total}</span>
        <span class="label">{$t('summary.score')}</span>
      </div>
      <div class="stat">
        <span class="value">{formatPercent(s.accuracy)}</span>
        <span class="label">{$t('summary.accuracy')}</span>
      </div>
      <div class="stat">
        <span class="value">{formatDuration(s.durationMs)}</span>
        <span class="label">{$t('summary.time')}</span>
      </div>
      <div class="stat">
        <span class="value">{s.bestStreak}</span>
        <span class="label">{$t('summary.bestStreak')}</span>
      </div>
    </div>

    <div class="missed">
      {#if s.missed.length === 0}
        <p class="perfect">{$t('summary.noneMissed')}</p>
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

    <div class="actions">
      <button type="button" class="primary" onclick={retry}>{$t('summary.retry')}</button>
      <button
        type="button"
        class="secondary"
        onclick={trainMissed}
        disabled={s.missed.length === 0}
        title={s.missed.length === 0 ? $t('summary.trainNone') : $t('summary.trainThese')}
      >
        {$t('summary.train')}
      </button>
      <button type="button" class="ghost" onclick={newGame}>{$t('summary.newGame')}</button>
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

  .cta {
    align-self: flex-start;
    padding: 0.6rem 1.2rem;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border-radius: var(--radius);
    font-weight: 600;
  }

  .cta:hover {
    text-decoration: none;
    filter: brightness(1.05);
  }

  .meta {
    margin: -0.5rem 0 0;
    color: var(--color-muted);
    font-weight: 600;
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
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  .stat .value {
    font-size: 1.5rem;
    font-weight: 700;
  }

  .stat .label {
    font-size: 0.8rem;
    color: var(--color-muted);
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
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
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
    padding: 0.55rem 1.3rem;
    border-radius: var(--radius);
    font-weight: 700;
    border: 1px solid transparent;
  }

  .primary {
    background: var(--color-accent);
    color: var(--color-accent-contrast);
  }

  .primary:hover {
    filter: brightness(1.05);
  }

  .secondary {
    background: var(--color-surface);
    border-color: var(--color-border);
    color: var(--color-text);
  }

  .secondary:hover:not(:disabled) {
    border-color: var(--color-accent);
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

  @media (max-width: 560px) {
    .stats {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
