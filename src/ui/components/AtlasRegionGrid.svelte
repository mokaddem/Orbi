<script lang="ts">
  import { getCountry, getRegionTree, type CountryFeature } from '../../data';
  import { t, localizedRegion } from '../../i18n';
  import { projectWorld } from './atlas-map';

  // The Atlas index region grid (Option 3): one card per region, each a real
  // Natural-Earth world map with that region's members highlighted. The world geometry
  // is projected and rendered ONCE into <defs>, then instanced per card via <use>; each
  // card recolors just its own region through per-region CSS custom properties, so five
  // cards cost one set of paths rather than five.
  let { features }: { features: Map<string, CountryFeature> } = $props();

  const WIDTH = 980;
  const HEIGHT = 500;

  const rendered = $derived(
    projectWorld(features, WIDTH, HEIGHT).map((c) => ({
      ...c,
      region: getCountry(c.iso2)?.region ?? 'none',
    })),
  );

  const regions = $derived(
    getRegionTree().map((r) => ({ region: r.region, count: r.countries.length })),
  );
</script>

<!-- Projected world, defined once and referenced by every card below. -->
<svg class="defs" width="0" height="0" aria-hidden="true" focusable="false">
  <defs>
    <g id="atlas-world">
      {#each rendered as c (c.iso2)}
        <path
          d={c.d}
          stroke-width="0.6"
          vector-effect="non-scaling-stroke"
          stroke-linejoin="round"
          style="fill:var(--f-{c.region});stroke:var(--s-{c.region})"
        />
      {/each}
    </g>
  </defs>
</svg>

<ul class="grid">
  {#each regions as r (r.region)}
    <li>
      <a class="rcard" data-hl={r.region} href="#/atlas/region/{encodeURIComponent(r.region)}">
        <span class="maparea">
          <svg class="wm" viewBox="0 0 {WIDTH} {HEIGHT}" aria-hidden="true">
            <use href="#atlas-world" />
          </svg>
        </span>
        <span class="label">
          <span class="nm">{$localizedRegion(r.region)}</span>
          <span class="ct">{$t('atlas.countryCount', { count: r.count })}</span>
        </span>
      </a>
    </li>
  {/each}
</ul>

<style>
  .defs {
    position: absolute;
    width: 0;
    height: 0;
  }

  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 0.75rem;
  }

  .rcard {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.6rem 0.6rem 0.7rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
    color: var(--color-text);
  }

  .rcard:hover {
    text-decoration: none;
    box-shadow: var(--ring-selected);
    border-color: var(--color-accent);
  }

  .maparea {
    display: block;
    height: 96px;
    border-radius: 11px;
    overflow: hidden;
    background: var(--map-water);
  }

  .wm {
    display: block;
    width: 100%;
    height: 100%;
    /* Defaults: every region reads as plain land; the active card overrides its own. */
    --f-none: var(--map-land);
    --f-Africa: var(--map-land);
    --f-Americas: var(--map-land);
    --f-Asia: var(--map-land);
    --f-Europe: var(--map-land);
    --f-Oceania: var(--map-land);
    --s-none: var(--map-border);
    --s-Africa: var(--map-border);
    --s-Americas: var(--map-border);
    --s-Asia: var(--map-border);
    --s-Europe: var(--map-border);
    --s-Oceania: var(--map-border);
  }

  .rcard[data-hl='Africa'] .wm {
    --f-Africa: var(--map-highlight);
    --s-Africa: var(--map-highlight-line);
  }
  .rcard[data-hl='Americas'] .wm {
    --f-Americas: var(--map-highlight);
    --s-Americas: var(--map-highlight-line);
  }
  .rcard[data-hl='Asia'] .wm {
    --f-Asia: var(--map-highlight);
    --s-Asia: var(--map-highlight-line);
  }
  .rcard[data-hl='Europe'] .wm {
    --f-Europe: var(--map-highlight);
    --s-Europe: var(--map-highlight-line);
  }
  .rcard[data-hl='Oceania'] .wm {
    --f-Oceania: var(--map-highlight);
    --s-Oceania: var(--map-highlight-line);
  }

  .label {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.1rem;
  }

  .nm {
    font-weight: 700;
  }

  .ct {
    font-size: 0.8rem;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }
</style>
