<script lang="ts">
  import { onMount } from 'svelte';
  import { t, localizedName, localizedRegion } from '../../i18n';
  import {
    getRegionTree,
    loadCountryFeatures,
    type CountryFeature,
    type RegionNode,
  } from '../../data';
  import Flag from '../components/Flag.svelte';
  import AtlasMap from '../components/AtlasMap.svelte';

  // Region detail page: the region's map (members highlighted, in world context), plus
  // its member countries grouped by sub-region. Read-only over the bundled dataset.
  let { params = {} }: { params?: { region?: string } } = $props();

  const tree = getRegionTree();
  const region = $derived(decodeURIComponent(params.region ?? ''));
  const node = $derived<RegionNode | null>(tree.find((r) => r.region === region) ?? null);

  let features = $state<Map<string, CountryFeature> | null>(null);
  let mapFailed = $state(false);

  onMount(async () => {
    try {
      features = await loadCountryFeatures();
    } catch {
      mapFailed = true;
    }
  });
</script>

{#if !node}
  <section class="notfound">
    <h1>{$t('atlas.regionNotFound')}</h1>
    <a href="#/atlas">{$t('atlas.backToAtlas')}</a>
  </section>
{:else}
  <section class="region">
    <nav class="crumbs">
      <a href="#/atlas">{$t('atlas.title')}</a>
      <span aria-hidden="true">›</span>
      <span>{$localizedRegion(node.region)}</span>
    </nav>

    <header class="head">
      <h1>{$localizedRegion(node.region)}</h1>
      <p class="count">{$t('atlas.countryCount', { count: node.countries.length })}</p>
    </header>

    {#if features}
      <AtlasMap
        {features}
        highlightRegion={node.region}
        label={$t('atlas.mapLabel', { region: $localizedRegion(node.region) })}
      />
    {:else}
      <p class="map-status" role="status">
        {mapFailed ? $t('play.map.error') : $t('play.map.loading')}
      </p>
    {/if}

    {#each node.subregions as sub (sub.subregion)}
      <section class="subregion" aria-label={$localizedRegion(sub.subregion)}>
        <h2>
          <span>{$localizedRegion(sub.subregion)}</span>
          <span class="ct">{$t('atlas.countryCount', { count: sub.countries.length })}</span>
        </h2>
        <ul class="countries">
          {#each sub.countries as country (country.iso2)}
            <li>
              <a class="country" href="#/atlas/country/{country.iso2}">
                <span class="flag"><Flag {country} /></span>
                <span class="name">{$localizedName(country)}</span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </section>
{/if}

<style>
  .region {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .crumbs {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.9rem;
    color: var(--color-muted);
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  h1 {
    margin: 0;
  }

  .count {
    margin: 0;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  .map-status {
    margin: 0;
    padding: 2rem;
    text-align: center;
    color: var(--color-muted);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
  }

  .subregion {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .subregion h2 {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    margin: 0;
    font-size: 1.1rem;
  }

  .subregion .ct {
    font-size: 0.8rem;
    font-weight: 400;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
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

  .notfound {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-start;
  }
</style>
