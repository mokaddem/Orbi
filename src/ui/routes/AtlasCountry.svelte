<script lang="ts">
  import { t, localizedName, localizedText, localizedRegion } from '../../i18n';
  import { getCountry } from '../../data';
  import Flag from '../components/Flag.svelte';

  // Country detail page: the flag, the localized name, its capital, and the region /
  // sub-region it belongs to (both linking back to the region page). Read-only; no map load
  // here, so reaching a country page never pulls in the geometry chunk.
  let { params = {} }: { params?: { iso2?: string } } = $props();

  const country = $derived(getCountry((params.iso2 ?? '').toUpperCase()));
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
            <dt>{$t('atlas.capitalLabel')}</dt>
            <dd>{$localizedText(country.capital)}</dd>
          </div>
          <div class="fact">
            <dt>{$t('atlas.languagesLabel')}</dt>
            <dd>{country.languages.map((lang) => $localizedText(lang.name)).join(', ')}</dd>
          </div>
          {#if country.industries.length}
            <div class="fact">
              <dt>{$t('atlas.industriesLabel')}</dt>
              <dd>{country.industries.map((ind) => $localizedText(ind.name)).join(', ')}</dd>
            </div>
          {/if}
          <div class="fact">
            <dt>{$t('atlas.regionLabel')}</dt>
            <dd>
              <a href="#/atlas/region/{encodeURIComponent(country.region)}">
                {$localizedRegion(country.region)}
              </a>
            </dd>
          </div>
          <div class="fact">
            <dt>{$t('atlas.subregionLabel')}</dt>
            <dd>
              <a href="#/atlas/region/{encodeURIComponent(country.region)}">
                {$localizedRegion(country.subregion)}
              </a>
            </dd>
          </div>
        </dl>
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
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-muted);
  }

  dd {
    margin: 0;
    font-weight: 700;
    font-size: 1.1rem;
  }

  .notfound {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: flex-start;
  }
</style>
