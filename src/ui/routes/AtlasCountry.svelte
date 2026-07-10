<script lang="ts">
  import { onMount } from 'svelte';
  import { t, localizedName, localizedText, localizedRegion } from '../../i18n';
  import { getCountry, loadCountryFeatures, type CountryFeature } from '../../data';
  import Flag from '../components/Flag.svelte';
  import Icon from '../components/Icon.svelte';
  import AtlasMap from '../components/AtlasMap.svelte';

  // Country detail page: the flag, the localized name, its capital / languages / industries,
  // and the region / sub-region it belongs to (both linking back to the region page). A small
  // locator map — the country picked out, its region tinted for context — loads its geometry
  // lazily on mount, so the page stays light until then and never blocks on the TopoJSON chunk.
  let { params = {} }: { params?: { iso2?: string } } = $props();

  const country = $derived(getCountry((params.iso2 ?? '').toUpperCase()));

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

{#if !country}
  <section class="notfound">
    <h1>{$t('atlas.countryNotFound')}</h1>
    <a href="#/atlas">{$t('atlas.backToAtlas')}</a>
  </section>
{:else}
  <section class="country">
    <nav class="crumbs">
      <a href="#/atlas">{$t('atlas.title')}</a>
      <span aria-hidden="true">›</span>
      <a href="#/atlas/region/{encodeURIComponent(country.region)}">
        {$localizedRegion(country.region)}
      </a>
      <span aria-hidden="true">›</span>
      <span>{$localizedName(country)}</span>
    </nav>

    <div class="card">
      <div class="flag">
        <Flag {country} alt={$localizedName(country)} />
      </div>
      <div class="facts">
        <h1>{$localizedName(country)}</h1>
        <dl>
          <div class="fact">
            <dt><Icon name="landmark" size={13} /> {$t('atlas.capitalLabel')}</dt>
            <dd>{$localizedText(country.capital)}</dd>
          </div>
          <div class="fact">
            <dt><Icon name="languages" size={13} /> {$t('atlas.languagesLabel')}</dt>
            <dd>{country.languages.map((lang) => $localizedText(lang.name)).join(', ')}</dd>
          </div>
          {#if country.industries.length}
            <div class="fact">
              <dt><Icon name="factory" size={13} /> {$t('atlas.industriesLabel')}</dt>
              <dd>{country.industries.map((ind) => $localizedText(ind.name)).join(', ')}</dd>
            </div>
          {/if}
          <div class="fact">
            <dt><Icon name="globe" size={13} /> {$t('atlas.regionLabel')}</dt>
            <dd>
              <a href="#/atlas/region/{encodeURIComponent(country.region)}">
                {$localizedRegion(country.region)}
              </a>
            </dd>
          </div>
          <div class="fact">
            <dt><Icon name="map" size={13} /> {$t('atlas.subregionLabel')}</dt>
            <dd>
              <a href="#/atlas/region/{encodeURIComponent(country.region)}">
                {$localizedRegion(country.subregion)}
              </a>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    {#if features}
      <AtlasMap
        {features}
        highlightCountry={country.iso2}
        label={$t('atlas.countryMapLabel', { country: $localizedName(country) })}
      />
    {:else}
      <p class="map-status" role="status">
        {mapFailed ? $t('play.map.error') : $t('play.map.loading')}
      </p>
    {/if}
  </section>
{/if}

<style>
  .country {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .crumbs {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.4rem;
    font-size: 0.9rem;
    color: var(--color-muted);
  }

  .card {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    align-items: center;
    padding: 1.5rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .flag {
    width: min(260px, 60vw);
    flex: none;
  }

  .facts {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 12rem;
  }

  h1 {
    margin: 0;
  }

  dl {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .fact {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  dt {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-muted);
  }

  dt :global(.icon) {
    color: var(--color-accent);
  }

  dd {
    margin: 0;
    font-weight: 700;
    font-size: 1.1rem;
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

  .notfound {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-start;
  }
</style>
