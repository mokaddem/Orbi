import '@testing-library/jest-dom/vitest';
import { afterEach, describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Demo from './Demo.svelte';
import { setLocale } from '../../i18n';
import en from '../../i18n/messages/en';
import fr from '../../i18n/messages/fr';

describe('Demo (runtime i18n)', () => {
  afterEach(() => setLocale('en'));

  it('renders the demo string in English by default', () => {
    setLocale('en');
    render(Demo);
    expect(screen.getByTestId('demo')).toHaveTextContent(en.home.demo);
  });

  it('renders the demo string in French when the locale is switched', () => {
    setLocale('fr');
    render(Demo);
    expect(screen.getByTestId('demo')).toHaveTextContent(fr.home.demo);
  });
});
