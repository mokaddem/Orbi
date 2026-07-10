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

  it('surfaces the industries "why" fun facts for a covered country (Phase 32)', () => {
    const { container } = render(AtlasCountry, { params: { iso2: 'FR' } });

    const section = container.querySelector('.did-you-know');
    expect(section).not.toBeNull();
    expect(section!.textContent).toContain('Did you know?');
    // France is fact-covered: one line per industry, each with the industry name + its fact.
    expect(section!.querySelectorAll('li').length).toBe(5);
    expect(section!.textContent).toContain('Airbus'); // from the aerospace-defence fact
  });

  it('omits the fun-facts section for a country with industries but no curated facts', () => {
    // Bhutan carries industries (energy, tourism, agriculture) but is outside the priority set,
    // so no facts are authored — the section must not render (graceful, per silent-omit policy).
    const { container } = render(AtlasCountry, { params: { iso2: 'BT' } });
    expect(container.querySelector('.did-you-know')).toBeNull();
  });

  it('renders a graceful not-found for an unknown ISO', () => {
    const { getByText, getByRole } = render(AtlasCountry, { params: { iso2: 'ZZ' } });
    expect(getByText(/couldn.t find that country/i)).toBeInTheDocument();
    expect(getByRole('link', { name: /Back to the Atlas/i })).toHaveAttribute('href', '#/atlas');
  });
});
