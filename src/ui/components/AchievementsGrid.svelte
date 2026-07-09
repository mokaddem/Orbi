<script lang="ts">
  import { t } from '../../i18n';
  import Icon from './Icon.svelte';
  import RegionIcon from './RegionIcon.svelte';
  import type { IconName } from './icons';
  import type { AchievementView } from '../stores/persistence';

  // Achievements grid (Phase 16): every badge, earned or locked. Earned badges are full
  // colour; locked ones are dimmed but still show their "how to earn" description, so the
  // grid doubles as a checklist. Continent badges use the region silhouette as their icon;
  // the rest use an inline SVG glyph (Phase 18 — was emoji). Presentational — evaluation +
  // persistence happen upstream.
  let { achievements }: { achievements: AchievementView[] } = $props();

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
  };
</script>

<div class="ach" data-testid="achievements">
  <p class="count">
    {$t('progress.achievements.earned', { earned: earnedCount, total: achievements.length })}
  </p>
  <ul class="grid">
    {#each achievements as a (a.id)}
      <li class="badge" class:earned={a.unlocked} data-id={a.id} data-earned={a.unlocked}>
        <span class="icon" aria-hidden="true">
          {#if a.region}
            <RegionIcon region={a.region} />
          {:else}
            <Icon name={ICON[a.id] ?? 'medal'} size="1.5rem" />
          {/if}
        </span>
        <div class="text">
          <span class="title">{$t(`progress.achievements.badges.${a.id}.title`)}</span>
          <span class="desc">{$t(`progress.achievements.badges.${a.id}.desc`)}</span>
        </div>
      </li>
    {/each}
  </ul>
</div>

<style>
  .ach {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .count {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--color-muted);
  }

  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 0.6rem;
  }

  .badge {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.6rem 0.7rem;
    background: var(--color-bg);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    /* Locked by default: muted and desaturated. */
    opacity: 0.55;
    filter: grayscale(1);
  }

  .badge.earned {
    opacity: 1;
    filter: none;
    border-color: var(--color-accent);
    background: var(--color-accent-weak);
  }

  .icon {
    flex: 0 0 auto;
    width: 2.2rem;
    height: 2.2rem;
    display: grid;
    place-items: center;
    color: var(--color-accent);
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .title {
    font-weight: 800;
    font-size: 0.92rem;
  }

  .desc {
    font-size: 0.78rem;
    color: var(--color-muted);
  }
</style>
