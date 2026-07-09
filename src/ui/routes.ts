import type { RouteDefinition } from 'svelte-spa-router';
import type { IconName } from './components/icons';
import Home from './routes/Home.svelte';
import Play from './routes/Play.svelte';
import Summary from './routes/Summary.svelte';
import History from './routes/History.svelte';
import Settings from './routes/Settings.svelte';
import Atlas from './routes/Atlas.svelte';
import AtlasRegion from './routes/AtlasRegion.svelte';
import AtlasCountry from './routes/AtlasCountry.svelte';
import NotFound from './routes/NotFound.svelte';

/** Hash-based route table for svelte-spa-router (PWA / static-host friendly). */
const routes: RouteDefinition = {
  '/': Home,
  '/play': Play,
  '/summary': Summary,
  '/history': History,
  '/atlas': Atlas,
  '/atlas/region/:region': AtlasRegion,
  '/atlas/country/:iso2': AtlasCountry,
  '/settings': Settings,
  '*': NotFound,
};

/** Primary navigation entries (order matters). */
export const navLinks: { href: string; labelKey: string; icon: IconName }[] = [
  { href: '#/', labelKey: 'nav.home', icon: 'home' },
  { href: '#/play', labelKey: 'nav.play', icon: 'play' },
  { href: '#/atlas', labelKey: 'nav.atlas', icon: 'map' },
  { href: '#/history', labelKey: 'nav.history', icon: 'history' },
  { href: '#/settings', labelKey: 'nav.settings', icon: 'settings' },
];

export default routes;
