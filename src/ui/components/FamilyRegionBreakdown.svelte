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
  //
  // Grandmaster Run reward (Phase 44, stacked only): once a family × continent is *fully* mastered
  // its mini-bar climbs a two-rung ladder in place of the practise shortcut — a "prove it" launch
  // (`onChallenge`) until the run is passed, then a **gilded** gold + crown cell once `certified`
  // (a `${family}|${region}` set). A continent with every family certified gets a gold ring + tag.
  let {
    regions,
    variant = 'stacked',
    onPractise,
    onChallenge,
    onInvite,
    certified,
    spent,
    cooldownText,
  }: {
    regions: RegionFamilyMastery[];
    variant?: 'stacked' | 'toggle';
    onPractise?: (region: string, family: MasteryFamily) => void;
    onChallenge?: (region: string, family: MasteryFamily) => void;
    /** Certified cell → "challenge a friend" (Phase 46b): the gilded crown becomes this invite tap. */
    onInvite?: (region: string, family: MasteryFamily) => void;
    /** Keys `${family}|${region}` of family × continents whose Grandmaster Run is passed. */
    certified?: Set<string>;
    /** Keys `${family}|${region}` whose daily attempt is already spent — shown on cooldown. */
    spent?: Set<string>;
    /** The "next attempt in …" phrase for a spent (cooldown) cell's tooltip / label. */
    cooldownText?: string;
  } = $props();

  const isCertified = (region: string, family: MasteryFamily): boolean =>
    certified?.has(`${family}|${region}`) ?? false;

  const isSpent = (region: string, family: MasteryFamily): boolean =>
    spent?.has(`${family}|${region}`) ?? false;

  // A continent is fully grandmastered once every family that applies to it (total > 0) is certified.
  const regionGrandmastered = (r: RegionFamilyMastery): boolean => {
    const applicable = r.families.filter((f) => f.total > 0);
    return applicable.length > 0 && applicable.every((f) => isCertified(r.region, f.family));
  };

  // Shared label for the "prove it" launch (tooltip + screen-reader name).
  const challengeLabel = (family: MasteryFamily, region: string): string =>
    $t('challenge.proveItAria', {
      family: $t(`modes.group.${family}`),
      region: $localizedRegion(region),
    });

  // Label for the certified-cell "challenge a friend" invite (Phase 46b).
  const inviteLabel = (family: MasteryFamily, region: string): string =>
    `${$t('challenge.friendInvite.share')} · ${$t(`modes.group.${family}`)} · ${$localizedRegion(region)}`;

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
    {@const rowGm = variant === 'stacked' && regionGrandmastered(r)}
    <li class:row-gm={rowGm}>
      <span class="icon" class:gm={rowGm} aria-hidden="true"><RegionIcon region={r.region} /></span>
      <div class="body">
        <div class="line">
          <span class="name">
            {$localizedRegion(r.region)}
            {#if rowGm}
              <span class="gm-tag"><Icon name="crown" size={12} /> {$t('challenge.certified')}</span
              >
            {/if}
          </span>
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
              {@const done = fam.total > 0 && fam.mastered === fam.total}
              <!-- Certified is *permanent* (the capstone is monotonic), so a passed family gilds
                   even if its SR mastery later lapses — the gold reflects the earned run, not live %. -->
              {@const cert = isCertified(r.region, f.key)}
              <div class="mini" class:gilded={cert}>
                <span class="tag">{$t(`modes.group.${f.key}`)}</span>
                <span class="mtrack">
                  {#if cert}
                    <span class="mfill gm-fill" style="width:100%"></span>
                  {:else}
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
                  {/if}
                </span>
                {#if cert && onInvite}
                  <!-- Certified: the gilded crown doubles as "challenge a friend" (Phase 46b) — tap
                       to share an invite for this capstone to someone else. -->
                  <button
                    type="button"
                    class="mpct gm-crown gm-crown-btn"
                    title={inviteLabel(f.key, r.region)}
                    aria-label={inviteLabel(f.key, r.region)}
                    onclick={() => onInvite(r.region, f.key)}
                  >
                    <Icon name="crown" size={15} />
                  </button>
                {:else if cert}
                  <!-- Certified but no invite handler wired (e.g. the Home 'toggle' variant): a static
                       gilded crown standing in for the (redundant) 100%. -->
                  <span
                    class="mpct gm-crown"
                    title={$t('challenge.certified')}
                    aria-label={$t('challenge.certified')}
                  >
                    <Icon name="crown" size={15} />
                  </span>
                {:else}
                  <span class="mpct">{p}%</span>
                  {#if done && onChallenge}
                    <!-- Fully mastered but not yet certified — the "prove it" launch. On cooldown
                         (today's attempt spent) it dims to a clock; tapping still opens the offer
                         modal, which explains the cooldown + shows the countdown. -->
                    {@const cool = isSpent(r.region, f.key)}
                    {@const label =
                      cool && cooldownText ? cooldownText : challengeLabel(f.key, r.region)}
                    <button
                      type="button"
                      class="prove"
                      class:cooling={cool}
                      aria-label={label}
                      title={label}
                      onclick={() => onChallenge(r.region, f.key)}
                    >
                      <Icon name={cool ? 'clock' : 'crown'} size={15} />
                    </button>
                  {:else if onPractise && fam.mastered < fam.total}
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

  /* "Prove it" launch (Phase 44): appears in place of the practise shortcut once a family ×
     continent is fully mastered. A filled gold crown so it reads as a reward to claim, not a chore. */
  .prove {
    appearance: none;
    display: grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    padding: 0;
    border: 1px solid var(--color-gold-deep);
    border-radius: 999px;
    background: var(--gold-metal);
    color: var(--color-gold-ink);
    cursor: pointer;
    box-shadow: 0 1px 3px -1px rgb(168 110 8 / 50%);
    transition: transform 0.12s ease;
  }

  .prove:hover {
    transform: translateY(-1px) scale(1.05);
  }

  .prove:focus-visible {
    outline: 2px solid var(--color-gold-deep);
    outline-offset: 2px;
  }

  /* Spent today (cooldown): the gold crown dims to a muted clock — still tappable to see when the
     next attempt opens, but clearly not the claimable reward. */
  .prove.cooling {
    background: var(--color-bg);
    border-color: var(--color-border);
    color: var(--color-muted);
    box-shadow: none;
  }

  .prove.cooling:hover {
    transform: none;
    border-color: var(--color-muted);
  }

  .prove.cooling:focus-visible {
    outline-color: var(--color-muted);
  }

  /* Certified: the mini-bar gilds in place, the crown replacing the (redundant 100%) percentage. */
  .mini.gilded .tag {
    color: var(--color-gold-ink);
    font-weight: 800;
  }

  .mini.gilded .mtrack {
    border-color: var(--color-gold);
  }

  .gm-fill {
    display: block;
    height: 100%;
    background: var(--gold-metal);
  }

  .gm-crown {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    color: var(--color-gold-deep);
  }

  /* The certified crown as a tappable "challenge a friend" invite (Phase 46b): keeps the gilded look
     but reads as interactive (pointer + a gentle hover lift). */
  .gm-crown-btn {
    appearance: none;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    transition: transform 0.12s ease;
  }

  .gm-crown-btn:hover {
    transform: translateY(-1px) scale(1.08);
  }

  .gm-crown-btn:focus-visible {
    outline: 2px solid var(--color-gold-deep);
    outline-offset: 2px;
    border-radius: 999px;
  }

  /* A fully-certified continent: a gold ring on its region emblem + a "Grandmaster" tag. */
  .icon.gm {
    color: var(--color-gold-deep);
    position: relative;
  }

  .icon.gm::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 999px;
    border: 2px solid var(--color-gold);
  }

  .gm-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    margin-left: 0.4rem;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: var(--color-gold-ink);
    background: var(--color-gold-weak);
    border: 1px solid var(--color-gold);
    vertical-align: middle;
  }

  @media (prefers-reduced-motion: reduce) {
    .prove {
      transition: none;
    }
    .prove:hover {
      transform: none;
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
