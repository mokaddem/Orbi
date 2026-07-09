<script lang="ts">
  import { t } from '../../i18n';
  import RegionIcon from './RegionIcon.svelte';
  import type { AchievementView } from '../stores/persistence';

  // Achievements grid (Phase 16): every badge, earned or locked. Earned badges are full
  // colour; locked ones are dimmed but still show their "how to earn" description, so the
  // grid doubles as a checklist. Continent badges use the region silhouette as their icon;
  // the rest use an emoji. Presentational — evaluation + persistence happen upstream.
  let { achievements }: { achievements: AchievementView[] } = $props();

  const earnedCount = $derived(achievements.filter((a) => a.unlocked).length);

  /** Emoji icon for the non-continent badges (continent badges render a silhouette). */
  const EMOJI: Record<string, string> = {
    'first-round': '🎯',
    'perfect-fixed': '💯',
    'flawless-survival': '🛡️',
    speedy: '⚡',
    'streak-7': '🔥',
    'streak-30': '📅',
    'region-mastered': '🗺️',
    century: '💎',
    'world-mastered': '👑',
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
            <span class="emoji">{EMOJI[a.id] ?? '🏅'}</span>
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

  .emoji {
    font-size: 1.5rem;
    line-height: 1;
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
