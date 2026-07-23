// Manual-tuning harness — NOT part of the app bundle or `npm test`. See harness-levelup.ts
// for the why. This one bridges the Svelte runtime + the real interactive WorldMap + the
// geometry loader into the page context for the magnet-pull lab.
export { mount, unmount } from 'svelte';
export { loadCountryFeatures } from '../src/data';
export { default as WorldMap } from '../src/ui/components/WorldMap.svelte';
