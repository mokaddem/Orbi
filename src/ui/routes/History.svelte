<script lang="ts">
  import { t, locale, localizedName, localizedRegion } from '../../i18n';
  import { computeStats, type StatsOverview } from '../../domain';
  import { getCountry, type SessionRecord } from '../../data';
  import { formatPercent } from '../format';
  import { loadSessions, clearHistory, persistent, storageReady } from '../stores/persistence';
  import Flag from '../components/Flag.svelte';
  import MascotScene from '../components/MascotScene.svelte';
  import PageHero from '../components/PageHero.svelte';
  import ModeIcon from '../components/ModeIcon.svelte';
  import RegionIcon from '../components/RegionIcon.svelte';

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

  /** Cap the timeline so many play-days stay legible; a note flags any truncation. */
  const CHART_DAYS = 21;
  /** Most-recent sessions to list. */
  const RECENT = 8;
  /** Most-missed countries to surface. */
  const MISSED_LIMIT = 12;

  let sessions = $state<SessionRecord[]>([]);
  let stats = $state<StatsOverview | null>(null);
  let loading = $state(true);

  async function refresh(): Promise<void> {
    loading = true;
    sessions = await loadSessions();
    stats = computeStats(sessions);
    loading = false;
  }

  // Load once storage is ready (App opens the store asynchronously at startup).
  $effect(() => {
    if ($storageReady) void refresh();
  });

  async function onClear(): Promise<void> {
    if (typeof confirm === 'function' && !confirm($t('history.clearConfirm'))) return;
    await clearHistory();
    await refresh();
  }

  const timeline = $derived(stats ? stats.byDay.slice(-CHART_DAYS) : []);
  const timelineTruncated = $derived((stats?.byDay.length ?? 0) > CHART_DAYS);
  const maxSessions = $derived(Math.max(1, ...timeline.map((d) => d.sessions)));
  const topMissed = $derived(stats ? stats.mostMissed.slice(0, MISSED_LIMIT) : []);
  const recent = $derived([...sessions].reverse().slice(0, RECENT));

  /** `YYYY-MM-DD` → the short `MM-DD` axis tick. */
  function tick(date: string): string {
    return date.slice(5);
  }

  function formatDate(ts: number, loc: string): string {
    return new Date(ts).toLocaleDateString(loc, { month: 'short', day: 'numeric' });
  }
</script>

