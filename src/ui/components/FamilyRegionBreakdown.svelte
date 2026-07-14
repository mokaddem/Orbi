<script lang="ts">
  import { t, localizedRegion } from '../../i18n';
  import { FAMILIES, type MasteryFamily, type RegionFamilyMastery } from '../../domain';
  import Icon from './Icon.svelte';
  import RegionIcon from './RegionIcon.svelte';

  // Per-region combined-mastery breakdown (Phase 41). Two layouts (owner pick, OQ4):
  //  • 'stacked' (Progress) — three mini-bars (Map / Flags / Capitals) per region, all visible.
  //  • 'toggle'  (Home)     — one bar per region + an Overall/Map/Flags/Capitals lens toggle.
  // Rows arrive pre-ordered least-complete first (from `computeFamilyMastery`), so this stays
  // presentational.
  //
  // `onPractise` (stacked only) turns each not-fully-mastered family mini-bar into a "practise"
  // shortcut: tapping it drills that region×family's unmastered countries (owner-chosen scope).
  let {
    regions,
    variant = 'stacked',
    onPractise,
  }: {
    regions: RegionFamilyMastery[];
    variant?: 'stacked' | 'toggle';
    onPractise?: (region: string, family: MasteryFamily) => void;
  } = $props();

  type Lens = 'overall' | MasteryFamily;
  let lens = $state<Lens>('overall');
  const LENSES: Lens[] = ['overall', ...FAMILIES.map((f) => f.key)];

  const pct = (mastered: number, total: number): number =>
    total === 0 ? 0 : Math.round((mastered / total) * 100);
  const blendedPct = (r: RegionFamilyMastery): number => Math.round(r.blended * 100);
  const famTally = (r: RegionFamilyMastery, key: MasteryFamily) =>
    r.families.find((f) => f.family === key)!;
  const cellsOf = (r: RegionFamilyMastery): number => r.families.reduce((s, f) => s + f.total, 0);
  const sumBy = (r: RegionFamilyMastery, k: 'mastered' | 'learning'): number =>
    r.families.reduce((s, f) => s + f[k], 0);
  const lensPct = (r: RegionFamilyMastery): number =>
    lens === 'overall' ? blendedPct(r) : pct(famTally(r, lens).mastered, famTally(r, lens).total);
  // The lighter "learning" band (in-progress but not mastered) trailing the mastered fill.
  const lensLearnPct = (r: RegionFamilyMastery): number =>
    lens === 'overall'
      ? pct(sumBy(r, 'learning'), cellsOf(r))
      : pct(famTally(r, lens).learning, famTally(r, lens).total);
  const lensLabel = (l: Lens): string =>
    l === 'overall' ? $t('progress.mastery.overall') : $t(`modes.group.${l}`);
  // Shared label for the practise shortcut's tooltip (title) and screen-reader name (aria-label).
  const practiseLabel = (family: MasteryFamily, region: string): string =>
    $t('progress.mastery.practise', {
      family: $t(`modes.group.${family}`),
      region: $localizedRegion(region),
    });
</script>

