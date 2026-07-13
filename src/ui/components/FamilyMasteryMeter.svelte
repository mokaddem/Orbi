<script lang="ts">
  import { t } from '../../i18n';
  import { FAMILIES, type FamilyMasteryResult } from '../../domain';
  import Icon from './Icon.svelte';

  // Combined per-family world-mastery meter (Phase 41). Replaces the lenient "any one of four
  // modes" headline with a **blended** progress bar across the three families (Map / Flags /
  // Capitals), the honest **"X of N fully mastered"** count, and a per-family breakdown so the
  // player sees which skills they've actually proven. `compact` is the slim Home variant (inside
  // the mastery toggle); the full variant is the titled Progress card. Presentational.
  let {
    mastery,
    compact = false,
  }: {
    mastery: FamilyMasteryResult;
    compact?: boolean;
  } = $props();

  const overall = $derived(mastery.overall);
  const blendedPct = $derived(Math.round(overall.blended * 100));
  // Applicable (country × family) cells — the blended-bar denominator; the per-family segments
  // sum to exactly the blended fill.
  const cells = $derived(overall.families.reduce((sum, f) => sum + f.total, 0));
  const famPct = (mastered: number, total: number): number =>
    total === 0 ? 0 : Math.round((mastered / total) * 100);
  const segments = $derived(
    overall.families.map((f) => ({
      family: f.family,
      pct: famPct(f.mastered, f.total),
      learningPct: famPct(f.learning, f.total),
      width: cells === 0 ? 0 : (f.mastered / cells) * 100,
      learningWidth: cells === 0 ? 0 : (f.learning / cells) * 100,
    })),
  );
</script>

<div class="meter" class:compact data-testid="family-mastery-meter">
  <div class="head">
    <span class="title"><Icon name="globe" size="1.1em" />{$t('progress.mastery.title')}</span>
    <span class="pct">{blendedPct}%</span>
  </div>
  <div
    class="track"
    role="progressbar"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={blendedPct}
    aria-label={$t('progress.mastery.title')}
  >
    <!-- Mastered cells first (solid, per family), then a lighter "learning" band so a session's
         progress shows even before anything is fully mastered. -->
    {#each segments as s (s.family)}
      <div
        class="fill fam-{s.family}"
        style="width:{s.width}%"
        title="{$t(`modes.group.${s.family}`)} · {$t('progress.mastery.mastered')}"
      ></div>
    {/each}
    {#each segments as s (s.family + '-learn')}
      <div
        class="fill learn-{s.family}"
        style="width:{s.learningWidth}%"
        title="{$t(`modes.group.${s.family}`)} · {$t('progress.mastery.learning')}"
      ></div>
    {/each}
  </div>
  <span class="sub"
    >{$t('progress.mastery.fullyMastered', {
      mastered: overall.fullyMastered,
      total: overall.total,
    })}{#if overall.inProgress > 0}
      · {$t('progress.mastery.inProgress', { count: overall.inProgress })}{/if}</span
  >

  {#if compact}
    <!-- Home: a single-line family glance keeps the toggle button lean. -->
    <span class="legend-inline">
      {#each segments as s, i (s.family)}
        {#if i > 0}<span class="sep" aria-hidden="true">·</span>{/if}<span class="chip"
          ><span class="dot fam-{s.family}"></span>{$t(`modes.group.${s.family}`)} {s.pct}%</span
        >
      {/each}
    </span>
  {:else}
    <!-- Progress: a small key naming the two bar states, then the full per-family bars. -->
    <div class="key">
      <span class="key-item"
        ><span class="sw sw-mastered"></span>{$t('progress.mastery.mastered')}</span
      >
      <span class="key-item"
        ><span class="sw sw-learning"></span>{$t('progress.mastery.learning')}</span
      >
    </div>
    <div class="families">
      {#each FAMILIES as f (f.key)}
        {@const seg = segments.find((s) => s.family === f.key)}
        <div class="fam-row">
          <span class="fam-name"
            ><span class="dot fam-{f.key}"></span>{$t(`modes.group.${f.key}`)}</span
          >
          <span class="fam-track">
            <span
              class="fam-fill fam-{f.key}"
              style="width:{seg?.pct ?? 0}%"
              title={$t('progress.mastery.mastered')}
            ></span>
            <span
              class="fam-fill learn-{f.key}"
              style="width:{seg?.learningPct ?? 0}%"
              title={$t('progress.mastery.learning')}
            ></span>
          </span>
          <span class="fam-pct">{seg?.pct ?? 0}%</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .meter {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 1.1rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .meter.compact {
    gap: 0.35rem;
    padding: 0.7rem 0.9rem;
  }

  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .title {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-weight: 800;
    font-size: 1.05rem;
  }

  .title :global(.icon) {
    color: var(--color-accent);
  }

  .compact .title {
    font-size: 0.95rem;
  }

  .pct {
    font-weight: 800;
    color: var(--color-accent);
    font-variant-numeric: tabular-nums;
  }

  .track {
    display: flex;
    height: 0.7rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    overflow: hidden;
  }

  .compact .track {
    height: 0.55rem;
  }

  .fill {
    height: 100%;
  }

  .sub {
    font-size: 0.82rem;
    color: var(--color-muted);
  }

  /* Family colours = the app's mode-family palette; the weak tints mark "learning" progress. */
  .fam-map {
    background: var(--color-accent);
  }
  .fam-flags {
    background: var(--color-coral);
  }
  .fam-capitals {
    background: var(--color-sun);
  }
  /* "Learning" = diagonal stripes in the family hue: clearly textured against the pale track and
     visibly "in progress" rather than the solid "mastered" fill. */
  .learn-map {
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
  /* Slightly dimmed so the striped "learning" band clearly sits below the solid "mastered" fill. */
  .learn-map,
  .learn-flags,
  .learn-capitals,
  .sw-learning {
    opacity: 0.72;
  }

  /* Compact inline legend (Home). */
  .legend-inline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.78rem;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  .sep {
    opacity: 0.5;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }

  .dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 3px;
    flex: 0 0 auto;
  }

  /* State key (Progress): names the solid "mastered" vs striped "learning" bar segments. */
  .key {
    display: flex;
    flex-wrap: wrap;
    gap: 0.85rem;
    margin-top: 0.15rem;
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
  }

  /* Full per-family bars (Progress). */
  .families {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    margin-top: 0.2rem;
  }

  .fam-row {
    display: grid;
    grid-template-columns: 5rem 1fr 2.6rem;
    align-items: center;
    gap: 0.6rem;
  }

  .fam-name {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    font-weight: 700;
  }

  .fam-track {
    display: flex;
    height: 0.5rem;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    overflow: hidden;
  }

  .fam-fill {
    display: block;
    height: 100%;
  }

  .fam-pct {
    font-size: 0.8rem;
    color: var(--color-muted);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
