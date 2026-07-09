import '@testing-library/jest-dom/vitest';
import { afterEach, describe, it, expect } from 'vitest';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LanguageSwitcher from './LanguageSwitcher.svelte';
import { locale, setLocale } from '../../i18n';

describe('LanguageSwitcher', () => {
  afterEach(() => setLocale('en'));

  it('renders one button per supported locale, marking the active one', () => {
    setLocale('en');
    render(LanguageSwitcher);
    const en = screen.getByRole('button', { name: 'EN' });
    const fr = screen.getByRole('button', { name: 'FR' });
    const de = screen.getByRole('button', { name: 'DE' });
    expect(en).toHaveAttribute('aria-pressed', 'true');
    expect(fr).toHaveAttribute('aria-pressed', 'false');
    expect(de).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches the active locale when another language is clicked', async () => {
    setLocale('en');
    render(LanguageSwitcher);
    await fireEvent.click(screen.getByRole('button', { name: 'FR' }));
    expect(get(locale)).toBe('fr');
    expect(screen.getByRole('button', { name: 'FR' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches to German when DE is clicked', async () => {
    setLocale('en');
    render(LanguageSwitcher);
    await fireEvent.click(screen.getByRole('button', { name: 'DE' }));
    expect(get(locale)).toBe('de');
    expect(screen.getByRole('button', { name: 'DE' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('exposes a localized group label that follows the locale', async () => {
    setLocale('en');
    render(LanguageSwitcher);
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();
    setLocale('fr');
    await tick();
    expect(screen.getByRole('group', { name: 'Langue' })).toBeInTheDocument();
  });
});
