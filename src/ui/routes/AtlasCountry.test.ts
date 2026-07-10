import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AtlasCountry from './AtlasCountry.svelte';

describe('AtlasCountry', () => {
  it('shows the flag, name, capital, and region / sub-region cross-links', () => {
    const { container, getByRole } = render(AtlasCountry, { params: { iso2: 'FR' } });

    expect(getByRole('heading', { level: 1, name: 'France' })).toBeInTheDocument();
    expect(container.querySelector('a[href="#/atlas/region/Europe"]')).toBeInTheDocument();
    expect(container.textContent).toContain('Western Europe');
    // The capital is shown as a labelled fact.
    expect(container.textContent).toContain('Capital');
    expect(container.textContent).toContain('Paris');
    // The flag is named for a11y on the reference page.
    expect(getByRole('img', { name: 'France' })).toBeInTheDocument();
  });

  it('resolves the ISO case-insensitively', () => {
    const { getByRole } = render(AtlasCountry, { params: { iso2: 'fr' } });
    expect(getByRole('heading', { level: 1, name: 'France' })).toBeInTheDocument();
  });

  it('labels each fact with a glyph and shows the locator-map area (Phase 31)', () => {
    const { container, getByRole } = render(AtlasCountry, { params: { iso2: 'FR' } });

    // Capital / Languages / Region / Sub-region (+ Industries if any) each get a leading icon.
    expect(container.querySelectorAll('.fact dt .icon').length).toBeGreaterThanOrEqual(4);
    // The flag stays the only element named for the country (the locator map has its own label),
    // so the reference-page a11y name is unambiguous.
    expect(getByRole('img', { name: 'France' })).toBeInTheDocument();
    // Geometry loads lazily; the locator area renders its status region either way.
    expect(getByRole('status')).toBeInTheDocument();
  });

  it('renders a graceful not-found for an unknown ISO', () => {
    const { getByText, getByRole } = render(AtlasCountry, { params: { iso2: 'ZZ' } });
    expect(getByText(/couldn.t find that country/i)).toBeInTheDocument();
    expect(getByRole('link', { name: /Back to the Atlas/i })).toHaveAttribute('href', '#/atlas');
  });
});
