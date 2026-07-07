<script lang="ts">
  import { router } from 'svelte-spa-router';
  import { t } from '../../i18n';
  import { navLinks } from '../routes';
  import LanguageSwitcher from './LanguageSwitcher.svelte';

  function isActive(href: string, current: string): boolean {
    const path = href.replace(/^#/, '') || '/';
    return path === '/' ? current === '/' : current === path || current.startsWith(`${path}/`);
  }
</script>

<header class="nav">
  <a class="brand" href="#/">{$t('app.title')}</a>

  <nav class="links" aria-label={$t('nav.primary')}>
    {#each navLinks as link (link.href)}
      <a href={link.href} class:active={isActive(link.href, router.location)}>
        {$t(link.labelKey)}
      </a>
    {/each}
  </nav>

  <LanguageSwitcher />
</header>

<style>
  .nav {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    padding: 0.75rem 1rem;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
  }

  .brand {
    font-weight: 700;
    font-size: 1.15rem;
    color: var(--color-text);
  }

  .links {
    display: flex;
    gap: 0.25rem;
    flex: 1;
  }

  .links a {
    padding: 0.35rem 0.7rem;
    border-radius: var(--radius);
    color: var(--color-muted);
  }

  .links a:hover {
    text-decoration: none;
    background: var(--color-bg);
  }

  .links a.active {
    color: var(--color-accent);
    background: var(--color-bg);
    font-weight: 600;
  }
</style>