<section class="history">
  <div class="head">
    <PageHero title={$t('history.title')} pose="relaxed" />
    {#if sessions.length > 0}
      <button type="button" class="clear" onclick={onClear}>{$t('history.clear')}</button>
    {/if}
  </div>

  {#if $storageReady && !$persistent}
    <p class="warning" role="alert">{$t('settings.notPersisted')}</p>
  {/if}

  {#if loading}
    <p class="muted">{$t('history.loading')}</p>
  {:else if !stats || sessions.length === 0}
    <div class="empty-state">
      <MascotScene pose="sleepy" size={116} />
      <p class="muted">{$t('history.empty')}</p>
      <a class="cta" href="#/play">{$t('history.play')}</a>
    </div>
  {:else}
    <!-- Sessions over time: single-series bar chart, so no legend — the title names it. -->
    <div class="panel">
      <h2>{$t('history.timeline.title')}</h2>
      <div class="chart" role="img" aria-label={$t('history.timeline.title')}>
        {#each timeline as d (d.date)}
          <div class="col">
            <span class="bar-value">{d.sessions}</span>
            <div
              class="bar"
              style="height:{(d.sessions / maxSessions) * 100}%"
              title={$t('history.timeline.tooltip', {
                date: d.date,
                count: d.sessions,
                correct: d.correct,
                questions: d.questions,
              })}
            ></div>
            <span class="tick">{tick(d.date)}</span>
          </div>
        {/each}
      </div>
      {#if timelineTruncated}
        <p class="note">{$t('history.timeline.truncated', { days: CHART_DAYS })}</p>
      {/if}
    </div>

    <!-- Most-missed countries -->
    <div class="panel">
      <h2>{$t('history.missed.title')}</h2>
      {#if topMissed.length === 0}
        <p class="muted">{$t('history.missed.none')}</p>
      {:else}
        <ul class="missed-list">
          {#each topMissed as m (m.iso2)}
            {@const country = getCountry(m.iso2)}
            {#if country}
              <li>
                <span class="missed-flag"><Flag {country} alt={$localizedName(country)} /></span>
                <span class="missed-body">
                  <span class="missed-name">{$localizedName(country)}</span>
                  <span class="missed-ratio"
                    >{$t('history.missed.ratio', { misses: m.misses, attempts: m.attempts })}</span
                  >
                </span>
              </li>
            {/if}
          {/each}
        </ul>
      {/if}
    </div>

    <!-- Recent sessions (also the accessible table-style view of the data) -->
    <div class="panel">
      <h2>{$t('history.recent.title')}</h2>
      <ul class="recent-list">
        {#each recent as r (r.id)}
          {@const regionKey = r.regionFilter?.subregion ?? r.regionFilter?.region ?? null}
          <li>
            <span class="recent-mode-ico" aria-hidden="true"><ModeIcon mode={r.mode} /></span>
            <span class="recent-date">{formatDate(r.finishedAt, $locale)}</span>
            <span class="recent-mode">
              {$t(MODE_LABEL[r.mode] ?? r.mode)}
              <small class="recent-sub">
                <span>{$t(`sessionType.${r.type}`)}</span>
                {#if regionKey}
                  <span class="dot" aria-hidden="true">·</span>
                  <span class="recent-region">
                    <span class="recent-region-ico" aria-hidden="true"
                      ><RegionIcon region={r.regionFilter?.region ?? ''} /></span
                    >
                    {$localizedRegion(regionKey)}
                  </span>
                {/if}
              </small>
            </span>
            <span class="recent-score">
              {r.correct}/{r.total}
              <small>{formatPercent(r.total === 0 ? 0 : r.correct / r.total)}</small>
            </span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</section>

<style>
  .history {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .clear {
    padding: 0.4rem 0.9rem;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    color: var(--color-muted);
    font-weight: 600;
  }

  .clear:hover {
    border-color: var(--color-wrong);
    color: var(--color-wrong);
  }

  .muted {
    color: var(--color-muted);
  }

  /* Empty History: the sleepy globe stands in for the blank list, above the message + CTA. */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.7rem;
    padding: 2rem 1rem 1rem;
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

  .warning {
    margin: 0;
    padding: 0.6rem 0.8rem;
    color: var(--color-wrong);
    background: var(--color-wrong-bg);
    border: 1px solid var(--color-wrong);
    border-radius: var(--radius);
    font-size: 0.9rem;
    font-weight: 600;
  }

  /* Panels */
  .panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
  }

  .panel h2 {
    margin: 0;
    font-size: 1.05rem;
  }

  .note {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-muted);
  }

  /* Bar chart */
  .chart {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 160px;
    overflow-x: auto;
    padding-top: 1.2rem; /* room for value labels above the tallest bar */
    border-bottom: 1px solid var(--color-border); /* recessive baseline */
  }

  .col {
    flex: 1 0 22px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
    gap: 0.2rem;
  }

  .bar {
    width: 60%;
    max-width: 26px;
    min-height: 2px;
    background: var(--color-accent);
    border-radius: 4px 4px 0 0; /* rounded data-end, anchored to the baseline */
  }

  .bar-value {
    font-size: 0.7rem;
    color: var(--color-muted);
    line-height: 1;
  }

  .tick {
    font-size: 0.65rem;
    color: var(--color-muted);
    white-space: nowrap;
  }

  /* Most-missed */
  .missed-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.5rem;
  }

  .missed-list li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0.6rem;
    background: var(--color-bg);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
  }

  .missed-flag {
    flex: 0 0 auto;
    width: 36px;
  }

  .missed-body {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .missed-name {
    font-size: 0.9rem;
    font-weight: 600;
  }

  .missed-ratio {
    font-size: 0.78rem;
    color: var(--color-muted);
  }

  /* Recent sessions */
  .recent-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .recent-list li {
    display: grid;
    grid-template-columns: auto auto 1fr auto;
    align-items: center;
    gap: 0.75rem;
    padding: 0.55rem 0.2rem;
  }

  .recent-mode-ico {
    display: inline-flex;
    width: 1.5rem;
    height: 1.5rem;
    color: var(--color-accent);
  }

  .recent-sub {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .recent-sub .dot {
    opacity: 0.6;
  }

  .recent-region {
    display: inline-flex;
    align-items: center;
    gap: 0.28rem;
  }

  .recent-region-ico {
    display: inline-flex;
    width: 1rem;
    height: 1rem;
    color: var(--color-muted);
  }

  .recent-list li + li {
    border-top: 1px solid var(--color-border);
  }

  .recent-date {
    font-size: 0.85rem;
    color: var(--color-muted);
    white-space: nowrap;
  }

  .recent-mode {
    display: flex;
    flex-direction: column;
    font-weight: 600;
    min-width: 0;
  }

  .recent-mode small,
  .recent-score small {
    font-weight: 400;
    color: var(--color-muted);
  }

  .recent-score {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    font-weight: 700;
  }

  @media (prefers-reduced-motion: reduce) {
    .cta {
      transition: none;
    }

    .cta:hover {
      transform: none;
    }
  }
</style>
