<script lang="ts">
  import { t, localizedRegion } from '../../i18n';
  import { FAMILIES, type MasteryFamily, type RegionFamilyMastery } from '../../domain';
  import Icon from './Icon.svelte';
  import RegionIcon from './RegionIcon.svelte';

  // Per-region combined-mastery breakdown (Phase 41; unified tab layout, Phase 47).
  //
  // A lens toggle (Overall / Map / Flags / Capitals) chooses what every region row shows: the
  // blended bar on "Overall", or a single family's bar on Map / Flags / Capitals. Rows arrive
  // pre-ordered least-complete first (from `computeFamilyMastery`), so this stays presentational.
  //
  // The interactive controls (Progress) ride the *active family lens* — a per-region × family
  // control to the right of that family's bar:
  //  • `onPractise`  — a not-fully-mastered family → "practise" its unmastered countries.
  //  • `onChallenge` — a *fully* mastered but uncertified family → the "prove it" Grandmaster Run
  //     launch (dims to a clock while today's attempt is `spent`, still tappable for the countdown).
  //  • `onInvite` / `certified` — once the run is passed the cell gilds gold and the crown doubles
  //     as "challenge a friend" (Phase 46b). A continent with every family certified wears a gold
  //     ring + tag (shown on any lens). The Overall lens carries no per-family control.
  // Home passes no handlers, so it renders as a pure viewer (bars only) — backwards compatible.
  let {
    regions,
    onPractise,
    onChallenge,
    onInvite,
    certified,
    spent,
    cooldownText,
  }: {
    regions: RegionFamilyMastery[];
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

  // Any handler wired ⇒ this is the interactive (Progress) surface: reserve the action column so
  // bars stay aligned across rows. Home passes none, so it renders as a bars-only viewer.
  const interactive = $derived(Boolean(onPractise || onChallenge || onInvite));

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

<div class="toggle" role="group" aria-label={$t('progress.mastery.regionsTitle')}>
  {#each LENSES as l (l)}
    <button type="button" class="lens fam-{l}" aria-pressed={lens === l} onclick={() => (lens = l)}
      >{lensLabel(l)}</button
    >
  {/each}
</div>

<ul class="regions" data-testid="family-region-mastery">
  {#each regions as r (r.region)}
    {@const rowGm = regionGrandmastered(r)}
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
            {#if lens !== 'overall'}
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

        {#if lens === 'overall'}
          {@const p = blendedPct(r)}
          <div
            class="track"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={p}
            aria-label="{$localizedRegion(r.region)} — {lensLabel(lens)}"
          >
            <span
              class="fill fam-overall"
              style="width:{p}%"
              title={$t('progress.mastery.mastered')}
            ></span>
            <span
              class="fill learn-overall"
              style="width:{lensLearnPct(r)}%"
              title={$t('progress.mastery.learning')}
            ></span>
          </div>
        {:else}
          <!-- Capture the active lens as a `MasteryFamily` const: the `{:else}` already narrows
               `lens`, but the onclick closures below would otherwise widen it back to `Lens`. -->
          {@const familyKey = lens}
          {@const fam = famTally(r, familyKey)}
          {@const p = pct(fam.mastered, fam.total)}
          {@const lp = pct(fam.learning, fam.total)}
          {@const done = fam.total > 0 && fam.mastered === fam.total}
          <!-- Certified is *permanent* (the capstone is monotonic), so a passed family gilds even
               if its SR mastery later lapses — the gold reflects the earned run, not live %. -->
          {@const cert = isCertified(r.region, familyKey)}
          <div class="bar-row" class:interactive>
            <div
              class="track"
              class:gilded={cert}
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={cert ? 100 : p}
              aria-label="{$localizedRegion(r.region)} — {lensLabel(familyKey)}"
            >
              {#if cert}
                <span class="fill gm-fill" style="width:100%"></span>
              {:else}
                <span
                  class="fill fam-{familyKey}"
                  style="width:{p}%"
                  title={$t('progress.mastery.mastered')}
                ></span>
                <span
                  class="fill learn-{familyKey}"
                  style="width:{lp}%"
                  title={$t('progress.mastery.learning')}
                ></span>
              {/if}
            </div>
            {#if cert && onInvite}
              <!-- Certified: the gilded crown doubles as "challenge a friend" (Phase 46b) — tap to
                   share an invite for this capstone to someone else. -->
              <button
                type="button"
                class="gm-crown gm-crown-btn"
                title={inviteLabel(familyKey, r.region)}
                aria-label={inviteLabel(familyKey, r.region)}
                onclick={() => onInvite(r.region, familyKey)}
              >
                <Icon name="crown" size={15} />
              </button>
            {:else if cert}
              <!-- Certified but no invite handler wired: a static gilded crown marking the capstone. -->
              <span
                class="gm-crown"
                title={$t('challenge.certified')}
                aria-label={$t('challenge.certified')}
              >
                <Icon name="crown" size={15} />
              </span>
            {:else if done && onChallenge}
              <!-- Fully mastered but not yet certified — the "prove it" launch. On cooldown (today's
                   attempt spent) it dims to a clock; tapping still opens the offer modal, which
                   explains the cooldown + shows the countdown. -->
              {@const cool = isSpent(r.region, familyKey)}
              {@const label =
                cool && cooldownText ? cooldownText : challengeLabel(familyKey, r.region)}
              <button
                type="button"
                class="prove"
                class:cooling={cool}
                aria-label={label}
                title={label}
                onclick={() => onChallenge(r.region, familyKey)}
              >
                <Icon name={cool ? 'clock' : 'crown'} size={15} />
              </button>
            {:else if onPractise && fam.mastered < fam.total}
              {@const label = practiseLabel(familyKey, r.region)}
              <button
                type="button"
                class="practise"
                aria-label={label}
                title={label}
                onclick={() => onPractise(r.region, familyKey)}
              >
                <Icon name="target" size={15} />
              </button>
            {/if}
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

  /* Family palette shared by the tab bar + the bars. */
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

  /* The bar + its per-family control (Progress). The control column stays reserved on the
     interactive surface so the bars line up whether or not a given row carries an action. */
  .bar-row {
    display: grid;
    grid-template-columns: 1fr;
    align-items: center;
    gap: 0.5rem;
  }

  .bar-row.interactive {
    grid-template-columns: 1fr 1.6rem;
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

  /* Certified: the bar gilds gold and its crown replaces the (redundant 100%) percentage. */
  .track.gilded {
    border-color: var(--color-gold);
  }

  .gm-fill {
    display: block;
    height: 100%;
    background: var(--gold-metal);
  }

  .gm-crown {
    display: grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
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

  /* Family lens toggle (the tab bar). */
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
