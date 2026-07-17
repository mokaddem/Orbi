<script lang="ts">
  import { get } from 'svelte/store';
  import { push } from 'svelte-spa-router';
  import { t, localizedName, localizedText, localizedRegion } from '../../i18n';
  import { masteryFamilyOf, type GameMode } from '../../domain';
  import { getCountry, loadCountryFeatures, type Country, type CountryFeature } from '../../data';
  import {
    pendingReview,
    pendingConfig,
    reviewSelectionToConfig,
    type ReviewSelection,
  } from '../stores/game';
  import { prefs, storageReady, loadRegionReviews } from '../stores/persistence';
  import Flag from '../components/Flag.svelte';
  import Icon from '../components/Icon.svelte';
  import ModeIcon from '../components/ModeIcon.svelte';
  import RegionIcon from '../components/RegionIcon.svelte';
  import AtlasMap from '../components/AtlasMap.svelte';
  import Mascot from '../components/Mascot.svelte';

  // "Ready to review?" — the study-card screen shown between a "time to review" tap and the game
  // (Phase 48). It revises the countries a review covers, by the review's mode: flags show the
  // flag, capitals show the capital, map modes show a per-country locator. "Start review" then
  // hands the *identical* training run to the Play route (via `reviewSelectionToConfig`), so the
  // game is unchanged — the entry just gained a revise-then-test step.

  // Precise per-mode label (matches the Play / Practice mode list).
  const MODE_LABEL_KEY: Record<GameMode, string> = {
    'flag-to-country': 'modes.flagToCountry',
    'country-to-flag': 'modes.countryToFlag',
    'map-highlight': 'modes.mapHighlight',
    'map-locate': 'modes.mapLocate',
    'capital-to-country': 'modes.capitalToCountry',
    'country-to-capital': 'modes.countryToCapital',
    'country-to-languages': 'modes.countryToLanguages',
    'country-to-industry': 'modes.mainIndustries',
  };

  // The staged selection (from Home/Summary). `null` on a cold deep-link/refresh → re-derived below.
  let selection = $state<ReviewSelection | null>(get(pendingReview));
  // Only the cold-load (nothing staged) path shows a loading state while it re-derives.
  let loading = $state(get(pendingReview) === null);
  let features = $state<Map<string, CountryFeature> | null>(null);
  let rederived = false;
  let featuresRequested = false;

  // Which revision style to render: 'map' | 'flags' | 'capitals' (every review mode maps to one).
  const family = $derived(selection ? masteryFamilyOf(selection.mode) : null);

  // The covered countries, weakest-first (the order `iso2s` already carries).
  const countries = $derived<Country[]>(
    selection ? selection.iso2s.map((iso) => getCountry(iso)).filter((c): c is Country => !!c) : [],
  );

  // Cold load (deep-link / refresh) with nothing staged: re-derive the most-urgent region review
  // once storage is ready (OQ5), so the screen still works — else it falls to the empty state.
  $effect(() => {
    if (selection || rederived || !$storageReady) return;
    rederived = true;
    void loadRegionReviews()
      .then((reviews) => {
        if (reviews.length) {
          const top = reviews[0];
          selection = { mode: top.mode, region: top.region, iso2s: top.iso2s };
        }
      })
      .finally(() => (loading = false));
  });

  // Map-mode reviews need country geometry for the per-country locator maps (lazy, once).
  $effect(() => {
    if (!selection || family !== 'map' || featuresRequested) return;
    featuresRequested = true;
    void loadCountryFeatures()
      .then((f) => (features = f))
      .catch(() => {
        /* locator maps degrade to a name-only row */
      });
  });

  function startReview(): void {
    if (!selection) return;
    pendingConfig.set(reviewSelectionToConfig(selection, $prefs));
    pendingReview.set(null);
    push('/play');
  }

  function goBack(): void {
    pendingReview.set(null);
    if (typeof window !== 'undefined' && window.history.length > 1) window.history.back();
    else push('/');
  }
</script>

