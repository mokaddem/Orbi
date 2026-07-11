import type { RouteDefinition } from 'svelte-spa-router';
import type { IconName } from './components/icons';
import Home from './routes/Home.svelte';
import Play from './routes/Play.svelte';
import Practice from './routes/Practice.svelte';
import Summary from './routes/Summary.svelte';
import History from './routes/History.svelte';
import Progress from './routes/Progress.svelte';
import Settings from './routes/Settings.svelte';
import Atlas from './routes/Atlas.svelte';
import AtlasRegion from './routes/AtlasRegion.svelte';
import AtlasCountry from './routes/AtlasCountry.svelte';
import NotFound from './routes/NotFound.svelte';

/** Hash-based route table for svelte-spa-router (PWA / static-host friendly). */
const routes: RouteDefinition = {
  '/': Home,
  '/play': Play,
  '/practice': Practice,
  '/summary': Summary,
  '/history': History,
  '/progress': Progress,
  '/atlas': Atlas,
  '/atlas/region/:region': AtlasRegion,
  '/atlas/country/:iso2': AtlasCountry,
  '/settings': Settings,
  '*': NotFound,
};

export interface NavLink {
  href: string;
  labelKey: string;
  icon: IconName;
  /** The Play entry is rendered specially by the responsive nav (Phase 34): a raised centre
      FAB in the mobile bottom bar, and a prominent primary button in the desktop rail. */
  primary?: boolean;
}

/** Primary navigation entries (order matters — this is the desktop rail order). */
export const navLinks: NavLink[] = [
  { href: '#/', labelKey: 'nav.home', icon: 'home' },
  { href: '#/play', labelKey: 'nav.play', icon: 'play', primary: true },
  { href: '#/atlas', labelKey: 'nav.atlas', icon: 'map' },
  { href: '#/history', labelKey: 'nav.history', icon: 'history' },
  { href: '#/progress', labelKey: 'nav.progress', icon: 'trophy' },
  { href: '#/settings', labelKey: 'nav.settings', icon: 'settings' },
];

/** Mobile bottom-bar layout (Phase 34): four destinations flanking the raised Play FAB in the
    centre. Settings is intentionally absent here — on mobile it lives in the slim top app-bar. */
export const bottomTabs: NavLink[] = ['#/', '#/atlas', '#/play', '#/history', '#/progress'].map(
  (href) => navLinks.find((link) => link.href === href)!,
);

export default routes;
