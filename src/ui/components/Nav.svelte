<script lang="ts">
  import { router } from 'svelte-spa-router';
  import { t } from '../../i18n';
  import { navLinks } from '../routes';
  import Icon from './Icon.svelte';
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
        <Icon name={link.icon} size={17} />
        <span>{$t(link.labelKey)}</span>
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
    border-bottom: 2px solid var(--color-border);
  }

  .brand {
    font-weight: 800;
    font-size: 1.15rem;
    color: var(--color-accent);
  }

  .links {
    display: flex;
    gap: 0.25rem;
    flex: 1;
  }

  .links a {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
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
    background: var(--color-accent-weak);
    font-weight: 700;
  }
</style>