{#if variant === 'toggle'}
  <div class="toggle" role="group" aria-label={$t('progress.mastery.regionsTitle')}>
    {#each LENSES as l (l)}
      <button
        type="button"
        class="lens fam-{l}"
        aria-pressed={lens === l}
        onclick={() => (lens = l)}>{lensLabel(l)}</button
      >
    {/each}
  </div>
{/if}

{#if variant === 'stacked'}
  <!-- Visible state key (mobile-friendly): the solid "mastered" vs striped "learning" band is
       otherwise explained only by title tooltips, which never appear on touch devices. Mirrors
       the key inside FamilyMasteryMeter so the whole mastery section reads consistently. -->
  <div class="key">
    <span class="key-item"
      ><span class="sw sw-mastered"></span>{$t('progress.mastery.mastered')}</span
    >
    <span class="key-item"
      ><span class="sw sw-learning"></span>{$t('progress.mastery.learning')}</span
    >
  </div>
{/if}

<ul class="regions" data-testid="family-region-mastery">
  {#each regions as r (r.region)}
    <li>
      <span class="icon" aria-hidden="true"><RegionIcon region={r.region} /></span>
      <div class="body">
        <div class="line">
          <span class="name">{$localizedRegion(r.region)}</span>
          <span class="count">
            {#if variant === 'toggle' && lens !== 'overall'}
              <!-- On a family lens the bar shows that family's %; pair it with that family's
                   mastered/total so the number matches the bar, not the blended total. -->
              {$t('progress.mastery.regionCount', {
                mastered: famTally(r, lens).mastered,
                total: famTally(r, lens).total,
              })}
            {:else}
              {$t('progress.mastery.regionSummary', {
                pct: blendedPct(r),
                fully: r.fullyMastered,
                total: r.total,
              })}
            {/if}
          </span>
        </div>

        {#if variant === 'stacked'}
          <div class="minis">
            {#each FAMILIES as f (f.key)}
              {@const fam = famTally(r, f.key)}
              {@const p = pct(fam.mastered, fam.total)}
              {@const lp = pct(fam.learning, fam.total)}
              <div class="mini">
                <span class="tag">{$t(`modes.group.${f.key}`)}</span>
                <span class="mtrack">
                  <span
                    class="mfill fam-{f.key}"
                    style="width:{p}%"
                    title={$t('progress.mastery.mastered')}
                  ></span>
                  <span
                    class="mfill learn-{f.key}"
                    style="width:{lp}%"
                    title={$t('progress.mastery.learning')}
                  ></span>
                </span>
                <span class="mpct">{p}%</span>
                {#if onPractise && fam.mastered < fam.total}
                  {@const label = practiseLabel(f.key, r.region)}
                  <button
                    type="button"
                    class="practise"
                    aria-label={label}
                    title={label}
                    onclick={() => onPractise(r.region, f.key)}
                  >
                    <Icon name="target" size={15} />
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          {@const p = lensPct(r)}
          <div
            class="track"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={p}
            aria-label="{$localizedRegion(r.region)} — {lensLabel(lens)}"
          >
            <span class="fill fam-{lens}" style="width:{p}%" title={$t('progress.mastery.mastered')}
            ></span>
            <span
              class="fill learn-{lens}"
              style="width:{lensLearnPct(r)}%"
              title={$t('progress.mastery.learning')}
            ></span>
          </div>
        {/if}
      </div>
    </li>
  {/each}
</ul>

<style>
  .regions {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .regions li {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .icon {
    flex: 0 0 auto;
    width: 2rem;
    height: 2rem;
    display: grid;
    place-items: center;
    color: var(--color-accent);
    margin-top: 0.1rem;
  }

  .body {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
  }

  .line {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .name {
    font-weight: 700;
  }

  .count {
    font-size: 0.82rem;
    color: var(--color-muted);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  /* Visible state key (Progress / stacked): names the solid "mastered" vs striped "learning" bar
     segments so the encoding is legible on touch, where the title tooltip never shows. */
  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 0.85rem;
    margin-bottom: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-muted);
  }

  .key-item {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .sw {
    width: 0.85rem;
    height: 0.62rem;
    border-radius: 3px;
    border: 1px solid var(--color-border);
  }

  .sw-mastered {
    background: var(--color-accent);
  }

  .sw-learning {
    background-image: repeating-linear-gradient(
      45deg,
      var(--color-accent) 0 2px,
      var(--color-accent-weak) 2px 6px
    );
    opacity: 0.72;
  }

  /* Family palette shared by both variants. */
  .fam-map {
    background: var(--color-accent);
  }
  .fam-flags {
    background: var(--color-coral);
  }
  .fam-capitals {
    background: var(--color-sun);
  }
  .fam-overall {
    background: var(--color-accent);
  }
  /* Diagonal stripes in the family hue mark the trailing "learning" (in-progress) band —
     textured + higher-contrast than a flat tint against the pale track. */
  .learn-map,
  .learn-overall {
    background-image: repeating-linear-gradient(
      45deg,
      var(--color-accent) 0 2px,
      var(--color-accent-weak) 2px 6px
    );
  }
  .learn-flags {
    background-image: repeating-linear-gradient(
      45deg,
      var(--color-coral) 0 2px,
      var(--color-coral-weak) 2px 6px
    );
  }
  .learn-capitals {
    background-image: repeating-linear-gradient(
      45deg,
      var(--color-sun) 0 2px,
      var(--color-sun-weak) 2px 6px
    );
  }
  /* Slightly dimmed so "learning" reads below the solid "mastered" fill. */
  .learn-map,
  .learn-flags,
  .learn-capitals,
  .learn-overall {
    opacity: 0.72;
  }

  /* Stacked mini-bars (Progress, Option A). */
  .minis {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .mini {
    display: grid;
    /* tag · track · % · practise-shortcut (the last column stays reserved even when a family is
       fully mastered and its button is absent, so the % column never shifts between rows). */
    grid-template-columns: 4.2rem 1fr 2.4rem 1.6rem;
    align-items: center;
    gap: 0.5rem;
  }

  /* Per-family "practise this region's unmastered countries" shortcut (Phase 41 follow-on).
     Icon-only + muted so it stays secondary to the bar; grows to accent on hover/focus. */
  .practise {
    appearance: none;
    display: grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 999px;
    background: transparent;
    color: var(--color-muted);
    cursor: pointer;
    transition:
      background 0.12s ease,
      border-color 0.12s ease,
      color 0.12s ease;
  }

  .practise:hover {
    background: var(--color-accent-weak);
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .practise:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .practise {
      transition: none;
    }
  }

  .tag {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--color-muted);
  }

  .mtrack {
    display: flex;
    height: 0.4rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    overflow: hidden;
  }

  .mfill {
    display: block;
    height: 100%;
  }

  .mpct {
    font-size: 0.72rem;
    color: var(--color-muted);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  /* Family toggle (Home, Option B). */
  .toggle {
    display: flex;
    flex-wrap: wrap;
    gap: 0.15rem;
    padding: 0.2rem;
    margin-bottom: 0.6rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 999px;
  }

  .lens {
    appearance: none;
    border: 0;
    background: transparent;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--color-muted);
    padding: 0.28rem 0.7rem;
    border-radius: 999px;
    cursor: pointer;
    transition:
      background 0.14s ease,
      color 0.14s ease;
  }

  .lens[aria-pressed='true'] {
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: var(--shadow-card);
  }

  .lens:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .track {
    display: flex;
    height: 0.55rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    overflow: hidden;
  }

  .fill {
    display: block;
    height: 100%;
    transition: width 0.35s ease;
  }

  @media (prefers-reduced-motion: reduce) {
    .lens,
    .fill {
      transition: none;
    }
  }
</style>
