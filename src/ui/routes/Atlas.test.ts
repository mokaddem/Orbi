import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Atlas from './Atlas.svelte';

describe('Atlas index', () => {
  it('lists countries A–Z with links to their country pages', () => {
    const { container, getByRole } = render(Atlas);
    expect(getByRole('heading', { level: 1, name: 'Atlas' })).toBeInTheDocument();

    const france = container.querySelector('a[href="#/atlas/country/FR"]');
    expect(france).toBeInTheDocument();
    expect(france?.textContent).toContain('France');
  });

  it('filters the list as you search across languages', async () => {
    const { container, getByLabelText } = render(Atlas);
    const input = getByLabelText('Search countries') as HTMLInputElement;

    await fireEvent.input(input, { target: { value: 'germany' } });
    expect(container.querySelector('a[href="#/atlas/country/DE"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="#/atlas/country/FR"]')).not.toBeInTheDocument();
  });

  it('shows a no-results message when nothing matches', async () => {
    const { getByLabelText, getByText } = render(Atlas);
    const input = getByLabelText('Search countries') as HTMLInputElement;

    await fireEvent.input(input, { target: { value: 'zzzzz' } });
    expect(getByText(/No countries match/)).toBeInTheDocument();
  });

  it('carries the country-scope disclaimer as a foot-note (Phase 21 Stage A)', () => {
    const { getByRole } = render(Atlas);
    expect(getByRole('heading', { name: 'Country scope' })).toBeInTheDocument();
  });
});
