// Manual-tuning harness — NOT part of the app bundle or `npm test`.
//
// This module exists only so a Playwright page can pull the Svelte runtime *and* the real
// SessionXpCard into the page context in one import. A raw `import('svelte')` inside
// page.evaluate() fails (bare specifier, unresolved), but Vite compiles THIS file and
// resolves every specifier for us — so the page just does `import('/manual/harness-levelup.ts')`.
//
// Nothing in the app imports this file, so it never enters the production build.
export { mount, unmount } from 'svelte';
export { rankForXp, RANKS } from '../src/domain/xp';
export { default as SessionXpCard } from '../src/ui/components/SessionXpCard.svelte';
