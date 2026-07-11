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

    <div class="country-cols">
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

      <div class="country-aside">
        {#if country.industries.some((ind) => ind.fact)}
          <!-- Phase 32: the industries mode's "why" fun facts also surface here, per the
           "Atlas reflects country data" convention — one line per fact-bearing industry. -->
          <section class="did-you-know" aria-labelledby="dyk-heading">
            <h2 id="dyk-heading">
              <Icon name="sparkles" size={16} />
              {$t('play.feedback.didYouKnow')}
            </h2>
            <ul>
              {#each country.industries.filter((ind) => ind.fact) as ind (ind.key)}
                <li>
                  <span class="topic">{$localizedText(ind.name)}</span>
                  <span>{$localizedText(ind.fact!)}</span>
                </li>
              {/each}
            </ul>
          </section>
        {/if}

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
      </div>
    </div>
  </section>
{/if}

<style>
  .country {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  /* Desktop (Phase 34): flag + facts on the left, "Did you know?" + locator map on the
     right. On mobile everything stacks in one column. */
  .country-cols,
  .country-aside {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  @media (min-width: 860px) {
    .country-cols {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      align-items: start;
    }

    .card {
      /* Stack flag above facts inside the narrower left column so neither is squeezed. */
      align-items: flex-start;
    }
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

  .did-you-know {
    padding: 1.25rem 1.5rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .did-you-know h2 {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    margin: 0 0 0.85rem;
    font-size: 1.15rem;
  }

  .did-you-know h2 :global(.icon) {
    color: var(--color-accent);
  }

  .did-you-know ul {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .did-you-know li {
    padding-left: 0.85rem;
    border-left: 3px solid var(--color-accent-weak);
    line-height: 1.45;
  }

  .did-you-know .topic {
    font-weight: 700;
    color: var(--color-accent-strong);
    margin-right: 0.3rem;
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
