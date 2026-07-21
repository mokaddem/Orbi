<script lang="ts">
  import { t } from '../../i18n';
  import {
    RANKS,
    XP_PER_CORRECT,
    XP_PER_QUESTION,
    XP_PER_SESSION,
    XP_PER_STREAK_DAY,
    XP_PER_BADGE,
    STREAK_MILESTONE_XP,
  } from '../../domain';
  import { rankMedal, METAL_PALETTES, type RankMetal } from '../components/rankMedal';
  import type { IconName } from '../components/icons';
  import RankMedal from '../components/RankMedal.svelte';
  import PageHero from '../components/PageHero.svelte';
  import Icon from '../components/Icon.svelte';

  // Living rank reference (#/ranks): renders the real RankMedal component for every rank in the
  // domain's RANKS table, so it can never drift from the game — add or restyle a badge and this page
  // reflects it with no changes here. XP figures come straight from the xp.ts constants for the same
  // reason. No decorative flourishes: the medals shown here are exactly what the app shows.

  // Group the ladder into its metal bands (bronze → silver → gold → crystal), reading the medal spec
  // per rank so the grouping follows RANK_MEDALS, not a hardcoded assumption.
  const bands: { metal: RankMetal; ranks: (typeof RANKS)[number][] }[] = (() => {
    const out: { metal: RankMetal; ranks: (typeof RANKS)[number][] }[] = [];
    for (const r of RANKS) {
      const metal = rankMedal(r.index).metal;
      const last = out[out.length - 1];
      if (last && last.metal === metal) last.ranks.push(r);
      else out.push({ metal, ranks: [r] });
    }
    return out;
  })();

  /** The XP band a rank spans: from its threshold up to just below the next rank's (open-ended at top). */
  function bandRange(index: number): string {
    const min = RANKS[index].minXp;
    const next = RANKS[index + 1];
    return next
      ? `${min.toLocaleString()}–${(next.minXp - 1).toLocaleString()} XP`
      : `${min.toLocaleString()}+ XP`;
  }

  // Live XP weights, pulled from the domain constants (labels reuse the existing rank.source.* keys).
  const XP_WEIGHTS: { key: string; xp: number; icon: IconName }[] = [
    { key: 'correct', xp: XP_PER_CORRECT, icon: 'check' },
    { key: 'questions', xp: XP_PER_QUESTION, icon: 'target' },
    { key: 'sessions', xp: XP_PER_SESSION, icon: 'play' },
    { key: 'streak', xp: XP_PER_STREAK_DAY, icon: 'calendar' },
    { key: 'badges', xp: XP_PER_BADGE, icon: 'trophy' },
  ];

  /** A tiny gradient dot in the band's metal, so a band heading reads as its material at a glance. */
  function metalDot(metal: RankMetal): string {
    const p = METAL_PALETTES[metal];
    return `linear-gradient(140deg, ${p.hi}, ${p.lo})`;
  }
</script>

<section class="ranks-page">
  <PageHero title={$t('ranksPage.title')} pose="proud" />
  <p class="intro">{$t('ranksPage.intro')}</p>

  <div class="ladder">
    {#each bands as band (band.metal)}
      <div class="band">
        <h2 class="band-head">
          <span class="band-dot" style="background:{metalDot(band.metal)}" aria-hidden="true"
          ></span>
          {$t(`ranksPage.band.${band.metal}`)}
        </h2>
        <ul class="rungs">
          {#each band.ranks as r (r.key)}
            <li class="rung">
              <div class="rung-medal">
                <RankMedal index={r.index} size={band.metal === 'crystal' ? 132 : 116} />
              </div>
              <div class="rung-body">
                <span class="rung-level"
                  >{$t('rank.level', { n: r.index + 1, total: RANKS.length })}</span
                >
                <span class="rung-name">{$t(`rank.names.${r.key}`)}</span>
                <span class="rung-xp">
                  {#if r.minXp === 0}
                    {$t('ranksPage.startRank')}
                  {:else}
                    {$t('ranksPage.reachAt', { xp: r.minXp.toLocaleString() })}
                  {/if}
                </span>
                <span class="rung-band">{bandRange(r.index)}</span>
              </div>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </div>

  <div class="ref-grid">
    <section class="ref-card">
      <h2>{$t('ranksPage.earnTitle')}</h2>
      <ul class="rows">
        {#each XP_WEIGHTS as w (w.key)}
          <li class="row">
            <span class="row-ico" aria-hidden="true"><Icon name={w.icon} size={16} /></span>
            <span class="row-label">{$t(`rank.source.${w.key}`)}</span>
            <span class="row-val">{$t('rank.earned', { xp: w.xp.toLocaleString() })}</span>
          </li>
        {/each}
      </ul>
    </section>

    <section class="ref-card">
      <h2>{$t('ranksPage.streakTitle')}</h2>
      <ul class="rows">
        {#each STREAK_MILESTONE_XP as m (m.streak)}
          <li class="row">
            <span class="row-ico" aria-hidden="true"><Icon name="flame" size={16} /></span>
            <span class="row-label">{$t('ranksPage.inARow', { count: m.streak })}</span>
            <span class="row-val">{$t('rank.earned', { xp: m.xp.toLocaleString() })}</span>
          </li>
        {/each}
      </ul>
    </section>
  </div>
</section>

<style>
  .ranks-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 760px;
    margin-inline: auto;
    width: 100%;
  }

  .intro {
    margin: 0;
    max-width: 60ch;
    color: var(--color-muted);
  }

  .ladder {
    display: flex;
    flex-direction: column;
    gap: 1.75rem;
  }

  .band {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .band-head {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-muted);
  }

  .band-dot {
    width: 0.85rem;
    height: 0.85rem;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 18%);
  }

  .rungs {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
  }

  .rung {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
    padding: 1rem 1.35rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  /* The medal is the hero — sized large and left, with the metadata flushed to the right edge. */
  .rung-medal {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
  }

  .rung-body {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.1rem;
    min-width: 0;
    text-align: right;
  }

  .rung-level {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    color: var(--color-muted);
  }

  .rung-name {
    font-weight: 800;
    font-size: 1.2rem;
    line-height: 1.15;
    color: var(--color-text);
  }

  .rung-xp {
    margin-top: 0.15rem;
    font-weight: 700;
    color: var(--color-accent);
    font-variant-numeric: tabular-nums;
  }

  .rung-band {
    font-size: 0.82rem;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  /* Reference cards */
  .ref-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    gap: 1rem;
  }

  .ref-card {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 1.1rem 1.2rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .ref-card h2 {
    margin: 0;
    font-size: 1rem;
    color: var(--color-text);
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .row-ico {
    flex: 0 0 auto;
    display: inline-flex;
    color: var(--color-accent);
  }

  .row-label {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .row-val {
    flex: 0 0 auto;
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--color-accent-strong);
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 520px) {
    .rung {
      flex-direction: column;
      justify-content: center;
      text-align: center;
      gap: 0.5rem;
    }
    .rung-body {
      align-items: center;
      text-align: center;
    }
  }
</style>
