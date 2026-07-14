import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Root element #app not found');
}

const app = mount(App, { target });

// --- Keep an installed PWA fresh ------------------------------------------------------
// vite-plugin-pwa registers + auto-updates the service worker (registerType 'autoUpdate'),
// but the browser only *checks* for a new build on a cold navigation plus its own lazy
// (~daily) poll. An installed app resumed warm — especially an iOS home-screen PWA — can
// keep serving the cached shell for a long time, so a fresh release looked stale until a
// manual force-refresh. Nudge an update check whenever the app regains focus (i.e. a
// reopen) and hourly for long-lived sessions; `autoUpdate` then activates the new worker
// on its own — no prompt, no manual refresh. Standard SW API only (no PWA virtual module),
// so the jsdom test suite stays SW-free. `main.ts` lives for the app's lifetime → no
// listener teardown needed.
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.ready.then((registration) => {
    const checkForUpdate = (): void => {
      if (document.visibilityState === 'visible') void registration.update();
    };
    document.addEventListener('visibilitychange', checkForUpdate);
    window.addEventListener('focus', checkForUpdate);
    setInterval(checkForUpdate, 60 * 60 * 1000);
  });
}

export default app;
