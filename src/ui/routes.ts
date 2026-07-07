import type { RouteDefinition } from 'svelte-spa-router';
import Home from './routes/Home.svelte';
import Play from './routes/Play.svelte';
import Summary from './routes/Summary.svelte';
import History from './routes/History.svelte';
import Settings from './routes/Settings.svelte';
import NotFound from './routes/NotFound.svelte';

/** Hash-based route table for svelte-spa-router (PWA / static-host friendly). */
const routes: RouteDefinition = {
  '/': Home,
  '/play': Play,
  '/summary': Summary,
  '/history': History,
  '/settings': Settings,
  '*': NotFound,
};

/** Primary navigation entries (order matters). */
export const navLinks: { href: string; labelKey: string }[] = [
  { href: '#/', labelKey: 'nav.home' },
  { href: '#/play', labelKey: 'nav.play' },
  { href: '#/history', labelKey: 'nav.history' },
  { href: '#/settings', labelKey: 'nav.settings' },
];

export default routes;
