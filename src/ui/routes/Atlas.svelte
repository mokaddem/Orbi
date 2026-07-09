<script lang="ts">
  import { onMount } from 'svelte';
  import { t, localizedName } from '../../i18n';
  import { getCountries, loadCountryFeatures, type CountryFeature } from '../../data';
  import Flag from '../components/Flag.svelte';
  import AtlasRegionGrid from '../components/AtlasRegionGrid.svelte';
  import { searchCountries, groupByInitial } from './atlas-search';

  // The Atlas index: browse regions (real-map cards) and every country (A–Z), or search
  // by name across EN/FR/DE. Read-only; all data is bundled. The region cards need the
  // map geometry, so the ~750 KB TopoJSON is loaded once on mount (the country lists and
  // search work immediately, without it).
  const all = getCountries();

  let query = $state('');
  let features = $state<Map<string, CountryFeature> | null>(null);
  let mapFailed = $state(false);

  onMount(async () => {
    try {
      features = await loadCountryFeatures();
    } catch {
      mapFailed = true;
    }
  });

  const searching = $derived(query.trim().length > 0);
  const matches = $derived(searchCountries(all, query));
  // Group the visible set (all when browsing, matches when searching) by initial letter,
  // using the localized name so both the bucket and order track the UI language.
  const groups = $derived(groupByInitial(searching ? matches : all, (c) => $localizedName(c)));
</script>

<section class="atlas">
  <header class="head">
    <h1>{$t('atlas.title')}</h1>
    <p class="intro">{$t('atlas.intro')}</p>
  </header>

  <div class="search">
    <input
      type="search"
      bind:value={query}
      placeholder={$t('atlas.searchPlaceholder')}
      aria-label={$t('atlas.searchLabel')}
      autocomplete="off"
    />
  </div>

  {#if !searching}
    <section class="block" aria-labelledby="atlas-regions">
      <h2 id="atlas-regions">{$t('atlas.regionsTitle')}</h2>
      {#if features}
        <AtlasRegionGrid {features} />
      {:else}
        <p class="map-status" role="status">
          {mapFailed ? $t('play.map.error') : $t('play.map.loading')}
        </p>
      {/if}
    </section>
  {/if}

  <section class="block" aria-labelledby="atlas-countries">
    <h2 id="atlas-countries">
      {searching ? $t('atlas.resultsTitle') : $t('atlas.countriesTitle')}
    </h2>

    {#if searching && matches.length === 0}
      <p class="empty">{$t('atlas.noResults', { query: query.trim() })}</p>
    {:else}
      {#each groups as group (group.letter)}
        <div class="letter-group">
          <h3 class="letter">{group.letter}</h3>
          <ul class="countries">
            {#each group.countries as country (country.iso2)}
              <li>
                <a class="country" href="#/atlas/country/{country.iso2}">
                  <span class="flag"><Flag {country} /></span>
                  <span class="name">{$localizedName(country)}</span>
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    {/if}
  </section>
</section>

<style>
  .atlas {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  h1 {
    margin: 0;
  }

  .intro {
    margin: 0;
    color: var(--color-muted);
  }

  .search input {
    width: 100%;
    padding: 0.65rem 0.9rem;
    font: inherit;
    color: var(--color-text);
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
  }

  .search input:focus-visible {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: var(--ring-selected);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .block h2 {
    margin: 0;
    font-size: 1.15rem;
  }

  .map-status {
    margin: 0;
    padding: 1.5rem;
    text-align: center;
    color: var(--color-muted);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  .empty {
    margin: 0;
    color: var(--color-muted);
  }

  .letter-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .letter {
    margin: 0.5rem 0 0;
    font-size: 0.95rem;
    color: var(--color-accent-strong);
    border-bottom: 1px solid var(--color-border);
    padding-bottom: 0.2rem;
  }

  .countries {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.4rem;
  }

  a.country {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0.5rem;
    border-radius: var(--radius);
    color: var(--color-text);
  }

  a.country:hover {
    text-decoration: none;
    background: var(--color-accent-weak);
  }

  .flag {
    display: block;
    width: 34px;
    flex: none;
  }

  .name {
    font-weight: 600;
    line-height: 1.2;
  }
</style>