{#if loading}
  <section class="review-preview" aria-busy="true">
    <p class="status">{$t('reviewPreview.loading')}</p>
  </section>
{:else if !selection || countries.length === 0}
  <section class="review-preview empty">
    <Mascot pose="encouraging" size={96} />
    <h1>{$t('reviewPreview.empty.title')}</h1>
    <p class="lead">{$t('reviewPreview.empty.body')}</p>
    <a class="start" href="#/">{$t('reviewPreview.empty.home')}</a>
  </section>
{:else}
  <section class="review-preview">
    <header class="head">
      <h1>{$t('reviewPreview.title')}</h1>
      <div class="scope">
        <span class="chip">
          <span class="chip-ico" aria-hidden="true"><ModeIcon mode={selection.mode} /></span>
          {$t(MODE_LABEL_KEY[selection.mode])}
        </span>
        <span class="chip">
          <span class="chip-ico" aria-hidden="true">
            {#if selection.region}<RegionIcon region={selection.region} />{:else}<Icon
                name="globe"
                size={16}
              />{/if}
          </span>
          {selection.region ? $localizedRegion(selection.region) : $t('reviewPreview.everywhere')}
        </span>
        <span class="chip count">{$t('reviewPreview.count', { count: countries.length })}</span>
      </div>
      <p class="lead">{$t('reviewPreview.subtitle')}</p>
    </header>

    <ul class="study {family}" aria-label={$t('reviewPreview.listLabel')}>
      {#each countries as c (c.iso2)}
        <li class="card">
          {#if family === 'flags'}
            <span class="s-flag"><Flag country={c} alt={$localizedName(c)} /></span>
            <span class="s-name">{$localizedName(c)}</span>
          {:else if family === 'capitals'}
            <span class="s-name">{$localizedName(c)}</span>
            <span class="s-capital">
              <Icon name="landmark" size={13} />
              {$localizedText(c.capital)}
            </span>
          {:else}
            <span class="s-loc">
              {#if features}
                <AtlasMap {features} highlightCountry={c.iso2} label={$localizedName(c)} />
              {:else}
                <span class="s-loc-skeleton" aria-hidden="true"></span>
              {/if}
            </span>
            <span class="s-name">{$localizedName(c)}</span>
          {/if}
        </li>
      {/each}
    </ul>

    <div class="actions">
      <button type="button" class="secondary" onclick={goBack}>{$t('reviewPreview.back')}</button>
      <button type="button" class="start" onclick={startReview}>{$t('reviewPreview.start')}</button>
    </div>
  </section>
{/if}

<style>
  .review-preview {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .status {
    color: var(--color-muted);
  }

  /* Empty state (cold load with nothing due) */
  .review-preview.empty {
    align-items: center;
    text-align: center;
    gap: 0.75rem;
    padding: 2rem 1rem;
  }

  .head h1 {
    margin: 0 0 0.6rem;
  }

  .scope {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.7rem;
    background: var(--color-accent-weak);
    border: 1px solid var(--color-accent);
    border-radius: 999px;
    color: var(--color-accent-strong);
    font-size: 0.85rem;
    font-weight: 700;
  }

  .chip.count {
    background: var(--color-surface);
    border-color: var(--color-border);
    color: var(--color-muted);
  }

  .chip-ico {
    display: inline-flex;
    width: 1rem;
    height: 1rem;
  }

  .chip-ico :global(.mode-icon) {
    width: 1rem;
    height: 1rem;
  }

  .lead {
    margin: 0.6rem 0 0;
    color: var(--color-muted);
  }

  /* The study grid: cards sized per family (locator maps and flags are compact tiles; capitals
     get a wider row for the name + capital text). */
  .study {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.6rem;
    grid-template-columns: repeat(auto-fill, minmax(var(--card-min, 150px), 1fr));
  }

  .study.capitals {
    --card-min: 200px;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.6rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
    min-width: 0;
  }

  .s-name {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Flags: the flag on top, name below. */
  .study.flags .card {
    align-items: center;
    text-align: center;
  }

  .s-flag {
    width: 100%;
    max-width: 6rem;
    display: block;
  }

  .s-flag :global(.flag) {
    border-radius: 4px;
    box-shadow: 0 0 0 1px var(--color-border);
  }

  /* Capitals: name, then the capital city under a small landmark glyph. */
  .s-capital {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--color-accent-strong);
    font-weight: 600;
    font-size: 0.95rem;
  }

  /* Map: a per-country locator map tile, name below. */
  .s-loc {
    width: 100%;
    display: block;
  }

  .s-loc-skeleton {
    display: block;
    width: 100%;
    aspect-ratio: 980 / 500;
    background: var(--map-water);
    border: 2px solid var(--map-border);
    border-radius: var(--radius);
  }

  .actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    justify-content: flex-end;
    position: sticky;
    bottom: 0;
    padding: 0.5rem 0;
    background: linear-gradient(to top, var(--color-bg) 60%, transparent);
  }

  .start {
    padding: 0.7rem 1.8rem;
    background: var(--color-accent);
    color: var(--color-accent-contrast);
    border: 0;
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

  .secondary {
    padding: 0.7rem 1.3rem;
    background: var(--color-surface);
    color: var(--color-text);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    font-weight: 700;
  }

  .secondary:hover {
    border-color: var(--color-accent);
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
