<script lang="ts">
  import { tick } from 'svelte';
  import { t } from '../../i18n';
  import Icon from './Icon.svelte';
  import RegionIcon from './RegionIcon.svelte';
  import type { IconName } from './icons';
  import type { AchievementView } from '../stores/persistence';

  // Achievements grid (Phase 16 → trophy-wall redesign): every badge as a compact icon tile, earned
  // or locked. Earned tiles are full colour (gold for the century / world capstone tiers); locked
  // ones are dimmed and carry a small lock. Tapping a tile reveals its title + "how to earn" in the
  // detail sheet below — so the whole catalogue stays a short, glanceable wall instead of a long
  // stack of description cards. Continent badges use the region silhouette; the rest an inline glyph.
  // Presentational — evaluation + persistence happen upstream.
  let {
    achievements,
    groupByTopic = false,
  }: {
    achievements: AchievementView[];
    /** Split the wall into per-topic sections (Capitals / Languages / Industries) with headers. */
    groupByTopic?: boolean;
  } = $props();

  const earnedCount = $derived(achievements.filter((a) => a.unlocked).length);

  /** Inline-SVG glyph for the non-continent badges (continent badges render a silhouette). */
  const ICON: Record<string, IconName> = {
    'first-round': 'target',
    'perfect-fixed': 'award',
    'flawless-survival': 'shield',
    speedy: 'bolt',
    'streak-7': 'flame',
    'streak-30': 'calendar',
    'region-mastered': 'map',
    century: 'gem',
    'world-mastered': 'crown',
    'capitals-collector': 'landmark',
    'capitals-century': 'gem',
    'capitals-world': 'crown',
    'languages-collector': 'languages',
    'languages-century': 'gem',
    'languages-world': 'crown',
    'industries-collector': 'factory',
    'industries-century': 'gem',
    'industries-world': 'crown',
  };

  /** The century (100-count) and world (master-all) capstone tiers get the metallic-gold treatment. */
  const isGold = (id: string): boolean =>
    id === 'century' || id === 'world-mastered' || /-(century|world)$/.test(id);

  /** Localized section header per extra-knowledge topic (grouped mode). */
  const TOPIC_TITLE: Record<string, string> = {
    capitals: 'progress.capitalMastery.title',
    languages: 'progress.languageMastery.title',
    industries: 'progress.industryMastery.title',
  };
  const TOPIC_ORDER = ['capitals', 'languages', 'industries'];

  const badgeTitle = (a: AchievementView): string =>
    $t(`progress.achievements.badges.${a.id}.title`);
  const badgeDesc = (a: AchievementView): string => $t(`progress.achievements.badges.${a.id}.desc`);

  // The wall's sections: one flat group, or per-topic groups (in a fixed order) when asked. A plain
  // ordered filter — the topic set is tiny (capitals / languages / industries), so no map needed.
  const groups = $derived.by(() => {
    if (!groupByTopic) return [{ key: null as string | null, items: achievements }];
    return TOPIC_ORDER.map((k) => ({
      key: k,
      items: achievements.filter((a) => a.topic === k),
    })).filter((g) => g.items.length > 0);
  });

  // Selection drives the detail sheet. Nothing is selected until the player taps a tile — the sheet
  // shows a "tap a badge" hint until then (no auto-selection, so the reveal is the player's choice).
  let selectedId = $state<string | null>(null);
  const selected = $derived(
    selectedId ? (achievements.find((a) => a.id === selectedId) ?? null) : null,
  );

  let sheetEl = $state<HTMLElement>();

  async function select(id: string): Promise<void> {
    selectedId = id;
    // Bring the detail into view when the tapped tile is far from the sheet (tall grids), skipping
    // the smooth glide under reduced motion. Guarded for non-browser (test) environments.
    await tick();
    const reduce =
      document.documentElement.hasAttribute('data-reduce-motion') ||
      (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    try {
      sheetEl?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    } catch {
      /* scrollIntoView is unavailable in jsdom — a no-op there is fine. */
    }
  }
</script>

<div class="ach" data-testid="achievements">
  <div class="summary">
    <p class="count">
      {$t('progress.achievements.earned', { earned: earnedCount, total: achievements.length })}
    </p>
    <!-- Punchcard: one segment per badge — filled (gold for the capstone tiers) once earned. The
         count line above carries the same information for assistive tech, so this is decorative. -->
    <div class="segs" aria-hidden="true">
      {#each achievements as a (a.id)}
        <span class="seg" class:on={a.unlocked} class:gold={a.unlocked && isGold(a.id)}></span>
      {/each}
    </div>
  </div>

  {#each groups as group (group.key ?? 'all')}
    {#if group.key}
      {@const got = group.items.filter((a) => a.unlocked).length}
      <div class="group-head">
        <h4>{$t(TOPIC_TITLE[group.key] ?? group.key)}</h4>
        <span class="group-frac">{got}/{group.items.length}</span>
      </div>
    {/if}
    <ul class="grid">
      {#each group.items as a (a.id)}
        <li>
          <button
            type="button"
            class="tile"
            class:earned={a.unlocked}
            class:gold={isGold(a.id)}
            class:sel={a.id === selected?.id}
            data-id={a.id}
            data-earned={a.unlocked}
            aria-pressed={a.id === selected?.id}
            title={badgeTitle(a)}
            onclick={() => select(a.id)}
          >
            {#if !a.unlocked}
              <span class="lock" aria-hidden="true"><Icon name="lock" size="0.7rem" /></span>
            {/if}
            <span class="ic" aria-hidden="true">
              {#if a.region}
                <RegionIcon region={a.region} />
              {:else}
                <Icon name={ICON[a.id] ?? 'medal'} size="1.5rem" />
              {/if}
            </span>
            <span class="label">{badgeTitle(a)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/each}

  <div
    class="detail"
    class:hint={!selected}
    class:gold={selected && isGold(selected.id) && selected.unlocked}
    bind:this={sheetEl}
    aria-live="polite"
  >
    {#if selected}
      <span class="detail-ic" aria-hidden="true">
        {#if selected.region}
          <RegionIcon region={selected.region} />
        {:else}
          <Icon name={ICON[selected.id] ?? 'medal'} size="1.6rem" />
        {/if}
      </span>
      <div class="detail-tx">
        <span class="detail-title">{badgeTitle(selected)}</span>
        <span class="detail-desc">{badgeDesc(selected)}</span>
      </div>
      <span class="detail-state" class:earned={selected.unlocked}>
        {selected.unlocked
          ? $t('progress.achievements.stateEarned')
          : $t('progress.achievements.stateLocked')}
      </span>
    {:else}
      <span class="detail-hint">{$t('progress.achievements.selectHint')}</span>
    {/if}
  </div>
</div>

<style>
  .ach {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .summary {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .count {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--color-muted);
  }

  /* Punchcard: equal-width segments, one per badge (in catalogue order), filled once earned. */
  .segs {
    display: flex;
    gap: 3px;
  }

  .seg {
    flex: 1 1 0;
    min-width: 2px;
    height: 7px;
    border-radius: 999px;
    background: var(--color-border);
  }

  .seg.on {
    background: var(--color-accent);
  }

  .seg.gold {
    background: var(--color-gold);
  }

  .group-head {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    margin: 0.35rem 0 -0.1rem;
  }

  .group-head h4 {
    margin: 0;
    font-size: 0.76rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-muted);
  }

  .group-frac {
    margin-left: auto;
    font-size: 0.72rem;
    font-weight: 800;
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }

  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    /* A dense wall: as many ~76px tiles as fit, so a phone shows ~4 per row and the desktop rail
       many more — the whole catalogue in a few rows instead of a long stack of cards. */
    grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
    gap: 0.5rem;
  }

  .tile {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.3rem;
    padding: 0.35rem 0.25rem;
    background: var(--color-bg);
    border: 2px solid var(--color-border);
    border-radius: 14px;
    color: var(--color-muted);
    /* Locked by default: muted + desaturated, mirroring the old card look. */
    opacity: 0.6;
    filter: grayscale(1);
    transition:
      transform 0.1s ease,
      box-shadow 0.12s ease;
  }

  .tile.earned {
    opacity: 1;
    filter: none;
    color: var(--color-accent-strong);
    background: var(--color-accent-weak);
    border-color: var(--color-accent);
  }

  .tile.earned.gold {
    color: var(--color-gold-ink);
    background: var(--color-gold-weak);
    border-color: var(--color-gold);
  }

  .tile:hover {
    transform: translateY(-2px);
  }

  .tile.sel {
    box-shadow: 0 0 0 3px var(--color-accent-weak);
  }

  .tile.earned.gold.sel {
    box-shadow: 0 0 0 3px var(--color-gold-weak);
  }

  .lock {
    position: absolute;
    top: 5px;
    right: 6px;
    display: grid;
    place-items: center;
    color: var(--color-muted);
  }

  .ic {
    display: grid;
    place-items: center;
  }

  .label {
    font-size: 0.6rem;
    font-weight: 700;
    line-height: 1.05;
    text-align: center;
    /* Two lines max, then ellipsis — the full title always lives in the detail sheet. */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* The detail sheet: reveals the tapped badge's name + how-to-earn, so the wall itself can stay
     terse. Sticks to the foot of the section as you scroll a tall wall, staying in view. */
  .detail {
    position: sticky;
    bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.3rem;
    padding: 0.7rem 0.8rem;
    background: var(--color-surface);
    border: 2px solid var(--color-accent);
    border-radius: var(--radius);
    box-shadow: var(--shadow-card);
  }

  .detail.gold {
    border-color: var(--color-gold);
  }

  /* Empty state before any pick: a muted, dashed prompt so the wall reads as interactive. */
  .detail.hint {
    justify-content: center;
    border-style: dashed;
    border-color: var(--color-border);
    box-shadow: none;
  }

  .detail-hint {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--color-muted);
  }

  .detail-ic {
    flex: 0 0 auto;
    width: 2.6rem;
    height: 2.6rem;
    display: grid;
    place-items: center;
    border-radius: 12px;
    color: var(--color-accent-strong);
    background: var(--color-accent-weak);
  }

  .detail.gold .detail-ic {
    color: var(--color-gold-ink);
    background: var(--color-gold-weak);
  }

  .detail-tx {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .detail-title {
    font-weight: 800;
    font-size: 0.95rem;
  }

  .detail-desc {
    font-size: 0.8rem;
    color: var(--color-muted);
  }

  .detail-state {
    margin-left: auto;
    flex: 0 0 auto;
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    color: var(--color-muted);
    background: var(--color-border);
  }

  .detail-state.earned {
    color: var(--color-accent-contrast);
    background: var(--color-accent);
  }

  @media (prefers-reduced-motion: reduce) {
    .tile {
      transition: none;
    }
  }
</style>
