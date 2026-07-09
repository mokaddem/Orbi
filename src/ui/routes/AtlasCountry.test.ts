import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AtlasCountry from './AtlasCountry.svelte';

describe('AtlasCountry', () => {
  it('shows the flag, name, and region / sub-region cross-links', () => {
    const { container, getByRole } = render(AtlasCountry, { params: { iso2: 'FR' } });

    expect(getByRole('heading', { level: 1, name: 'France' })).toBeInTheDocument();
    expect(container.querySelector('a[href="#/atlas/region/Europe"]')).toBeInTheDocument();
    expect(container.textContent).toContain('Western Europe');
    // The flag is named for a11y on the reference page.
    expect(getByRole('img', { name: 'France' })).toBeInTheDocument();
  });

  it('resolves the ISO case-insensitively', () => {
    const { getByRole } = render(AtlasCountry, { params: { iso2: 'fr' } });
    expect(getByRole('heading', { level: 1, name: 'France' })).toBeInTheDocument();
  });

  it('renders a graceful not-found for an unknown ISO', () => {
    const { getByText, getByRole } = render(AtlasCountry, { params: { iso2: 'ZZ' } });
    expect(getByText(/couldn.t find that country/i)).toBeInTheDocument();
    expect(getByRole('link', { name: /Back to the Atlas/i })).toHaveAttribute('href', '#/atlas');
  });
});
