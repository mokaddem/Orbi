import '@testing-library/jest-dom/vitest';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import PwaInstallPrompt from './PwaInstallPrompt.svelte';
import en from '../../i18n/messages/en';
import { setLocale } from '../../i18n';
import { installPromptEvent, appInstalled } from '../pwa-install';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36';

function stubNavigator({ ua = '', platform = '', maxTouchPoints = 0 } = {}): void {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  Object.defineProperty(navigator, 'platform', { value: platform, configurable: true });
  Object.defineProperty(navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true });
}

/** Fake `window.matchMedia`; `standalone` decides whether `(display-mode: standalone)` matches. */
function stubMatchMedia(standalone: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('standalone') && standalone,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  setLocale('en');
  installPromptEvent.set(null);
  appInstalled.set(false);
  stubNavigator({ ua: 'desktop', platform: 'Win32', maxTouchPoints: 0 });
  // jsdom ships no matchMedia, so remove any stub to restore the default (undefined).
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe('PwaInstallPrompt', () => {
  it('stays hidden on desktop', async () => {
    stubNavigator({ ua: 'desktop', platform: 'Win32', maxTouchPoints: 0 });
    render(PwaInstallPrompt);
    // Give onMount a chance to run, then assert nothing opened.
    await Promise.resolve();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('shows iOS-specific steps on an iPhone', async () => {
    stubNavigator({ ua: IPHONE, platform: 'iPhone', maxTouchPoints: 5 });
    render(PwaInstallPrompt);
    await screen.findByRole('dialog');
    expect(screen.getByText(en.pwa.ios.lead)).toBeInTheDocument();
    expect(screen.getByText(en.pwa.ios.step1)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('shows Android-specific steps on an Android device', async () => {
    stubNavigator({ ua: ANDROID, platform: 'Linux armv8l', maxTouchPoints: 5 });
    render(PwaInstallPrompt);
    await screen.findByRole('dialog');
    expect(screen.getByText(en.pwa.android.lead)).toBeInTheDocument();
    expect(screen.getByText(en.pwa.android.step2)).toBeInTheDocument();
  });

  it('stays hidden when already installed (standalone)', async () => {
    stubNavigator({ ua: IPHONE, platform: 'iPhone', maxTouchPoints: 5 });
    stubMatchMedia(true);
    render(PwaInstallPrompt);
    await Promise.resolve();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('can be dismissed with the "Maybe later" button', async () => {
    stubNavigator({ ua: IPHONE, platform: 'iPhone', maxTouchPoints: 5 });
    render(PwaInstallPrompt);
    await screen.findByRole('dialog');
    await fireEvent.click(screen.getByRole('button', { name: en.pwa.dismiss }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('offers a one-tap Install button when the browser provides a deferred prompt', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    installPromptEvent.set({
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
    } as never);
    stubNavigator({ ua: ANDROID, platform: 'Linux armv8l', maxTouchPoints: 5 });
    render(PwaInstallPrompt);
    const installBtn = await screen.findByRole('button', { name: en.pwa.install });
    await fireEvent.click(installBtn);
    expect(prompt).toHaveBeenCalledOnce();
  });
});
